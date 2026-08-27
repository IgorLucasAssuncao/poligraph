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
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import psycopg

from . import conexao as conexao_mod
from . import comparacao, grafo, ingestao, persistencia, similaridade, validacao
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

    # 🔴 O Aspire injeta no formato do Npgsql (`Host=...;Database=...`) e o psycopg
    #    fala libpq (`host=... dbname=...`). Sem traduzir, morre antes de conectar.
    conexao_str = conexao_mod.normalizar(conexao_str)

    inicio = time.monotonic()
    try:
        with psycopg.connect(conexao_str, autocommit=True) as conexao:
            if args.comando == "ingerir":
                _ingerir(conexao, args.anos)
            elif args.comando == "validar":
                _validar(conexao, args.legislatura, args.divisao_minima)
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

    validar = sub.add_parser(
        "validar", help="mede discriminação do questionário e comunidade x partido"
    )
    validar.add_argument("--legislatura", type=int, default=57)
    validar.add_argument(
        "--divisao-minima",
        type=float,
        default=0.25,
        help="só votações ao menos assim divididas entram como pergunta candidata",
    )

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

    # 🔴 Zero aqui NÃO é caso normal — é o arquivo ter mudado de forma.
    #
    # ⚠️ Foi exatamente assim que o bug do `uri` sobreviveu: `0 deputados no arquivo`
    #    saiu em INFO, o ETL seguiu, e como o de-para ficou vazio os 13.825 votos de
    #    2025 também foram descartados, registrando `0 votos`. Dois zeros plausíveis e
    #    nenhuma exceção. Parar aqui é o que transforma isso em erro visível.
    if not deputados:
        raise RuntimeError(
            f"Nenhum deputado lido de {caminho}. O layout do CSV mudou? "
            "Sem o de-para, todos os votos seriam descartados em silêncio."
        )

    mapa = _mapa_pessoas(conexao)

    for ano in anos:
        log.info("Ingerindo %d...", ano)

        arquivo = camara.baixar("votacoes", ano, CACHE / f"votacoes-{ano}.csv")
        df = camara.ler_csv(arquivo)
        camara.conferir_volume(df, ano)      # ⭐ canário contra regressão de parsing

        votacoes = ingestao.votacoes_para_linhas(df)

        # ⚠️ A proposição referenciada quase nunca está na nossa base — ver PL40.
        sem_proposicao = persistencia.desconectar_proposicoes_ausentes(conexao, votacoes)

        persistencia.gravar_votacoes(conexao, votacoes)
        log.info("  %d registros, %d votações nominais", len(df), len(votacoes))
        if sem_proposicao:
            log.warning(
                "  %d votações sem proposição na base (proposicao_id nulo)",
                sem_proposicao,
            )

        arquivo_votos = camara.baixar(
            "votacoesVotos", ano, CACHE / f"votacoesVotos-{ano}.csv"
        )
        df_votos = camara.ler_csv(arquivo_votos)
        votos = ingestao.votos_para_linhas(df_votos, mapa)
        persistencia.gravar_votos(conexao, votos)
        log.info("  %d votos de %d linhas", len(votos), len(df_votos))

        # ⚠️ Voto fora do de-para é descartado, não inventado. Em volume, o problema
        #    está na ingestão de deputados — e aí o número precisa aparecer.
        descartados = len(df_votos) - len(votos)
        if descartados:
            log.warning(
                "  %d votos descartados: deputado fora do de-para", descartados
            )


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

            # ⚠️ O grafo sai da CONCORDANCIA, não do cosseno: é a métrica que a
            #    tela explica ("votaram igual em X de Y"). O cosseno fica gravado em
            #    `similaridades` para a comparação da RF-18.
            if metrica == "CONCORDANCIA":
                arestas = similaridade.arestas_knn(pares)
                gravadas = persistencia.gravar_arestas(conexao, execucao_id, arestas)
                log.info("  grafo kNN: %d arestas gravadas", gravadas)

                # ⭐ É aqui que o grafo ganha NÓS. Sem esta parte ele tem ligações e
                #    nenhum ponto com comunidade, cor ou posição — nada a desenhar.
                nos = grafo.calcular_nos(
                    pessoas, arestas, _votacoes_por_pessoa(matriz, pessoas), matriz
                )
                gravados = persistencia.gravar_nos_metrica(conexao, execucao_id, nos)
                log.info("  %d nós gravados", gravados)

        persistencia.fechar_execucao(conexao, execucao_id, sucesso=True)
    except Exception:
        persistencia.fechar_execucao(conexao, execucao_id, sucesso=False)
        raise


