"""Orquestrador do ETL.

⚠️ Não é serviço: roda, faz o trabalho e morre. Em produção é uma Scheduled Task do
Coolify, dentro do VPS — o Postgres nunca sai de lá.

    python -m poligraph_etl ingerir  --anos 2023 2024 2025 2026
    python -m poligraph_etl analisar --legislatura 57
"""

import argparse
import logging
import os
import sys
import time
from pathlib import Path

import numpy as np
import psycopg

from . import ingestao, persistencia, similaridade
from .fontes import camara

log = logging.getLogger("poligraph")

CACHE = Path(os.environ.get("POLIGRAPH_CACHE", ".cache"))


def main(argv: list[str] | None = None) -> int:
    args = _argumentos(argv)
    _configurar_log()

    conexao_str = os.environ.get("ConnectionStrings__poligraph") or os.environ.get(
        "POLIGRAPH_CONEXAO"
    )
    if not conexao_str:
        log.error("Defina ConnectionStrings__poligraph (ou POLIGRAPH_CONEXAO).")
        return 2

    inicio = time.monotonic()
    try:
        with psycopg.connect(conexao_str, autocommit=True) as conexao:
            if args.comando == "ingerir":
                _ingerir(conexao, args.anos)
            else:
                _analisar(conexao, args.legislatura)
    except Exception:
        log.exception("ETL falhou")
        return 1

    log.info("Concluído em %.1fs", time.monotonic() - inicio)
    return 0


# ═══════════════════════════════════════════════════════════════════
# PRIVADOS — na ordem de uso
# ═══════════════════════════════════════════════════════════════════


def _argumentos(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="poligraph_etl")
    sub = parser.add_subparsers(dest="comando", required=True)

    ingerir = sub.add_parser("ingerir", help="baixa e grava votações e votos")
    ingerir.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    analisar = sub.add_parser("analisar", help="calcula similaridade e grafo")
    analisar.add_argument("--legislatura", type=int, default=57)

    return parser.parse_args(argv)


def _configurar_log() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        stream=sys.stdout,
    )


def _ingerir(conexao: psycopg.Connection, anos: list[int]) -> None:
    """RF-01, RF-03, RF-08 — carga com log auditável."""
    log.info("Ingerindo deputados...")
    caminho = camara.baixar("deputados", anos[0], CACHE / "deputados.csv")
    deputados = ingestao.deputados_para_linhas(camara.ler_csv(caminho))
    novos = persistencia.gravar_pessoas(conexao, deputados)
    log.info("  %d deputados no arquivo, %d novos", len(deputados), novos)

    mapa = _mapa_pessoas(conexao)

    for ano in anos:
        log.info("Ingerindo %d...", ano)

        arquivo = camara.baixar("votacoes", ano, CACHE / f"votacoes-{ano}.csv")
        df = camara.ler_csv(arquivo)
        camara.conferir_volume(df, ano)      # ⭐ canário contra regressão de parsing

        votacoes = ingestao.votacoes_para_linhas(df)
        persistencia.gravar_votacoes(conexao, votacoes)
        log.info("  %d registros, %d votações nominais", len(df), len(votacoes))

        arquivo_votos = camara.baixar(
            "votacoesVotos", ano, CACHE / f"votacoesVotos-{ano}.csv"
        )
        votos = ingestao.votos_para_linhas(camara.ler_csv(arquivo_votos), mapa)
        persistencia.gravar_votos(conexao, votos)
        log.info("  %d votos", len(votos))


def _analisar(conexao: psycopg.Connection, legislatura: int) -> None:
    """RF-17, RF-19 — matriz, similaridade e grafo."""
    pessoas, votacoes, matriz, pesos = _montar_matriz(conexao, legislatura)
    log.info("Matriz: %d pessoas × %d votações", len(pessoas), len(votacoes))

    if len(pessoas) < 2:
        log.warning("Menos de duas pessoas com voto — nada a calcular.")
        return

    execucao_id = persistencia.abrir_execucao(
        conexao, "CAMARA", legislatura, similaridade.K_VIZINHOS, "v1"
    )
    try:
        for metrica in ("CONCORDANCIA", "COSSENO"):
            pares = similaridade.calcular_pares(matriz, pessoas, pesos, metrica)
            persistencia.gravar_similaridades(conexao, execucao_id, pares)
            log.info("  %s: %d pares acima do mínimo", metrica, len(pares))

            if metrica == "CONCORDANCIA":
                arestas = similaridade.arestas_knn(pares)
                log.info("  grafo kNN: %d arestas", len(arestas))

        persistencia.fechar_execucao(conexao, execucao_id, sucesso=True)
    except Exception:
        persistencia.fechar_execucao(conexao, execucao_id, sucesso=False)
        raise


def _mapa_pessoas(conexao: psycopg.Connection) -> dict[str, int]:
    linhas = conexao.execute(
        "SELECT id_externo, pessoa_id FROM pessoa_fonte_id WHERE fonte = 'CAMARA'"
    ).fetchall()
    return {str(externo): pessoa_id for externo, pessoa_id in linhas}


def _montar_matriz(conexao: psycopg.Connection, legislatura: int):
    """Monta a matriz pessoa × votação.

    ⚠️ Só votações NOMINAIS de PLENÁRIO, e não secretas. Votação de comissão fica de
    fora: é 3× mais consensual que plenário (39% vs 12% de quase unanimidade), e
    misturá-la achataria a similaridade.
    """
    votacoes = conexao.execute(
        """
        SELECT id, categoria, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM data)
          FROM votacao
         WHERE casa = 'CAMARA' AND legislatura = %s AND plenario AND NOT secreta
         ORDER BY id
        """,
        (legislatura,),
    ).fetchall()

    pessoas = [
        r[0]
        for r in conexao.execute(
            "SELECT DISTINCT pessoa_id FROM voto ORDER BY pessoa_id"
        ).fetchall()
    ]

    indice_votacao = {v[0]: i for i, v in enumerate(votacoes)}
    indice_pessoa = {p: i for i, p in enumerate(pessoas)}

    matriz = np.full((len(pessoas), len(votacoes)), np.nan)
    for votacao_id, pessoa_id, valor in conexao.execute(
        "SELECT votacao_id, pessoa_id, valor FROM voto WHERE valor IS NOT NULL"
    ).fetchall():
        i, j = indice_pessoa.get(pessoa_id), indice_votacao.get(votacao_id)
        if i is not None and j is not None:
            matriz[i, j] = valor

    pesos = np.array(
        [similaridade.peso_da_votacao(cat, float(anos)) for _, cat, anos in votacoes]
    )

    return pessoas, votacoes, matriz, pesos


if __name__ == "__main__":
    raise SystemExit(main())
