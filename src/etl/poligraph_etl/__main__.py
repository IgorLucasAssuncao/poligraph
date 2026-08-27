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
    comparacao, cota, emendas, grafo, ingestao, normalizacao, persistencia,
    receitas, similaridade, validacao,
)
from .fontes import camara, tse

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

    sub.add_parser("cpf", help="busca o CPF dos deputados com voto e grava o HASH")

    emd = sub.add_parser("emendas", help="ingere emendas parlamentares (Portal)")
    emd.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    # ⭐ A porta de entrada da reconciliação MANUAL. Sem ela, `metodo = 'MANUAL'` seria
    #    um valor que o `CHECK` admite e ⛔ nada jamais grava — e os 9 autores ambíguos
    #    ficariam sem saída, porque ambiguidade ⛔ não pode virar palpite automático.
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

    # 🔴 **Todas as pessoas**, ⛔ não só as que têm `cpf_hash`.
    #
    # ⚠️ A primeira versão filtrava por `cpf_hash IS NOT NULL`, o que na prática limitava
    # a reconciliação aos 643 que votaram na legislatura 57. Medido no dado real: **241
    # autores** que casavam por nome ficaram sem vínculo por causa disso — Angela Amin
    # (legislatura 56), Tadeu Alencar, e outros que **apresentaram emenda para o exercício
    # de 2023 ainda na legislatura anterior**, o que é o caso normal: a LOA de 2023 foi
    # votada em 2022.
    #
    # ⭐ O `cpf_hash` ⛔ nada tem a ver com casamento por nome — era um recorte acidental.
    # A ficha do parlamentar já filtra a legislatura corrente (PL35), então vincular
    # autoria antiga ⛔ não polui tela nenhuma; deixá-la solta é que perdia informação.
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
    """Converte `["4184=612", "3767=91"]` em `[("4184", 612), ("3767", 91)]`.

    🔴 **Entrada malformada estoura**, ⛔ não é ignorada. Um `--resolver 4184` sem o `=`
    seria silenciosamente descartado, e a pessoa concluiria que vinculou quando ⛔ não
    vinculou — o mesmo formato de falha que este projeto persegue.
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
    """PL45 — vincula autor de emenda à mão.

    ⭐ **É a saída dos 9 ambíguos.** Dois parlamentares com o mesmo nome de urna ⛔ não
    são separáveis por texto; a reconciliação automática desiste de propósito, e quem
    decide é uma pessoa — que fica registrada como `MANUAL`.

    ⚠️ `MANUAL` ⛔ nunca é sobrescrito por execução automática posterior, e a coluna
    `metodo` é o que torna essa procedência auditável no TCC.
    """
    for codigo, pessoa_id in pares_de_resolucao(entradas):
        existe = conexao.execute(
            "SELECT nome_exibicao FROM pessoas WHERE id = %s", (pessoa_id,)
        ).fetchone()

        # 🔴 Confere ANTES de gravar. A FK pegaria o id inexistente, mas com uma
        #    mensagem do Postgres — e aqui dá para dizer o que fazer.
        if not existe:
            raise RuntimeError(f"pessoa {pessoa_id} não existe. Confira o id em `pessoas`.")

        autor = conexao.execute(
            "SELECT nome_autor FROM autores_de_emenda WHERE codigo = %s", (codigo,)
        ).fetchone()
        if not autor:
            raise RuntimeError(
                f"código {codigo} não foi visto em nenhuma emenda. Rode `emendas` antes."
            )

        persistencia.resolver_autor(conexao, codigo, pessoa_id, "MANUAL")
        log.info("  %s (%s) → %s (id %d)", codigo, autor[0], existe[0], pessoa_id)

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

        arquivo = cota.baixar(ano, CACHE / f"cota-{ano}.zip")
        registros = cota.ler(arquivo)
        cota.conferir_volume(registros, ano)

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
    vazio e **toda** linha do TSE é descartada — 377 MB lidos para gravar zero, com log
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

    # ⚠️ Normalmente é UM arquivo: o consolidado. Vários significa que o TSE ⛔ não
    #    publicou o consolidado naquele ano — e aí o DF fica de fora, ver `receitas`.
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
    # 🔴 Fundo Especial (o "fundão") e Fundo Partidário são fundos DIFERENTES — o log
    #    os separa pelo mesmo motivo que o banco: somá-los é decisão de quem analisa.
    log.info(
        "  total R$ %.2f · fundo especial (FEFC) R$ %.2f",
        resumo["total"], resumo["fundo_especial"],
    )

    # ⚠️ Casar muito pouco ⛔ não é erro do TSE — é `cpf` incompleto. Sem este aviso, a
    #    ficha mostraria financiamento zerado para a maioria e ninguém perceberia.
    if resumo["parlamentares"] < len(hashes) * 0.5:
        log.warning(
            "  só %d de %d pessoas com CPF casaram. Esperado: a maioria dos eleitos. "
            "Rode `cpf` de novo, ou confira se a eleição %d é a que elegeu a legislatura.",
            int(resumo["parlamentares"]), len(hashes), eleicao,
        )


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