def _validar(conexao: psycopg.Connection, legislatura: int, divisao_minima: float) -> None:
    """RF-20 e a validação do questionário. ⛔ Não escreve no banco — é medição."""
    pessoas, votacoes, matriz, _ = _montar_matriz(conexao, legislatura)
    log.info("Matriz: %d pessoas × %d votações", len(pessoas), len(votacoes))

    # ═══ 1. Quantas perguntas bastam ═══
    candidatas = [
        i
        for i in range(len(votacoes))
        if validacao.divisao(matriz, i) >= divisao_minima
    ]
    log.info(
        "%d votações com divisão >= %.2f servem como pergunta",
        len(candidatas),
        divisao_minima,
    )

    log.info("")
    log.info("  perguntas | empate mediano no topo | sozinhos no topo")
    for r in validacao.curva_de_discriminacao(
        matriz, candidatas, [4, 6, 8, 10, 12, 16, 22, 30, 40]
    ):
        log.info(
            "  %9d | %22.0f | %5.1f%% (%d de %d)",
            r.n_perguntas,
            r.empate_mediano,
            r.taxa_unicos * 100,
            r.unicos,
            r.deputados_avaliados,
        )

    # ═══ 1b. Desempate dirigido × aleatório ═══
    _comparar_desempates(matriz, candidatas)

    # ═══ 2. Comunidade × partido (RF-20 / RQ2) ═══
    execucao = conexao.execute(
        "SELECT max(id) FROM execucoes WHERE status = 'CONCLUIDA'"
    ).fetchone()
    if not execucao or execucao[0] is None:
        log.warning("Nenhuma execução concluída — rode `analisar` antes.")
        return

    comunidade_de = {
        linha[0]: linha[1]
        for linha in conexao.execute(
            "SELECT pessoa_id, comunidade FROM nos_metrica WHERE execucao_id = %s",
            (execucao[0],),
        ).fetchall()
        if linha[1] is not None
    }

    if not comunidade_de:
        log.warning("`nos_metrica` vazia — rode `analisar` com a versão que grava nós.")
        return

    partido_de = _partido_mais_recente(conexao)
    arestas = [
        _Aresta(linha[0], linha[1], linha[2])
        for linha in conexao.execute(
            "SELECT pessoa_a, pessoa_b, peso FROM arestas_grafo WHERE execucao_id = %s",
            (execucao[0],),
        ).fetchall()
    ]

    g = grafo.montar(list(comunidade_de), arestas)
    r = comparacao.comparar(g, comunidade_de, partido_de)

    log.info("")
    log.info("═══ Comunidade de voto × partido — %d deputados ═══", r.n_pessoas)
    log.info("  %d comunidades detectadas, %d partidos", r.n_comunidades, r.n_partidos)
    log.info("  ARI (coincidência entre as duas): %.3f", r.ari)
    log.info("  Modularidade da comunidade: %.3f", r.modularidade_comunidade)
    log.info("  Modularidade do partido:    %.3f", r.modularidade_partido)
    log.info(
        "  → %s descreve melhor a estrutura de voto.",
        "A COMUNIDADE" if r.comunidade_descreve_melhor else "O PARTIDO",
    )


