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
from . import (
    comparacao, cota, curadoria, emendas, grafo, ingestao, ingestao_senado,
    normalizacao, orientacoes, persistencia, receitas, similaridade, validacao,
)
from .fontes import camara, senado, tse

log = logging.getLogger("poligraph")

CACHE = Path(os.environ.get("POLIGRAPH_CACHE", ".cache"))

# ⚠️ Segundos entre chamadas na busca de CPF — são centenas contra serviço público.
PAUSA_ENTRE_CHAMADAS = 0.15


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
            elif args.comando == "senado":
                _senado(conexao, args.anos)
            elif args.comando == "curar":
                _curar(conexao, args.casa, args.legislatura, args.limite)
            elif args.comando == "emendas":
                if args.resolver:
                    _resolver_a_mao(conexao, args.resolver)
                else:
                    _emendas(conexao, args.anos)
            elif args.comando == "cpf":
                _cpf(conexao)
            elif args.comando == "cota":
                _cota(conexao, args.anos)
            elif args.comando == "fundo":
                _fundo(conexao, args.eleicao, args.arquivo)
            elif args.comando == "validar":
                _validar(conexao, args.legislatura, args.divisao_minima)
            else:
                _analisar(conexao, args.legislatura, args.casa)
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

    sen = sub.add_parser("senado", help="ingere senadores, votações e votos do Senado")
    sen.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    analisar = sub.add_parser("analisar", help="calcula similaridade e grafo")
    analisar.add_argument("--legislatura", type=int, default=57)
    analisar.add_argument(
        "--casa", choices=["CAMARA", "SENADO"], default="CAMARA",
        help="uma casa por execução — as duas não são comparáveis entre si",
    )

    sub.add_parser("cpf", help="busca o CPF dos deputados com voto e grava o HASH")

    emd = sub.add_parser("emendas", help="ingere emendas parlamentares (Portal)")
    emd.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    # A porta da reconciliação MANUAL: sem ela os autores ambíguos ficam sem saída,
    # porque ambiguidade ⛔ não pode virar palpite automático.
    emd.add_argument(
        "--resolver",
        nargs="+",
        default=[],
        metavar="CODIGO=PESSOA_ID",
        help="vincula autores à mão, ex.: --resolver 4184=612 3767=91",
    )

    cotas = sub.add_parser("cota", help="ingere a cota parlamentar (CEAP)")
    cotas.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    fundo = sub.add_parser(
        "fundo", help="ingere o financiamento de campanha, incluindo o fundão (TSE)"
    )
    # ⚠️ Ano da ELEIÇÃO, ⛔ não do exercício. 2022 elegeu a legislatura 57.
    fundo.add_argument("--eleicao", type=int, default=2022)
    fundo.add_argument(
        "--arquivo",
        type=Path,
        default=None,
        help="ZIP baixado à mão — o plano B para quando o WAF do TSE endurecer",
    )

    curar = sub.add_parser(
        "curar", help="lista votações candidatas a pergunta, das mais divididas"
    )
    curar.add_argument("--casa", choices=["CAMARA", "SENADO"], default="SENADO")
    curar.add_argument("--legislatura", type=int, default=57)
    curar.add_argument("--limite", type=int, default=25)

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
    # 🔴 O console do Windows é cp1252, e `logging` ⛔ não trata erro de codificação:
    # imprime um rastro de exceção no lugar da mensagem e segue. `errors="replace"` faz
    # o texto degradar em vez de sumir; as mensagens evitam o problema na origem.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")

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

        # ⭐ Orientação de bancada: é o que transforma "votou Sim" em posição. Sem ela,
        #    `governismo` e `disciplina` ficam nulos — as colunas existem desde o
        #    schema inicial e passaram a legislatura inteira vazias.
        arquivo_orientacoes = camara.baixar(
            "votacoesOrientacoes", ano, CACHE / f"votacoesOrientacoes-{ano}.csv"
        )
        df_orientacoes = camara.ler_csv(arquivo_orientacoes)
        linhas = orientacoes.para_linhas(
            df_orientacoes.to_dict("records"), {v["id"] for v in votacoes}
        )
        persistencia.gravar_orientacoes(conexao, linhas)
        log.info(
            "  %d orientações de %d linhas (%d bancadas)",
            len(linhas), len(df_orientacoes), len({l["bancada"] for l in linhas}),
        )


