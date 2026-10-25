"""A conferência do banco e a amostra contra um segundo canal oficial."""

import csv
import logging
import time
from datetime import date

import psycopg

from ..congresso import ingestao_senado
from ..fontes import camara, senado
from ..nucleo import normalizacao
from ..qualidade import amostra, conferencia
from ..nucleo.tipos import TipoCasa
from . import comum

log = logging.getLogger("poligraph")


def rodar_amostra(conexao: psycopg.Connection, por_grupo: int, semente: int) -> None:
    """Pendência 67 — sorteia votações abertas com voto e as confere, voto a voto, contra o segundo canal.

    Grava `amostra-{data}.csv` no cache, uma linha por votação, e resume por casa e legislatura.
    A votação que o segundo canal não devolve conta como "sem resposta", e não como erro da base.
    """
    grupos: dict[tuple[str, int], list[str]] = {}
    for casa, legislatura, id_votacao in conexao.execute(
        """
        SELECT t.casa, t.legislatura, t.id FROM votacoes t
         WHERE NOT t.secreta AND EXISTS (SELECT 1 FROM votos v WHERE v.votacao_id = t.id)
        """
    ).fetchall():
        grupos.setdefault((casa, legislatura), []).append(id_votacao)

    linhas = []
    for (casa, legislatura), ids in sorted(grupos.items()):
        sorteadas = amostra.sortear(ids, por_grupo, semente, f"{casa}-{legislatura}")
        conferidas = sem_resposta = com_diferenca = 0
        cache_do_senado: dict[str, dict | None] = {}
        for id_votacao in sorteadas:
            base = {
                str(id_externo): valor
                for id_externo, valor in conexao.execute(
                    """
                    SELECT f.id_externo, v.valor FROM votos v
                      JOIN pessoa_fonte_ids f ON f.pessoa_id = v.pessoa_id AND f.fonte = %s
                     WHERE v.votacao_id = %s
                    """,
                    (casa, id_votacao),
                ).fetchall()
            }
            if casa == TipoCasa.CAMARA:
                brutos = camara.votos_da_votacao(id_votacao)
                fonte = None if brutos is None else {k: normalizacao.normalizar_voto(v) for k, v in brutos.items()}
            else:
                data = conexao.execute("SELECT data::text FROM votacoes WHERE id = %s", (id_votacao,)).fetchone()[0]
                if data not in cache_do_senado:
                    cache_do_senado[data] = senado.votos_por_data(data)
                do_dia = cache_do_senado[data] or {}
                brutos = do_dia.get(id_votacao.removeprefix("SF-"))
                fonte = None if brutos is None else {k: ingestao_senado.normalizar_voto(v) for k, v in brutos.items()}
            time.sleep(0.1)

            if not fonte:
                sem_resposta += 1
                linhas.append({"casa": casa, "legislatura": legislatura, "votacao": id_votacao,
                               "situacao": "SEM_RESPOSTA", "iguais": "", "divergentes": "",
                               "so_na_base": "", "so_na_fonte": ""})
                continue
            resultado = amostra.comparar(base, fonte)
            conferidas += 1
            com_diferenca += 0 if resultado.confere else 1
            linhas.append({"casa": casa, "legislatura": legislatura, "votacao": id_votacao,
                           "situacao": "CONFERE" if resultado.confere else "DIFERE",
                           "iguais": resultado.iguais, "divergentes": resultado.divergentes,
                           "so_na_base": resultado.so_na_base, "so_na_fonte": resultado.so_na_fonte})
        log.info("  %s %dª: %d sorteadas, %d conferidas, %d com diferença, %d sem resposta",
                 casa, legislatura, len(sorteadas), conferidas, com_diferenca, sem_resposta)

    saida = comum.CACHE / f"amostra-{date.today():%Y%m%d}.csv"
    saida.parent.mkdir(parents=True, exist_ok=True)
    with saida.open("w", newline="", encoding="utf-8") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=list(linhas[0].keys()) if linhas else ["casa"])
        escritor.writeheader()
        escritor.writerows(linhas)
    log.info("Amostra gravada em %s", saida)


def rodar_conferir(conexao: psycopg.Connection) -> None:
    """Pendência 66 — confere o banco inteiro. Não escreve nada; falha se alguma regra der ERRO.

    DECISÃO: Feito para rodar no fim de toda carga: os 203 senadores da 55ª (achado #37) teriam
    aparecido aqui no dia, não por acaso semanas depois.
    """
    achados = conferencia.conferir(lambda sql: conexao.execute(sql).fetchall())

    por_regra: dict[tuple[str, str], list] = {}
    for achado in achados:
        por_regra.setdefault((achado.severidade, achado.regra), []).append(achado)

    if not achados:
        log.info("Conferência: nenhuma regra quebrada.")
        return

    for (severidade, regra), lista in sorted(por_regra.items()):
        nivel = log.error if severidade == "ERRO" else log.warning
        nivel("%s %s — %d", severidade, regra, len(lista))
        for achado in lista[:10]:
            onde = f"{achado.casa} {achado.legislatura}ª" if achado.legislatura else achado.casa
            nivel("    %s · %s", onde, achado.detalhe)
        if len(lista) > 10:
            nivel("    … e mais %d", len(lista) - 10)

    erros = sum(1 for a in achados if a.severidade == "ERRO")
    avisos = len(achados) - erros
    log.info("Conferência: %d erro(s), %d aviso(s).", erros, avisos)

    if erros:
        raise RuntimeError(f"Conferência encontrou {erros} erro(s) — o dado não deve ir à tela assim.")