def _comparar_desempates(matriz, candidatas: list[int], base_inicial: int = 12) -> None:
    """Dirigido × aleatório, sobre uma amostra de deputados.

    🔴 O grupo de controle é o que faz isto valer como evidência. Sem ele, o encolhimento
    do empate poderia vir apenas de perguntar mais — e a "contribuição técnica" seria
    só um contador de perguntas.
    """
    sorteio = np.random.default_rng(20260826)
    base = sorted(sorteio.choice(candidatas, size=base_inicial, replace=False).tolist())
    restantes = [c for c in candidatas if c not in base]

    # ⚠️ Amostra de deputados, não todos: são 655 × 6 rodadas × duas estratégias.
    quem_avaliar = sorteio.choice(matriz.shape[0], size=120, replace=False)

    def media_por_rodada(dirigido: bool) -> list[float]:
        series = [
            validacao.simular_desempate(
                matriz, int(q), base, restantes, rodadas=6, dirigido=dirigido
            )
            for q in quem_avaliar
        ]
        # ⚠️ Séries têm comprimentos diferentes: quem chega a 1 para antes. O último
        #    valor é repetido para a média não subir artificialmente ao perdê-los.
        maior = max(len(x) for x in series)
        return [
            float(np.mean([x[min(i, len(x) - 1)] for x in series])) for i in range(maior)
        ]

    dirigido = media_por_rodada(True)
    aleatorio = media_por_rodada(False)

    log.info("")
    log.info("═══ Desempate: dirigido × aleatório (base de %d perguntas) ═══", base_inicial)
    log.info("  perguntas extras | dirigido | aleatório")
    for i, (d, a) in enumerate(zip(dirigido, aleatorio)):
        log.info("  %16d | %8.1f | %9.1f", i, d, a)


@dataclass(frozen=True)
class _Aresta:
    """⚠️ `grafo.montar` espera `.pessoa_a`, `.pessoa_b` e `.valor`."""

    pessoa_a: int
    pessoa_b: int
    valor: float


def _partido_mais_recente(conexao: psycopg.Connection) -> dict[int, str]:
    """⚠️ Partido vem do voto, não da pessoa: o registro é histórico e deputado troca."""
    linhas = conexao.execute(
        """
        SELECT DISTINCT ON (x.pessoa_id) x.pessoa_id, x.partido_no_voto
          FROM votos x JOIN votacoes v ON v.id = x.votacao_id
         ORDER BY x.pessoa_id, v.data DESC
        """
    ).fetchall()

    return {pessoa: partido for pessoa, partido in linhas if partido}


def _votacoes_por_pessoa(matriz, pessoas: list[int]) -> dict[int, int]:
    """Quantas votações cada pessoa efetivamente pesou.

    ⚠️ Conta só posicionamento (Sim ou Não). Ausência e abstenção ficam de fora, pelo
    mesmo motivo do cálculo de afinidade: quem não se posicionou não discordou.
    """
    posicionou = (~np.isnan(matriz)) & (matriz != 0)

    return {pessoa: int(posicionou[i].sum()) for i, pessoa in enumerate(pessoas)}


def _mapa_pessoas(conexao: psycopg.Connection) -> dict[str, int]:
    linhas = conexao.execute(
        "SELECT id_externo, pessoa_id FROM pessoa_fonte_ids WHERE fonte = 'CAMARA'"
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
          FROM votacoes
         WHERE casa = 'CAMARA' AND legislatura = %s AND plenario AND NOT secreta
         ORDER BY id
        """,
        (legislatura,),
    ).fetchall()

    pessoas = [
        r[0]
        for r in conexao.execute(
            "SELECT DISTINCT pessoa_id FROM votos ORDER BY pessoa_id"
        ).fetchall()
    ]

    indice_votacao = {v[0]: i for i, v in enumerate(votacoes)}
    indice_pessoa = {p: i for i, p in enumerate(pessoas)}

    matriz = np.full((len(pessoas), len(votacoes)), np.nan)
    for votacao_id, pessoa_id, valor in conexao.execute(
        "SELECT votacao_id, pessoa_id, valor FROM votos WHERE valor IS NOT NULL"
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