def _senado(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Ingestão do Senado — senadores, votações e votos.

    As duas casas não são comparáveis entre si (achado #7), então isto alimenta um grafo
    próprio: o `analisar` recebe a casa e monta uma matriz separada. Nenhuma aresta liga
    deputado a senador.
    """
    log.info("Ingerindo senadores...")
    senadores = ingestao_senado.senadores_para_linhas(senado.baixar_senadores())
    novos = persistencia.gravar_pessoas(conexao, senadores)
    log.info("  %d senadores em exercício, %d novos", len(senadores), novos)

    # Zero senadores é mudança de contrato, não Senado vazio — e sem o de-para todos os
    # votos seriam descartados em silêncio, como já aconteceu com a Câmara.
    if not senadores:
        raise RuntimeError(
            "Nenhum senador lido de /senador/lista/atual. O envelope do JSON mudou? "
            "Sem o de-para, todos os votos seriam descartados em silêncio."
        )

    for ano in anos:
        log.info("Ingerindo Senado %d...", ano)

        votacoes_brutas = senado.baixar_votacoes(ano)
        senado.conferir_volume(votacoes_brutas, ano)

        # A lista de exercício só tem quem está hoje; os votos alcançam quem saiu,
        # licenciou-se ou devolveu a cadeira. Criá-los a partir do próprio voto evita
        # descartar 10,5% da base por falta de dono.
        anteriores = ingestao_senado.senadores_dos_votos(votacoes_brutas)
        recuperados = persistencia.gravar_pessoas(conexao, anteriores)
        if recuperados:
            log.info("  %d senadores fora da lista de exercício, criados pelo voto",
                     recuperados)

        mapa = _mapa_pessoas(conexao, fonte="SENADO")

        votacoes = ingestao_senado.votacoes_para_linhas(votacoes_brutas)
        persistencia.gravar_votacoes(conexao, votacoes)

        abertas = sum(1 for linha in votacoes if not linha["secreta"])
        log.info(
            "  %d votações, %d abertas (%.0f%% secretas)",
            len(votacoes), abertas,
            100 * (len(votacoes) - abertas) / max(len(votacoes), 1),
        )

        votos = ingestao_senado.votos_para_linhas(votacoes_brutas, mapa)
        persistencia.gravar_votos(conexao, votos)

        com_posicao = sum(1 for linha in votos if linha["valor"] is not None)
        log.info(
            "  %d votos, %d com posição utilizável (%.0f%%)",
            len(votos), com_posicao, 100 * com_posicao / max(len(votos), 1),
        )

        descartados = sum(len(v.get("votos") or []) for v in votacoes_brutas) - len(votos)
        if descartados:
            log.warning("  %d votos descartados: senador fora do de-para", descartados)

        # Sigla nova é sinal de que o domínio mudou. Ela vira None e a ingestão segue,
        # mas o log precisa denunciar — senão a base encolhe sem ninguém perceber.
        novas = ingestao_senado.siglas_desconhecidas(votacoes_brutas)
        if novas:
            descricoes = ingestao_senado.descricoes_de_sigla(votacoes_brutas)
            for sigla, quantas in sorted(novas.items()):
                log.warning(
                    "  sigla FORA do domínio medido: %s (%d) — %s",
                    sigla, quantas, descricoes.get(sigla, "sem descrição na fonte"),
                )


def _analisar(conexao: psycopg.Connection, legislatura: int, casa: str) -> None:
    """RF-17, RF-19 — matriz, similaridade e grafo, de UMA casa.

    Cada casa gera a própria `execucao`: nenhuma aresta liga deputado a senador, porque
    as duas não votam as mesmas matérias (achado #7).
    """
    pessoas, votacoes, matriz, pesos = _montar_matriz(conexao, legislatura, casa)
    log.info("Matriz %s: %d pessoas × %d votações", casa, len(pessoas), len(votacoes))

    if len(pessoas) < 2:
        log.warning("Menos de duas pessoas com voto — nada a calcular.")
        return

    execucao_id = persistencia.abrir_execucao(
        conexao, casa, legislatura, similaridade.K_VIZINHOS, "v1"
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
                    pessoas, arestas, _votacoes_por_pessoa(matriz, pessoas, pesos), matriz
                )
                gravados = persistencia.gravar_nos_metrica(conexao, execucao_id, nos)
                log.info("  %d nós gravados", gravados)

                _alinhamento(conexao, execucao_id, casa, legislatura, pessoas)

        persistencia.fechar_execucao(conexao, execucao_id, sucesso=True)
    except Exception:
        persistencia.fechar_execucao(conexao, execucao_id, sucesso=False)
        raise


def _alinhamento(
    conexao: psycopg.Connection,
    execucao_id: int,
    casa: str,
    legislatura: int,
    pessoas: list[int],
) -> None:
    """Preenche `governismo` e `disciplina` a partir da orientação de bancada.

    ⭐ **Governismo** é seguir a bancada `Governo`; **disciplina** é seguir o próprio
    partido no momento do voto. O partido vem de `votos.partido_no_voto`, ⛔ não da
    filiação de hoje: trocar de partido é comum, e medir disciplina contra a filiação
    atual reescreveria o passado.

    ⚠️ Sai sem fazer nada no Senado — lá ⛔ não existe orientação de bancada, e as duas
    colunas continuam nulas de propósito.
    """
    if casa != orientacoes.CASA:
        log.info("  alinhamento: %s não publica orientação de bancada", casa)
        return

    por_votacao: dict[str, dict[str, str]] = {}
    for votacao_id, bancada, orientacao in conexao.execute(
        """
        SELECT o.votacao_id, o.bancada, o.orientacao
          FROM orientacoes o
          JOIN votacoes v ON v.id = o.votacao_id
         WHERE v.casa = %s AND v.legislatura = %s
        """,
        (casa, legislatura),
    ).fetchall():
        por_votacao.setdefault(votacao_id, {})[bancada] = orientacao

    if not por_votacao:
        log.warning("  alinhamento: nenhuma orientação na base — rode `ingerir`")
        return

    # ⚠️ Uma consulta só, e ⛔ não uma por pessoa: são 643 parlamentares, e o laço com
    #    ida ao banco levaria minutos para devolver o que cabe numa varredura.
    votos_por_pessoa: dict[int, dict[str, int]] = {}
    partido_por_pessoa: dict[int, str] = {}
    for pessoa_id, votacao_id, valor, partido in conexao.execute(
        """
        SELECT vo.pessoa_id, vo.votacao_id, vo.valor, vo.partido_no_voto
          FROM votos vo
          JOIN votacoes v ON v.id = vo.votacao_id
         WHERE v.casa = %s AND v.legislatura = %s AND vo.valor IN (1, -1)
        """,
        (casa, legislatura),
    ).fetchall():
        votos_por_pessoa.setdefault(pessoa_id, {})[votacao_id] = valor
        # O partido do voto MAIS RECENTE lido vence — serve só para escolher contra
        # qual bancada medir disciplina quando a pessoa trocou de sigla.
        partido_por_pessoa[pessoa_id] = partido

    metricas = []
    for pessoa_id in pessoas:
        votos = votos_por_pessoa.get(pessoa_id) or {}
        if not votos:
            continue

        segue_gov, base_gov = orientacoes.alinhamento(
            votos, por_votacao, orientacoes.BANCADA_DO_GOVERNO
        )
        segue_part, base_part = orientacoes.alinhamento(
            votos, por_votacao, partido_por_pessoa.get(pessoa_id, "")
        )

        # ⛔ Sem base, NULO — ⛔ nunca zero. Zero afirmaria "nunca seguiu o governo",
        #    e o que houve foi não haver votação comparável.
        metricas.append(
            {
                "pessoa_id": pessoa_id,
                "governismo": segue_gov / base_gov if base_gov else None,
                "disciplina": segue_part / base_part if base_part else None,
            }
        )

    persistencia.gravar_metricas_de_alinhamento(conexao, execucao_id, metricas)

    com_gov = sum(1 for m in metricas if m["governismo"] is not None)
    com_part = sum(1 for m in metricas if m["disciplina"] is not None)
    log.info(
        "  alinhamento: %d com governismo, %d com disciplina, de %d nós",
        com_gov, com_part, len(metricas),
    )


def _emendas(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Emendas parlamentares — ingere primeiro, resolve o vínculo depois.

    🔴 **Decisão do autor:** a chave é o **código do autor**, ⛔ não o nome. Nada é
    descartado por não ter dono conhecido — senador, emenda de bancada e parlamentar de
    outra legislatura entram com `pessoa_id` nulo e ficam na fila de reconciliação.

    ⭐ O casamento por nome roda **uma vez**, como SUGESTÃO (`AUTOMATICO`). Depois disso
    o vínculo vive no código, e a grafia deixa de importar.
    """
    todas: list[dict] = []
    autores: dict[str, str] = {}

    for ano in anos:
        log.info("Emendas de %d...", ano)
        brutas = emendas.baixar_ano(ano)

        linhas, do_ano = emendas.para_linhas(brutas)
        todas.extend(linhas)
        autores.update(do_ano)

        log.info("  %d emendas, %d autores", len(linhas), len(do_ano))

    gravadas = persistencia.gravar_emendas(conexao, anos, todas)
    persistencia.registrar_autores(conexao, autores)
    log.info("%d emendas gravadas, %d autores conhecidos", gravadas, len(autores))

    _reconciliar_autores(conexao)


def _reconciliar_autores(conexao: psycopg.Connection) -> None:
    """Sugere o vínculo código → pessoa, pelo nome normalizado.

    ⚠️ Roda só sobre quem ainda ⛔ NÃO está resolvido — nunca sobrescreve resolução
    manual.

    ⚠️ **Ambiguidade ⛔ não vira palpite:** se duas pessoas normalizam para o mesmo nome,
    o código fica sem vínculo e aparece na lista de pendências. Chutar seria pior — o
    erro ficaria congelado no código e invisível.
    """
    pendentes = persistencia.autores_nao_resolvidos(conexao)
    if not pendentes:
        log.info("Nenhum autor pendente de reconciliação.")
        return

    # 🔴 TODAS as pessoas, ⛔ não só as com `cpf_hash` — filtrar por ele limitava a
    # reconciliação aos 643 votantes da 57ª e deixava 241 autores soltos, gente que
    # apresentou emenda para 2023 ainda na legislatura anterior (a LOA foi votada em
    # 2022). A ficha já filtra a legislatura corrente, então autoria antiga não polui.
    por_nome: dict[str, list[int]] = {}
    for pessoa_id, nome in conexao.execute(
        "SELECT id, nome_exibicao FROM pessoas"
    ).fetchall():
        por_nome.setdefault(normalizacao.sem_acento_maiusculo(nome), []).append(pessoa_id)

    resolvidos = ambiguos = 0
    for codigo, nome_autor in pendentes:
        candidatos = por_nome.get(normalizacao.sem_acento_maiusculo(nome_autor), [])

        if len(candidatos) == 1:
            persistencia.resolver_autor(conexao, codigo, candidatos[0], "AUTOMATICO")
            resolvidos += 1
        elif len(candidatos) > 1:
            ambiguos += 1

    vinculadas = persistencia.vincular_emendas(conexao)

    log.info(
        "Reconciliação: %d de %d autores resolvidos, %d emendas vinculadas",
        resolvidos, len(pendentes), vinculadas,
    )
    if ambiguos:
        log.warning("  %d autores AMBÍGUOS — dois deputados com o mesmo nome", ambiguos)

    restantes = len(persistencia.autores_nao_resolvidos(conexao))
    if restantes:
        # ⚠️ Pendência é NORMAL: senadores e bancadas nunca terão dono na nossa base.
        log.info(
            "  %d autores seguem sem vínculo (senadores, bancadas, outras legislaturas)",
            restantes,
        )


def pares_de_resolucao(entradas: list[str]) -> list[tuple[str, int]]:
    """Converte `["4184=612"]` em `[("4184", 612)]`.

    🔴 Entrada malformada **estoura**, ⛔ não é ignorada: `--resolver 4184` sem o `=`
    seria descartado em silêncio, e a pessoa concluiria que vinculou quando não vinculou.
    """
    pares: list[tuple[str, int]] = []

    for entrada in entradas:
        codigo, separador, pessoa = entrada.partition("=")
        if not separador or not codigo.strip() or not pessoa.strip():
            raise ValueError(
                f"'{entrada}' não é CODIGO=PESSOA_ID. Ex.: --resolver 4184=612"
            )

        try:
            pares.append((codigo.strip(), int(pessoa)))
        except ValueError:
            raise ValueError(f"'{pessoa}' não é um id de pessoa") from None

    return pares


def _resolver_a_mao(conexao: psycopg.Connection, entradas: list[str]) -> None:
    """PL45 — vincula autor de emenda à mão, a saída dos ambíguos.

    Dois parlamentares com o mesmo nome de urna ⛔ não são separáveis por texto: a
    reconciliação automática desiste de propósito e quem decide é uma pessoa. Fica
    gravado como `MANUAL`, que execução automática posterior ⛔ nunca sobrescreve.
    """
    for codigo, pessoa_id in pares_de_resolucao(entradas):
        pessoa = conexao.execute(
            "SELECT nome_exibicao FROM pessoas WHERE id = %s", (pessoa_id,)
        ).fetchone()

        # A FK pegaria o id inexistente, mas com mensagem do Postgres; aqui dá para
        # dizer o que fazer.
        if not pessoa:
            raise RuntimeError(f"pessoa {pessoa_id} não existe. Confira o id em `pessoas`.")

        autor = conexao.execute(
            "SELECT nome_autor FROM autores_de_emenda WHERE codigo = %s", (codigo,)
        ).fetchone()
        if not autor:
            raise RuntimeError(
                f"código {codigo} não foi visto em nenhuma emenda. Rode `emendas` antes."
            )

        persistencia.resolver_autor(conexao, codigo, pessoa_id, "MANUAL")
        log.info("  %s (%s) -> %s (id %d)", codigo, autor[0], pessoa[0], pessoa_id)

    vinculadas = persistencia.vincular_emendas(conexao)
    log.info("%d emendas vinculadas", vinculadas)


def _cpf(conexao: psycopg.Connection) -> None:
    """Completa `cpf_hash` a partir da API REST da Câmara.

    🔴 **Por que existe um comando só para isto:** a coluna `cpf` do CSV em bloco vem
    VAZIA — 0 de 7.889. O valor só existe em `/api/v2/deputados/{id}`, **uma requisição
    por deputado**.

    ⭐ E vale a viagem: contra a prestação de contas do TSE, o CPF casou **15 de 15**,
    contra 14 de 15 do nome civil.

    ⚠️ O CPF em claro existe apenas **em memória** — o que vai para o banco é o hash.
    """
    faltantes = persistencia.pessoas_sem_cpf(conexao)
    if not faltantes:
        log.info("Todos os deputados com voto já têm cpf_hash.")
        return

    log.info("Buscando CPF de %d deputados...", len(faltantes))

    achados = 0
    for i, (id_camara, pessoa_id) in enumerate(faltantes, 1):
        cpf = camara.cpf_do_deputado(id_camara)
        hash_cpf = normalizacao.hash_de_cpf(cpf)

        if hash_cpf:
            persistencia.gravar_cpf_hash(conexao, pessoa_id, hash_cpf)
            achados += 1

        # ⚠️ Uma pausa curta: são centenas de requisições seguidas contra um serviço
        #    público, e não há motivo para apertá-lo.
        time.sleep(PAUSA_ENTRE_CHAMADAS)

        if i % 100 == 0:
            log.info("  %d de %d...", i, len(faltantes))

    log.info("  %d de %d com CPF", achados, len(faltantes))

    # 🔴 Perda grande significa layout mudado ou bloqueio — ⛔ não "alguns sem CPF".
    if achados < len(faltantes) * 0.8:
        log.warning(
            "  ⚠️ Menos de 80%% dos deputados tinham CPF. A API mudou ou está limitando?"
        )


def _cota(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Cota parlamentar — o gasto de gabinete que vai para a ficha do deputado."""
    mapa = _mapa_pessoas(conexao)
    if not mapa:
        raise RuntimeError(
            "De-para de pessoas vazio. Rode `ingerir` antes: sem ele, nenhuma despesa "
            "encontra dono e tudo seria descartado em silêncio."
        )

    for ano in anos:
        log.info("Cota de %d...", ano)

        arquivo = camara.baixar_cota(ano, CACHE / f"cota-{ano}.zip")
        registros = camara.ler_cota(arquivo)
        camara.conferir_volume_de_cota(registros, ano)

        linhas = cota.para_linhas(registros, mapa)
        gravadas = persistencia.gravar_despesas(conexao, list(mapa.values()), linhas)

        descartadas = len(registros) - len(linhas)
        log.info("  %d linhas, %d gravadas", len(registros), gravadas)

        # ⚠️ O descarte é NORMAL (lideranças, órgãos, valor zero), mas em volume alto
        #    significa de-para incompleto — e aí a ficha mostraria gasto a menos.
        if descartadas:
            log.warning(
                "  %d descartadas: sem `ideCadastro`, fora do de-para, ou valor zero",
                descartadas,
            )


def _fundo(conexao: psycopg.Connection, eleicao: int, arquivo: Path | None) -> None:
    """Financiamento de campanha — o fundão e o resto, ligados por CPF.

    🔴 **Depende de `cpf` ter rodado antes.** Sem `cpf_hash` em `pessoas`, o de-para sai
    vazio e **toda** linha do TSE é descartada — 396 MB lidos para gravar zero, com log
    de sucesso. É exatamente o tipo de falha silenciosa que este projeto já pagou caro.
    """
    hashes = persistencia.mapa_de_cpf_hash(conexao)
    if not hashes:
        raise RuntimeError(
            "Nenhuma pessoa com `cpf_hash`. Rode `cpf` antes: o join com o TSE é por "
            "hash de CPF, e sem ele toda receita seria descartada em silêncio."
        )

    log.info("De-para: %d pessoas com CPF hasheado", len(hashes))

    if arquivo is None:
        url = tse.url_de_prestacao_de_contas(eleicao)
        if not tse.existe(url):
            raise tse.ErroDeAcessoAoTse(
                f"O TSE ⛔ não respondeu para {url}. Se for 403, a receita de headers "
                "caiu; baixe à mão e use --arquivo. Ver docs/12-fonte-tse.md §2.2."
            )
        arquivo = tse.baixar(url, CACHE / f"prestacao-contas-{eleicao}.zip")

    nomes = receitas.nomes_de_receita(arquivo, eleicao)
    if not nomes:
        raise RuntimeError(
            f"Nenhum `receitas_candidatos_{eleicao}_*.csv` dentro de {arquivo.name}. "
            "O layout do ZIP mudou?"
        )

    # Vários arquivos significa que o TSE não publicou o consolidado — e aí o DF fica
    # de fora, ver `receitas.nomes_de_receita`.
    log.info(
        "%d arquivo(s) de receita: %s", len(nomes),
        "consolidado" if len(nomes) == 1 else f"{len(nomes)} estaduais (⛔ sem DF)",
    )

    todas: list[dict] = []
    for nome in nomes:
        linhas = receitas.para_linhas(
            receitas.ler_receitas(arquivo, nome), hashes, eleicao
        )
        todas.extend(linhas)

        if linhas:
            log.info("  %s — %d linhas de deputado federal eleito", nome, len(linhas))

    gravadas = persistencia.gravar_receitas(conexao, eleicao, todas)
    resumo = receitas.resumir(todas)

    log.info(
        "Eleição %d: %d receitas gravadas, %d parlamentares",
        eleicao, gravadas, int(resumo["parlamentares"]),
    )
    # 🔴 Separados pelo mesmo motivo que no banco: somá-los é decisão de quem analisa.
    log.info(
        "  total R$ %.2f · fundo especial (FEFC) R$ %.2f",
        resumo["total"], resumo["fundo_especial"],
    )

    # Casar pouco ⛔ não é erro do TSE, é `cpf` incompleto — e sem o aviso a ficha
    # mostraria financiamento zerado para a maioria, sem ninguém perceber.
    if resumo["parlamentares"] < len(hashes) * 0.5:
        log.warning(
            "  só %d de %d pessoas com CPF casaram. Esperado: a maioria dos eleitos. "
            "Rode `cpf` de novo, ou confira se a eleição %d é a que elegeu a legislatura.",
            int(resumo["parlamentares"]), len(hashes), eleicao,
        )


def _curar(conexao: psycopg.Connection, casa: str, legislatura: int, limite: int) -> None:
    """PL11 — reduz o universo às votações que valem leitura humana.

    Não grava pergunta nenhuma. A polaridade sugerida é auxílio: atribuí-la
    automaticamente é o erro que este projeto persegue, porque um sinal invertido não
    aparece na tela, aparece como número plausível.
    """
    curadas = curadoria.ja_curadas(conexao)
    achadas = curadoria.candidatas(conexao, casa, legislatura, limite)

    if not achadas:
        log.warning(
            "Nenhuma candidata em %s na legislatura %d. Rode a ingestão antes.",
            casa, legislatura,
        )
        return

    log.info("=== %d candidatas em %s, da mais dividida ===", len(achadas), casa)
    log.info("")

    for posicao, candidata in enumerate(achadas, 1):
        marca = "JA CURADA" if candidata.votacao_id in curadas else ""
        log.info(
            "%2d. %-12s %s  %3d x %-3d  divisao %.0f%%  polaridade sugerida %+d  %s",
            posicao, candidata.votacao_id, candidata.data,
            candidata.sim, candidata.nao, candidata.divisao * 100,
            candidata.polaridade_sugerida, marca,
        )
        log.info("    %s", candidata.descricao[:110])

    log.info("")
    log.info("A afirmacao em linguagem leiga e a polaridade FINAL sao leitura humana.")
    log.info("Formato: src/Poligraph.Migrations/curadoria/perguntas-lote-1.json")


def _validar(conexao: psycopg.Connection, legislatura: int, divisao_minima: float) -> None:
    """RF-20 e a validação do questionário. ⛔ Não escreve no banco — é medição."""
    pessoas, votacoes, matriz, _ = _montar_matriz(conexao, legislatura)
    log.info("Matriz: %d pessoas × %d votações", len(pessoas), len(votacoes))

    # ═══ 1. Quantas perguntas bastam ═══
    candidatas = [
        indice
        for indice in range(len(votacoes))
        if validacao.divisao(matriz, indice) >= divisao_minima
    ]
    log.info(
        "%d votações com divisão >= %.2f servem como pergunta",
        len(candidatas),
        divisao_minima,
    )

    log.info("")
    log.info("  perguntas | empate mediano no topo | sozinhos no topo")
    for ponto in validacao.curva_de_discriminacao(
        matriz, candidatas, [4, 6, 8, 10, 12, 16, 22, 30, 40]
    ):
        log.info(
            "  %9d | %22.0f | %5.1f%% (%d de %d)",
            ponto.n_perguntas,
            ponto.empate_mediano,
            ponto.taxa_unicos * 100,
            ponto.unicos,
            ponto.deputados_avaliados,
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

    rede = grafo.montar(list(comunidade_de), arestas)
    resultado = comparacao.comparar(rede, comunidade_de, partido_de)

    log.info("")
    log.info("=== Comunidade de voto x partido - %d deputados ===", resultado.n_pessoas)
    log.info("  %d comunidades detectadas, %d partidos", resultado.n_comunidades, resultado.n_partidos)
    log.info("  ARI (coincidência entre as duas): %.3f", resultado.ari)
    log.info("  Modularidade da comunidade: %.3f", resultado.modularidade_comunidade)
    log.info("  Modularidade do partido:    %.3f", resultado.modularidade_partido)
    log.info(
        "  → %s descreve melhor a estrutura de voto.",
        "A COMUNIDADE" if resultado.comunidade_descreve_melhor else "O PARTIDO",
    )


def _comparar_desempates(matriz, candidatas: list[int], base_inicial: int = 12) -> None:
    """Dirigido × aleatório, sobre uma amostra de deputados.

    🔴 O grupo de controle é o que faz isto valer como evidência. Sem ele, o encolhimento
    do empate poderia vir apenas de perguntar mais — e a "contribuição técnica" seria
    só um contador de perguntas.
    """
    sorteio = np.random.default_rng(20260826)
    base = sorted(sorteio.choice(candidatas, size=base_inicial, replace=False).tolist())
    restantes = [candidata for candidata in candidatas if candidata not in base]

    # ⚠️ Amostra de deputados, não todos: são 655 × 6 rodadas × duas estratégias.
    quem_avaliar = sorteio.choice(matriz.shape[0], size=120, replace=False)

    def media_por_rodada(dirigido: bool) -> list[float]:
        series = [
            validacao.simular_desempate(
                matriz, int(pessoa), base, restantes, rodadas=6, dirigido=dirigido
            )
            for pessoa in quem_avaliar
        ]
        # ⚠️ Séries têm comprimentos diferentes: quem chega a 1 para antes. O último
        #    valor é repetido para a média não subir artificialmente ao perdê-los.
        mais_longa = max(len(serie) for serie in series)
        return [
            float(np.mean([serie[min(rodada, len(serie) - 1)] for serie in series]))
            for rodada in range(mais_longa)
        ]

    dirigido = media_por_rodada(True)
    aleatorio = media_por_rodada(False)

    log.info("")
    log.info("=== Desempate: dirigido x aleatorio (base de %d perguntas) ===", base_inicial)
    log.info("  perguntas extras | dirigido | aleatório")
    for extras, (com_direcao, ao_acaso) in enumerate(zip(dirigido, aleatorio)):
        log.info("  %16d | %8.1f | %9.1f", extras, com_direcao, ao_acaso)


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


def _votacoes_por_pessoa(matriz, pessoas: list[int], pesos) -> dict[int, int]:
    """Quantas votações cada pessoa efetivamente pesou.

    ⚠️ Conta só posicionamento (Sim ou Não). Ausência e abstenção ficam de fora, pelo
    mesmo motivo do cálculo de afinidade: quem não se posicionou não discordou.

    🔴 **E só as de peso maior que zero.** PROCEDIMENTAL tem peso 0 e ⛔ não entra em
    nenhuma conta de similaridade — contá-la aqui produz um número que a tela exibe e
    o método ⛔ não usou.

    ⚠️ Medido: o Soldado Noelio aparecia com **40 votações** e nenhuma ligação, e 24
    daquelas 40 eram procedimentais. Um leitor olharia "40 votações" ao lado do mínimo
    de 20 e concluiria, com razão, que o corte estava errado — quando o que ele tinha
    eram 16. Número exibido que ⛔ não é o número usado é o modo de falha deste projeto.
    """
    posicionou = (~np.isnan(matriz)) & (matriz != 0) & (pesos > 0)

    return {pessoa: int(posicionou[i].sum()) for i, pessoa in enumerate(pessoas)}


def _mapa_pessoas(conexao: psycopg.Connection, fonte: str = "CAMARA") -> dict[str, int]:
    """`id_externo` -> `pessoa_id`, por fonte.

    A fonte é parâmetro porque a mesma pessoa pode ter id nas duas casas: 41 dos 81
    senadores já foram deputados (achado #18). Misturar as duas faria o voto de senador
    procurar dono entre ids da Câmara e ser descartado inteiro.
    """
    linhas = conexao.execute(
        "SELECT id_externo, pessoa_id FROM pessoa_fonte_ids WHERE fonte = %s", (fonte,)
    ).fetchall()
    return {str(externo): pessoa_id for externo, pessoa_id in linhas}


def _montar_matriz(conexao: psycopg.Connection, legislatura: int, casa: str = "CAMARA"):
    """Monta a matriz pessoa × votação de UMA casa.

    Só votações nominais de plenário, e não secretas. Votação de comissão fica de fora:
    é 3× mais consensual que plenário (39% contra 12% de quase unanimidade), e misturá-la
    achataria a similaridade. No Senado o filtro de sigilo é o que mais corta — 239 das
    421 votações da legislatura.

    A casa é parâmetro, e nunca uma matriz só: as duas casas não votam as mesmas
    matérias, então similaridade entre deputado e senador não teria denominador
    (achado #7). São dois grafos independentes.
    """
    votacoes = conexao.execute(
        """
        SELECT id, categoria, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM data)
          FROM votacoes
         WHERE casa = %s AND legislatura = %s AND plenario AND NOT secreta
         ORDER BY id
        """,
        (casa, legislatura),
    ).fetchall()

    # As pessoas saem dos votos DESTA casa. Sem o recorte, a matriz ganharia 643
    # deputados de linhas inteiramente vazias ao analisar o Senado — e o kNN passaria a
    # comparar quem não tem voto em comum nenhum.
    pessoas = [
        linha[0]
        for linha in conexao.execute(
            """
            SELECT DISTINCT v.pessoa_id
              FROM votos v JOIN votacoes vt ON vt.id = v.votacao_id
             WHERE vt.casa = %s AND vt.legislatura = %s
             ORDER BY 1
            """,
            (casa, legislatura),
        ).fetchall()
    ]

    indice_votacao = {votacao[0]: ordem for ordem, votacao in enumerate(votacoes)}
    indice_pessoa = {pessoa: ordem for ordem, pessoa in enumerate(pessoas)}

    matriz = np.full((len(pessoas), len(votacoes)), np.nan)
    for votacao_id, pessoa_id, valor in conexao.execute(
        """
        SELECT v.votacao_id, v.pessoa_id, v.valor
          FROM votos v JOIN votacoes vt ON vt.id = v.votacao_id
         WHERE v.valor IS NOT NULL AND vt.casa = %s AND vt.legislatura = %s
        """,
        (casa, legislatura),
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
