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
from datetime import date
from pathlib import Path

import numpy as np
import psycopg
import requests

from . import conexao as conexao_mod
from . import (
    arrecadacao, comparacao, cota, curadoria, emendas, gestao, grafo, ingestao,
    ingestao_senado, municipios, normalizacao, orcamento, orientacoes,
    persistencia, proposicoes, receitas, sigilo, similaridade, validacao,
)
from .fontes import camara, portal, receita, senado, tse
from . import conferencia, convenentes, patrimonio, redes

log = logging.getLogger("poligraph")

CACHE = Path(os.environ.get("POLIGRAPH_CACHE", ".cache"))

# ⚠️ Segundos entre chamadas na busca de CPF — são centenas contra serviço público.
PAUSA_ENTRE_CHAMADAS = 0.15

# 🔴 Abaixo disto a legislatura fica SEM grafo, e a tela ⛔ a oferece.
#
# 📐 O discovery (§4.1.1.1) mediu o intervalo de confiança da concordância de um par:
#    ~±17 pp com 56 votações, ~±10 pp com 182. Com 100 fica em ~±13 pp. Abaixo disso
#    o desenho separaria gente por ruído, e um grafo errado com cara de medida é pior
#    que nenhum. Conta só o que entra na matriz: plenário, nominal, aberta.
VOTACOES_MINIMAS_PARA_GRAFO = 100


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
            elif args.comando == "governo":
                _governo(conexao, args.anos, args.eleicao)
            elif args.comando == "convenios":
                _convenios(conexao)
            elif args.comando == "patrimonio":
                _patrimonio(conexao, args.anos)
            elif args.comando == "redes":
                _redes(conexao, args.anos)
            elif args.comando == "municipios":
                _municipios(conexao, args.diretorio)
            elif args.comando == "cpf":
                _cpf(conexao)
            elif args.comando == "cota":
                _cota(conexao, args.anos)
            elif args.comando == "fundo":
                _fundo(conexao, args.eleicao, args.arquivo)
            elif args.comando == "conferir":
                _conferir(conexao)
            elif args.comando == "validar":
                _validar(conexao, args.legislatura, args.divisao_minima)
            else:
                for legislatura in _legislaturas_a_analisar(conexao, args):
                    _analisar(conexao, legislatura, args.casa)
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
    # ⭐ Sem legislatura, a CORRENTE — a maior em `votacoes`, ⛔ um 57 fixo que
    #    ficaria velho na posse da 58ª.
    analisar.add_argument("--legislatura", type=int, nargs="+", default=[])
    analisar.add_argument(
        "--todas", action="store_true",
        help="todas as legislaturas da casa que estão na base",
    )
    analisar.add_argument(
        "--casa", choices=["CAMARA", "SENADO"], default="CAMARA",
        help="uma casa por execução — as duas não são comparáveis entre si",
    )

    sub.add_parser("cpf", help="completa o cpf_hash das duas casas (Câmara: API; Senado: TSE)")

    sub.add_parser(
        "convenios",
        help="completa CNPJ do convenente, situação e liberado dos convênios de emenda (Portal)",
    )
    pat = sub.add_parser("patrimonio", help="bens declarados ao TSE, por tipo — ⛔ a descrição")
    pat.add_argument("--anos", type=int, nargs="+", default=[2018, 2022])
    red = sub.add_parser("redes", help="redes sociais: Câmara para deputados, TSE para senadores")
    red.add_argument("--anos", type=int, nargs="+", default=[2018, 2022],
                     help="eleições do TSE para os senadores; vale a mais recente de cada um")

    mun = sub.add_parser(
        "municipios",
        help="liga quem recebeu emenda à cidade da sede, por CNPJ → TOM → IBGE (Receita)",
    )
    # ⚠️ ~6 GB por mês. Uma pasta já baixada evita rebaixar o cadastro inteiro.
    mun.add_argument("--diretorio", type=Path, default=None,
                     help="pasta com Estabelecimentos0..9.zip já baixados")

    gov = sub.add_parser(
        "governo",
        help="ingere quem governa (TSE), o orçamento, o pago e a arrecadação (Portal)",
    )
    gov.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    # ⚠️ Ano da ELEIÇÃO presidencial, ⛔ do mandato: 2022 elegeu a gestão 2023–2026.
    gov.add_argument("--eleicao", type=int, default=2022)

    emd = sub.add_parser(
        "emendas", help="ingere emendas, favorecidos e convênios (Portal)"
    )
    emd.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    # A porta da reconciliação MANUAL: sem ela os autores ambíguos ficam sem saída,
    # porque ambiguidade ⛔ não pode virar palpite automático.
    emd.add_argument(
        "--resolver",
        nargs="+",
        default=[],
        metavar="CODIGO=ID_NA_CAMARA",
        help=(
            "vincula autores à mão, ex.: --resolver 4184=204521. "
            "⚠️ O segundo valor é o id NA CÂMARA — `pessoas.id` muda a cada reingestão"
        ),
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

    sub.add_parser(
        "conferir",
        help="regras de plausibilidade sobre o que está no banco; falha se houver ERRO",
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

        # 🔴 Canário do classificador por texto — ver `descricoes_nao_reconhecidas`.
        #    ⚠️ Frase nova ⛔ não derruba a ingestão, mas ⛔ não passa em silêncio: sem
        #    isto, uma mudança de redação na fonte mandaria tudo para SUBSTANTIVA.
        orfas = normalizacao.descricoes_nao_reconhecidas(
            linha["descricao"] for linha in votacoes
        )
        if orfas:
            log.warning(
                "  %d descrições que nenhum padrão de categoria reconhece — a 1ª: %s",
                len(orfas), (orfas[0] or "")[:90],
            )

        # 🔴 Cruzamento com o ÚNICO sinal estruturado que a fonte dá sobre o tipo do
        #    voto: a sigla no começo de `ultimaAberturaVotacao_descricao`.
        #
        # ⚠️ ⛔ NÃO corrige a categoria — o campo é da última abertura da SESSÃO, ⛔ não
        #    da votação. Serve para a divergência aparecer, e foi assim que a votação
        #    2613731-65 ("Resultado. Sim: 182; Não: 182") se revelou um destaque de
        #    emenda depois de já ter virado pergunta.
        aberturas = dict(
            zip(df["id"], df.get("ultimaAberturaVotacao_descricao", []), strict=False)
        )
        divergentes = normalizacao.divergencias_de_destaque(
            {**linha, "abertura": aberturas.get(linha["id"])} for linha in votacoes
        )
        if divergentes:
            log.warning(
                "  %d votações que a fonte abre como DTQ e nós ⛔ não classificamos como "
                "DESTAQUE — confira antes de curar. A 1ª: %s",
                len(divergentes), divergentes[0][0],
            )

        # ⚠️ A votação entra SEM proposição: ela é ingerida antes de a proposição
        #    existir, e a FK recusaria a linha. O vínculo vem logo abaixo.
        persistencia.desconectar_proposicoes_ausentes(conexao, votacoes)
        persistencia.gravar_votacoes(conexao, votacoes)
        log.info("  %d registros, %d votações nominais", len(df), len(votacoes))

        # ⭐ A ementa é o que destrava a curadoria (PL11): a DESCRIÇÃO da votação diz o
        #    número do projeto e ⛔ não diz sobre o que ele é.
        arquivo_prop = camara.baixar(
            "votacoesProposicoes", ano, CACHE / f"votacoesProposicoes-{ano}.csv"
        )
        lista, vinculo = proposicoes.para_linhas(
            camara.ler_csv(arquivo_prop).to_dict("records"),
            {v["id"] for v in votacoes},
        )
        persistencia.gravar_proposicoes(conexao, lista)
        vinculadas = persistencia.vincular_proposicoes(conexao, vinculo)
        log.info(
            "  %d proposições, %d votações vinculadas (%d sem ementa)",
            len(lista), vinculadas,
            sum(1 for p in lista if not p["ementa"]),
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
        # 📐 A Câmara ⛔ publica orientações de 2001 e 2002: 404, conferido em
        #    2026-10-01 (achado #35). Sem elas o ano entra inteiro, e só `governismo` e
        #    `disciplina` ficam nulos — que é o que já acontece no Senado inteiro.
        try:
            arquivo_orientacoes = camara.baixar(
                "votacoesOrientacoes", ano, CACHE / f"votacoesOrientacoes-{ano}.csv"
            )
        except requests.HTTPError as erro:
            if erro.response is None or erro.response.status_code != 404:
                raise
            log.warning("  %d sem orientações de bancada publicadas (404)", ano)
            continue
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

        votacoes_brutas, fora = ingestao_senado.separar_fora_de_epoca(
            senado.baixar_votacoes(ano)
        )
        if fora:
            apagadas = persistencia.apagar_votacoes(
                conexao, [ingestao_senado.id_da_votacao(v) for v in fora]
            )
            log.warning(
                "  %d votações FORA DE ÉPOCA descartadas: o código é de outra numeração "
                "que a data (achado #37). %d já gravadas por carga anterior, apagadas.",
                len(fora), apagadas,
            )

        # ⭐ Depois do descarte: o volume que importa é o do ano de verdade.
        senado.conferir_volume(votacoes_brutas, ano)

        # A lista de exercício só tem quem está hoje; os votos alcançam quem saiu,
        # licenciou-se ou devolveu a cadeira. Criá-los a partir do próprio voto evita
        # descartar 10,5% da base por falta de dono.
        anteriores = ingestao_senado.senadores_dos_votos(
            votacoes_brutas, ja_conhecidos={s["id_externo"] for s in senadores}
        )
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

        _materias_do_senado(conexao, votacoes_brutas)

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
    log.info(
        "Matriz %s %dª: %d pessoas × %d votações",
        casa, legislatura, len(pessoas), len(votacoes),
    )

    if len(pessoas) < 2:
        log.warning("Menos de duas pessoas com voto — nada a calcular.")
        return

    if len(votacoes) < VOTACOES_MINIMAS_PARA_GRAFO:
        log.warning(
            "  %s %dª fica SEM grafo: %d votações de plenário abertas, o mínimo é %d.",
            casa, legislatura, len(votacoes), VOTACOES_MINIMAS_PARA_GRAFO,
        )
        return

    execucao_id = persistencia.abrir_execucao(
        conexao, casa, legislatura, similaridade.K_VIZINHOS, "v1",
        similaridade.parametros(),
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


def _legislaturas_a_analisar(conexao: psycopg.Connection, args) -> list[int]:
    """As pedidas; com `--todas`, as da casa na base; sem nada, a corrente."""
    if args.todas:
        return [
            linha[0]
            for linha in conexao.execute(
                "SELECT DISTINCT legislatura FROM votacoes WHERE casa = %s ORDER BY 1",
                (args.casa,),
            ).fetchall()
        ]

    if args.legislatura:
        return args.legislatura

    corrente = conexao.execute("SELECT max(legislatura) FROM votacoes").fetchone()[0]
    return [corrente] if corrente is not None else []


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
    partido_por_voto: dict[int, dict[str, str]] = {}
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
        partido_por_voto.setdefault(pessoa_id, {})[votacao_id] = partido

    metricas = []
    for pessoa_id in pessoas:
        votos = votos_por_pessoa.get(pessoa_id) or {}
        if not votos:
            continue

        segue_gov, base_gov = orientacoes.alinhamento(
            votos, por_votacao, orientacoes.BANCADA_DO_GOVERNO
        )
        segue_part, base_part = orientacoes.disciplina(
            votos, por_votacao, partido_por_voto.get(pessoa_id) or {}
        )

        # ⛔ Sem base, NULO — ⛔ nunca zero. Zero afirmaria "nunca seguiu o governo",
        #    e o que houve foi não haver votação comparável.
        metricas.append(
            {
                "pessoa_id": pessoa_id,
                "governismo": segue_gov / base_gov if base_gov else None,
                "disciplina": segue_part / base_part if base_part else None,
                # ⭐ A base vai junto: a API a lia por conta própria, com a regra antiga
                #    de sigla exata, e mostraria um percentual novo sobre a base velha.
                "base_disciplina": base_part or None,
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

    ⚠️ O arquivo é regerado todo dia, então o cache leva a data: o de ontem ⛔ serve.
    E emendas, favorecidos e convênios trocam **juntos**, numa transação — uma falha no
    meio deixaria a ficha com o favorecido de hoje e a emenda de ontem.
    """
    arquivo = portal.baixar(
        emendas.RECURSO, CACHE / f"emendas-{date.today():%Y%m%d}.zip"
    )

    linhas, autores = emendas.para_linhas(
        portal.ler_csv(arquivo, emendas.ARQUIVO_EMENDAS), anos
    )
    codigos = {linha["codigo_emenda"] for linha in linhas}
    log.info("  %d linhas, %d emendas, %d autores", len(linhas), len(codigos), len(autores))

    favorecidos = emendas.favorecidos_para_linhas(
        portal.ler_csv(arquivo, emendas.ARQUIVO_FAVORECIDOS), codigos
    )
    convenios, ligacoes = emendas.convenios_para_linhas(
        portal.ler_csv(arquivo, emendas.ARQUIVO_CONVENIOS), codigos
    )

    with conexao.transaction():
        gravadas = persistencia.gravar_emendas(conexao, anos, linhas)
        persistencia.registrar_autores(conexao, autores)
        persistencia.gravar_favorecidos(conexao, anos, favorecidos)
        persistencia.gravar_convenios(conexao, anos, convenios, ligacoes)

    log.info(
        "%d linhas de emenda, %d pagamentos a favorecidos, %d convênios (%d ligações)",
        gravadas, len(favorecidos), len(convenios), len(ligacoes),
    )

    _reconciliar_autores(conexao)


def _governo(conexao: psycopg.Connection, anos: list[int], eleicao: int) -> None:
    """O perfil do governo federal: quem governa, quanto gastou e de onde veio o dinheiro.

    É **contexto** da legislatura, ⛔ medida de afinidade, e ⛔ liga a parlamentar.

    ⚠️ Os arquivos do ano corrente mudam todo dia; os dos anos fechados, ⛔. O cache
    leva a data nos do ano corrente e ⛔ nos fechados — os meses de execução são 48
    arquivos de ~10 MB, e rebaixá-los todo dia seria meio gigabyte por nada.
    """
    zip_tse = tse.baixar(
        f"{tse.CDN}/{gestao.RECURSO.format(eleicao=eleicao)}",
        CACHE / f"consulta-cand-{eleicao}.zip",
    )
    gestao_eleita = gestao.eleitos(gestao.ler(zip_tse, eleicao))
    log.info("  gestão %d–%d: %s (%s) e %s (%s)",
             gestao_eleita["primeiro_ano"], gestao_eleita["ultimo_ano"],
             gestao_eleita["presidente_nome_de_urna"], gestao_eleita["presidente_partido"],
             gestao_eleita["vice_nome_de_urna"], gestao_eleita["vice_partido"])

    funcoes: list[dict] = []
    encargos: list[dict] = []
    receitas_do_periodo: list[dict] = []
    sigilosos: list[dict] = []

    for ano in anos:
        sufixo = f"-{date.today():%Y%m%d}" if ano >= date.today().year else ""

        arquivo = portal.baixar(
            orcamento.RECURSO.format(ano=ano), CACHE / f"orcamento-{ano}{sufixo}.zip"
        )
        membro = orcamento.arquivo(ano)
        tabela = portal.ler_csv(arquivo, membro)
        do_ano = orcamento.para_linhas(tabela, portal.gerado_em(arquivo, membro))
        encargos_do_ano = orcamento.encargos_para_linhas(tabela)

        restos = _restos_a_pagar_do_ano(ano)
        for linha in do_ano:
            linha["restos_a_pagar_pagos"] = round(restos["por_funcao"].get(linha["codigo_funcao"], 0.0), 2)
        for linha in encargos_do_ano:
            linha["restos_a_pagar_pagos"] = round(restos["por_subfuncao"].get(linha["codigo_subfuncao"], 0.0), 2)

        pago_anual = sum(linha["pago"] for linha in do_ano)
        if restos["meses"] == 12 and abs(restos["pago"] - pago_anual) > 1e9:
            log.warning("  %d: pago mensal R$ %.1f bi ≠ anual R$ %.1f bi — os arquivos divergem",
                        ano, restos["pago"] / 1e9, pago_anual / 1e9)

        log.info("  %d: %d funções; restos a pagar pagos R$ %.1f bi (%d meses)",
                 ano, len(do_ano), sum(restos["por_funcao"].values()) / 1e9, restos["meses"])

        cartao, meses_do_cartao = _cartao_do_ano(ano)
        do_sigilo = sigilo.para_linhas(ano, cartao, meses_do_cartao, restos["sigilosas"], restos["meses"])
        log.info("  %d: cartão sigiloso R$ %.1f mi (%d meses); ação sigilosa R$ %.1f mi", ano,
                 sum(l["sigiloso"] for l in do_sigilo if l["origem"] == "CARTAO_CORPORATIVO") / 1e6,
                 meses_do_cartao,
                 sum(l["sigiloso"] for l in do_sigilo if l["origem"] == "ACAO_SIGILOSA") / 1e6)
        sigilosos.extend(do_sigilo)
        funcoes.extend(do_ano)
        encargos.extend(encargos_do_ano)

        arquivo_receita = portal.baixar(
            arrecadacao.RECURSO.format(ano=ano), CACHE / f"receitas-{ano}{sufixo}.zip"
        )
        membro_receita = arrecadacao.arquivo(ano)
        receitas_do_periodo.extend(arrecadacao.para_linhas(
            portal.ler_csv(arquivo_receita, membro_receita),
            portal.gerado_em(arquivo_receita, membro_receita),
        ))

    with conexao.transaction():
        persistencia.gravar_gestao(conexao, gestao_eleita)
        persistencia.gravar_orcamento(conexao, anos, funcoes)
        persistencia.gravar_encargos(conexao, anos, encargos)
        persistencia.gravar_arrecadacao(conexao, anos, receitas_do_periodo)
        persistencia.gravar_sigilosos(conexao, anos, sigilosos)


def _convenios(conexao: psycopg.Connection) -> None:
    """O CNPJ de quem assinou cada convênio de emenda — rode depois de `emendas`."""
    numeros = persistencia.numeros_de_convenio(conexao)
    if not numeros:
        log.warning("Nenhum convênio no banco — rode `emendas` antes.")
        return

    data = convenentes.ultimo_retrato()
    arquivo = portal.baixar(convenentes.RECURSO.format(data=data), CACHE / f"convenios-{data}.zip")
    linhas = convenentes.ler(arquivo, numeros)
    log.info("  retrato de %s: %d de %d convênios achados, %d com CNPJ", data, len(linhas), len(numeros),
             sum(1 for linha in linhas if linha["cnpj_convenente"]))

    with conexao.transaction():
        persistencia.gravar_convenentes(conexao, linhas)


def _patrimonio(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Bens declarados ao TSE, por tipo. Rode depois de `cpf`: a ponte é o `cpf_hash`."""
    hashes = persistencia.hashes_de_pessoas(conexao)
    todas: list[dict] = []
    for ano in anos:
        candidatos = tse.baixar(f"{tse.CDN}/{patrimonio.RECURSO_CANDIDATOS.format(ano=ano)}",
                                CACHE / f"consulta-cand-{ano}.zip")
        ligadas = patrimonio.candidaturas(candidatos, hashes)
        bens = tse.baixar(f"{tse.CDN}/{patrimonio.RECURSO_BENS.format(ano=ano)}", CACHE / f"bem-candidato-{ano}.zip")
        linhas = patrimonio.bens_para_linhas(patrimonio.linhas_do_zip(bens), ligadas, ano)
        log.info("  %d: %d candidaturas ligadas, %d pessoas com bem declarado", ano, len(ligadas),
                 len({linha["pessoa_id"] for linha in linhas}))
        todas.extend(linhas)

    with conexao.transaction():
        persistencia.gravar_patrimonios(conexao, anos, todas)


def _redes(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Redes sociais: a Câmara para deputados, o TSE (candidatura) para senadores."""
    consultados: list[int] = []
    da_camara: list[dict] = []
    for i, (id_camara, pessoa_id) in enumerate(persistencia.deputados_da_legislatura(conexao), 1):
        urls = camara.redes_do_deputado(id_camara)
        if urls is not None:
            consultados.append(pessoa_id)
            da_camara.extend(redes.para_linhas(pessoa_id, urls, "CAMARA"))
        if i % 100 == 0:
            log.info("  %d deputados consultados", i)
        time.sleep(0.05)
    log.info("  Câmara: %d deputados, %d redes", len(consultados), len(da_camara))

    # O TSE da eleição MAIS RECENTE de cada senador: por isso os anos vão do último ao primeiro.
    senadores = persistencia.senadores_da_legislatura(conexao)
    hashes = {h: p for h, p in persistencia.hashes_de_pessoas(conexao).items() if p in senadores}
    do_tse: dict[int, list[dict]] = {}
    for ano in sorted(anos, reverse=True):
        candidatos = tse.baixar(f"{tse.CDN}/{patrimonio.RECURSO_CANDIDATOS.format(ano=ano)}",
                                CACHE / f"consulta-cand-{ano}.zip")
        ligadas = patrimonio.candidaturas(candidatos, hashes, {"5"})
        arquivo = tse.baixar(f"{tse.CDN}/{redes.RECURSO_TSE.format(ano=ano)}", CACHE / f"rede-social-{ano}.zip")
        por_pessoa: dict[int, list[str]] = {}
        for linha in patrimonio.linhas_do_zip(arquivo):
            pessoa = ligadas.get(linha.get("SQ_CANDIDATO"))
            if pessoa is not None and pessoa not in do_tse:
                por_pessoa.setdefault(pessoa, []).append(redes.url_da_linha(linha))
        for pessoa, urls in por_pessoa.items():
            do_tse[pessoa] = redes.para_linhas(pessoa, urls, "TSE")
    log.info("  TSE: %d senadores com rede", len(do_tse))

    with conexao.transaction():
        persistencia.gravar_redes(conexao, consultados, da_camara, "CAMARA")
        persistencia.gravar_redes(conexao, list(senadores), [l for ls in do_tse.values() for l in ls], "TSE")


def _municipios(conexao: psycopg.Connection, diretorio: Path | None) -> None:
    """A cidade da sede de cada CNPJ que recebeu emenda — só por chave forte.

    ⚠️ Rode depois de `emendas`: os CNPJs procurados são os que estão em
    `emendas_favorecidos`. Sem eles, o cadastro inteiro é lido para gravar nada.
    """
    tabela = receita.ler_tabela_tom(receita.baixar_tabela_tom(CACHE / "receita-municipios.csv"))
    linhas_municipios = municipios.municipios_para_linhas(tabela)
    tom_para_ibge = {m["codigo_tom"]: m["codigo_ibge"] for m in linhas_municipios}
    log.info("  %d municípios na tabela TOM ↔ IBGE", len(linhas_municipios))

    alvos = persistencia.cnpjs_que_receberam_emenda(conexao)
    if not alvos:
        log.warning("Nenhum CNPJ em emendas_favorecidos — rode `emendas` antes.")
        return

    pasta = receita.ultima_pasta()
    if diretorio:
        arquivos = [diretorio / nome for nome in receita.ARQUIVOS_DE_ESTABELECIMENTOS]
    else:
        arquivos = [
            receita.baixar(pasta, nome, CACHE / "receita" / pasta / nome)
            for nome in receita.ARQUIVOS_DE_ESTABELECIMENTOS
        ]

    sedes = municipios.sedes_para_linhas(receita.sedes(arquivos, alvos), tom_para_ibge, pasta)
    log.info("  %d de %d CNPJs com município IBGE", len(sedes), len(alvos))

    with conexao.transaction():
        persistencia.gravar_municipios(conexao, linhas_municipios)
        persistencia.gravar_cnpjs_municipio(conexao, sedes)


def _restos_a_pagar_do_ano(ano: int) -> dict:
    """Soma os arquivos mensais de execução do ano.

    ⚠️ No ano corrente, o mês que o Portal ainda ⛔ publicou devolve erro: a soma para no
    último publicado, e `meses` diz até onde foi.
    """
    hoje = date.today()
    meses: list[dict] = []
    sigilosas: list[dict] = []

    for mes in range(1, 13):
        if (ano, mes) > (hoje.year, hoje.month):
            break

        sufixo = f"-{hoje:%Y%m%d}" if (ano, mes) >= (hoje.year, hoje.month - 1) else ""
        try:
            arquivo = portal.baixar(
                orcamento.EXECUCAO.format(ano=ano, mes=mes),
                CACHE / f"execucao-{ano}{mes:02d}{sufixo}.zip",
            )
        except requests.HTTPError as erro:
            # 🔴 Só 403 e 404 querem dizer "ainda ⛔ publicado". O 405 que sobra depois
            #    das tentativas é limite de taxa: tratá-lo como fim do ano gravaria 4
            #    meses como se fossem o ano até agora — aconteceu na primeira carga.
            if erro.response is None or erro.response.status_code not in (403, 404):
                raise
            log.info("  %d/%02d ainda não publicado — a soma do ano para aqui", ano, mes)
            break

        tabela = portal.ler_csv(
            arquivo, orcamento.arquivo_de_execucao(ano, mes),
            colunas=orcamento.COLUNAS_DE_EXECUCAO + sigilo.COLUNAS_DA_ACAO,
        )
        meses.append(orcamento.restos_a_pagar_do_mes(tabela))
        sigilosas.append(sigilo.acoes_do_mes(tabela))

    return {**orcamento.somar_meses(meses), "meses": len(meses), "sigilosas": sigilo.somar_acoes(sigilosas)}


def _cartao_do_ano(ano: int) -> tuple[dict[str, dict], int]:
    """Soma os extratos mensais do cartão corporativo. Mesma regra de parada da execução."""
    hoje = date.today()
    meses: list[dict] = []

    for mes in range(1, 13):
        if (ano, mes) > (hoje.year, hoje.month):
            break

        sufixo = f"-{hoje:%Y%m%d}" if (ano, mes) >= (hoje.year, hoje.month - 1) else ""
        try:
            arquivo = portal.baixar(
                sigilo.RECURSO_DO_CARTAO.format(ano=ano, mes=mes), CACHE / f"cpgf-{ano}{mes:02d}{sufixo}.zip"
            )
        except requests.HTTPError as erro:
            if erro.response is None or erro.response.status_code not in (403, 404):
                raise
            log.info("  cartão %d/%02d ainda não publicado — a soma do ano para aqui", ano, mes)
            break

        meses.append(sigilo.cartao_do_mes(portal.ler_csv(
            arquivo, sigilo.arquivo_do_cartao(ano, mes), colunas=sigilo.COLUNAS_DO_CARTAO,
        )))

    return sigilo.somar_cartao(meses), len(meses)


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

    # ⭐ O desempate da PL47 — ver `_desempatar` — com quem votou na legislatura em que
    #    a emenda foi APRESENTADA: a de um ano entra na lei orçamentária votada no ano
    #    anterior, e o código do autor é de um mandato só (achado #24).
    #
    #    ⚠️ Era quem votou na legislatura corrente. Com as emendas de 2014 a 2022, isso
    #    escolheria o homônimo de hoje para a emenda de 2017 — e a emenda iria para a
    #    ficha de outra pessoa, sem erro nenhum.
    anos_por_autor = persistencia.anos_dos_autores(conexao)
    votantes = persistencia.votantes_por_legislatura(conexao)
    corrente = max(votantes) if votantes else None

    def com_voto_de(codigo: str) -> set[int]:
        return votantes_do_mandato(anos_por_autor.get(codigo, set()), votantes, corrente)

    resolvidos = por_sucessor = por_desempate = ambiguos = 0

    for codigo, nome_autor in pendentes:
        candidatos = por_nome.get(normalizacao.sem_acento_maiusculo(nome_autor), [])

        # 🔴 REGRA B — o Portal renomeia o autor para o SUPLENTE que executa a emenda:
        #    "TIAGO DIMAS (EX-PARLAMENTAR LAZARO BOTELHO, NOS TERMOS ART. 78 LDO 2025)".
        #    O nome do sucessor ⛔ não casa com ninguém, e a emenda fica órfã — mas ela é
        #    de quem a APRESENTOU. ⭐ ⛔ Não é similaridade: é um rótulo da própria fonte.
        original = None
        if not candidatos:
            original = emendas.autor_original(nome_autor)
            if original:
                candidatos = por_nome.get(
                    normalizacao.sem_acento_maiusculo(original), []
                )

        escolhido = _desempatar(candidatos, com_voto_de(codigo))

        if escolhido is None:
            if len(candidatos) > 1:
                ambiguos += 1
            continue

        persistencia.resolver_autor(conexao, codigo, escolhido, "AUTOMATICO")
        resolvidos += 1
        if original:
            por_sucessor += 1
        elif len(candidatos) > 1:
            por_desempate += 1

    vinculadas = persistencia.vincular_emendas(conexao)

    log.info(
        "Reconciliação: %d de %d autores resolvidos, %d emendas vinculadas",
        resolvidos, len(pendentes), vinculadas,
    )
    if por_sucessor:
        log.info("  %d pelo nome do ex-parlamentar citado no registro", por_sucessor)
    if por_desempate:
        log.info("  %d por desempate — homônimo sem voto na base", por_desempate)
    if ambiguos:
        log.warning("  %d autores AMBÍGUOS — dois parlamentares com o mesmo nome", ambiguos)

    restantes = len(persistencia.autores_nao_resolvidos(conexao))
    if restantes:
        # ⚠️ Pendência é NORMAL: senadores e bancadas nunca terão dono na nossa base.
        log.info(
            "  %d autores seguem sem vínculo (senadores, bancadas, outras legislaturas)",
            restantes,
        )


def votantes_do_mandato(
    anos_das_emendas: set[int], votantes: dict[int, set[int]], corrente: int | None
) -> set[int]:
    """Quem votou na legislatura em que as emendas foram apresentadas.

    A emenda de um ano entra na lei orçamentária votada no ano ANTERIOR: a de 2019 foi
    apresentada em 2018, ainda na 55ª. Sem ano conhecido, vale a legislatura corrente.
    """
    legislaturas = {
        ingestao.legislatura_da_data(f"{ano - 1}-07-01") for ano in anos_das_emendas
    } or ({corrente} if corrente else set())
    return set().union(*(votantes.get(l, set()) for l in legislaturas))


def _desempatar(candidatos: list[int], com_voto: set[int]) -> int | None:
    """Qual das pessoas de mesmo nome é a autora, ou `None` se ⛔ não dá para saber.

    ## 🔴 REGRA A — o homônimo histórico manufatura ambiguidade

    A busca é contra as **7.993 pessoas** do banco, quase todas de legislaturas antigas.
    📐 Medido em 2026-08-29, isso criava **14** empates que ⛔ não existem na realidade:

    | Deputado em exercício | "Concorrente" |
    |---|---|
    | Bebeto — Carlos Roberto Rodrigues, 1.117 votos | *BEBETO* — Adalberto Souza Galvão, **0 votos** |
    | Albuquerque — José F. Lopes, 933 votos | *ALBUQUERQUE* — Manoel J. de Albuquerque, **0 votos** |

    ⭐ **Quem ⛔ não tem voto nenhum na base ⛔ não aparece em tela nenhuma** — e ⛔ não é
    o autor de emenda de 2024. Se sobra **exatamente um** com voto, é ele.

    ## Por que isto ⛔ não é chute

    | Evidência | |
    |---|---|
    | Concorrente ser senador em exercício | 🔴 **0 de 14** — era o risco real, porque senador apresenta emenda |
    | Destino da emenda bate com a UF do parlamentar | ⭐ **50 de 56** · 2 discordam · 4 sem UF |
    | Emendas de 2024 em diante, que só a 57ª podia apresentar | 82% |

    ⚠️ **Ambiguidade REAL continua sem vínculo**, e deve continuar: `ÁTILA DE MELO LIRA`
    e `ÁTILA FREITAS LIRA` são duas pessoas, as duas com voto — o desempate desiste, e a
    saída é o `--resolver`.
    """
    if len(candidatos) == 1:
        return candidatos[0]

    if len(candidatos) < 2:
        return None

    votantes = [pessoa_id for pessoa_id in candidatos if pessoa_id in com_voto]

    return votantes[0] if len(votantes) == 1 else None


def pares_de_resolucao(entradas: list[str]) -> list[tuple[str, str]]:
    """Converte `["4184=204521"]` em `[("4184", "204521")]`.

    ## 🔴 O segundo valor é o id NA CÂMARA, ⛔ não `pessoas.id`

    ⚠️ **Isto mudou em 2026-08-29, depois de o defeito se materializar.** A PL47
    registrava `--resolver 4511=43` para o Allan Garcês. Depois de uma reingestão:

    | | |
    |---|---|
    | Quando foi registrado | `43` = Allan Garcês |
    | 🔴 Hoje | `43` = **André Ferreira** · Allan Garcês virou o **31** |

    `pessoas.id` é `BIGSERIAL` e é **reatribuído** quando a base é recarregada. ⛔ Um
    comando anotado no dia anterior colocaria as emendas de um parlamentar na ficha de
    outro — **em silêncio**, porque a FK aceita qualquer id que exista.

    ⭐ O id da Câmara vem da fonte e ⛔ nunca muda. É o mesmo que aparece na URL do
    perfil oficial e em `pessoa_fonte_ids`.

    🔴 Entrada malformada **estoura**, ⛔ não é ignorada: `--resolver 4184` sem o `=`
    seria descartado em silêncio, e a pessoa concluiria que vinculou quando não vinculou.
    """
    pares: list[tuple[str, str]] = []

    for entrada in entradas:
        codigo, separador, externo = entrada.partition("=")
        if not separador or not codigo.strip() or not externo.strip():
            raise ValueError(
                f"'{entrada}' não é CODIGO=ID_NA_CAMARA. Ex.: --resolver 4184=204521"
            )

        # ⚠️ O id da fonte é numérico nas três (Câmara, Senado, TSE). Recusar aqui pega
        #    o typo com uma mensagem útil, em vez de devolver "ninguém com id_externo".
        if not externo.strip().isdigit():
            raise ValueError(f"'{externo.strip()}' não é um id da Câmara")

        pares.append((codigo.strip(), externo.strip()))

    return pares


def _resolver_a_mao(conexao: psycopg.Connection, entradas: list[str]) -> None:
    """PL45 — vincula autor de emenda à mão, a saída dos ambíguos.

    Dois parlamentares com o mesmo nome de urna ⛔ não são separáveis por texto: a
    reconciliação automática desiste de propósito e quem decide é uma pessoa. Fica
    gravado como `MANUAL`, que execução automática posterior ⛔ nunca sobrescreve.
    """
    for codigo, id_externo in pares_de_resolucao(entradas):
        # 🔴 Resolve o id ESTÁVEL da fonte para a chave interna, na hora de aplicar —
        #    ⛔ nunca o contrário. Ver `pares_de_resolucao`.
        pessoa = conexao.execute(
            """
            SELECT p.id, p.nome_exibicao
              FROM pessoas p
              JOIN pessoa_fonte_ids f ON f.pessoa_id = p.id
             WHERE f.id_externo = %s
            """,
            (id_externo,),
        ).fetchone()

        # A FK pegaria o id inexistente, mas com mensagem do Postgres; aqui dá para
        # dizer o que fazer.
        if not pessoa:
            raise RuntimeError(
                f"ninguém com id_externo {id_externo}. ⚠️ É o id NA CÂMARA (o da URL do "
                f"perfil oficial), ⛔ não `pessoas.id` — que muda a cada reingestão."
            )

        pessoa_id, nome_exibicao = pessoa

        autor = conexao.execute(
            "SELECT nome_autor FROM autores_de_emenda WHERE codigo = %s", (codigo,)
        ).fetchone()
        if not autor:
            raise RuntimeError(
                f"código {codigo} não foi visto em nenhuma emenda. Rode `emendas` antes."
            )

        persistencia.resolver_autor(conexao, codigo, pessoa_id, "MANUAL")
        log.info(
            "  %s (%s) -> %s (câmara %s, id interno %d)",
            codigo, autor[0], nome_exibicao, id_externo, pessoa_id,
        )

    vinculadas = persistencia.vincular_emendas(conexao)
    log.info("%d emendas vinculadas", vinculadas)


def _cpf(conexao: psycopg.Connection) -> None:
    """Completa `cpf_hash` das duas casas — e cada uma tem um caminho.

    Câmara: a API REST publica o CPF, uma requisição por deputado.
    Senado: não publica. O caminho é o nome civil contra a prestação de contas do TSE,
    em `_nome_civil_dos_senadores` e `_cpf_dos_senadores`.
    """
    _cpf_dos_deputados(conexao)
    _nome_civil_dos_senadores(conexao)
    _cpf_dos_senadores(conexao)


def _cpf_dos_deputados(conexao: psycopg.Connection) -> None:
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


# As duas eleições que compõem a 57ª legislatura do Senado: a Casa renova por terços
# alternados, então metade das cadeiras vem de 2018 e a outra de 2022.
ELEICOES_DO_SENADO = (2018, 2022)


def _nome_civil_dos_senadores(conexao: psycopg.Connection) -> int:
    """Completa `nome_civil` pelo detalhe do Senado. É a chave para casar com o TSE.

    A lista de exercício traz `NomeCompletoParlamentar` dos 81 de hoje; os suplentes que
    devolveram a cadeira só aparecem nos votos, e o voto não tem nome completo. O
    endpoint de detalhe responde para qualquer código.
    """
    faltantes = persistencia.senadores_sem_nome_civil(conexao)
    if not faltantes:
        log.info("Todos os senadores com voto já têm nome civil.")
        return 0

    log.info("Buscando nome civil de %d senadores...", len(faltantes))

    achados = 0
    for codigo, pessoa_id in faltantes:
        identificacao = senado.baixar_senador(codigo)
        completo = (identificacao or {}).get("NomeCompletoParlamentar")
        parlamentar = (identificacao or {}).get("NomeParlamentar")

        # Só grava se for DIFERENTE do nome parlamentar: gravar o mesmo texto deixaria a
        # pessoa fora de `senadores_sem_nome_civil` na próxima execução, escondendo que
        # o Senado não tem o dado dela.
        if completo and completo.strip() != (parlamentar or "").strip():
            persistencia.gravar_nome_civil(conexao, pessoa_id, completo.strip())
            achados += 1

        time.sleep(PAUSA_ENTRE_CHAMADAS)

    log.info("  %d de %d com nome civil", achados, len(faltantes))
    return achados


def _cpf_dos_senadores(conexao: psycopg.Connection) -> None:
    """Completa `cpf_hash` dos senadores casando o nome civil contra o TSE.

    🔴 **O Senado não publica CPF.** A prestação de contas eleitoral publica: cada
    candidato a Senador aparece com `NM_CANDIDATO` (civil), `SG_UF` e
    `NR_CPF_CANDIDATO`. O casamento é por **nome civil + UF**, ⛔ nunca por nome
    sozinho — homônimo em estados diferentes é outra pessoa, e atribuir a campanha de um
    a outro daria número plausível e errado.

    ⚠️ **Teto conhecido:** suplentes não prestam contas próprias. Quem assumiu a cadeira
    sem ter sido eleito titular ⛔ não está no arquivo, e continua sem `cpf_hash`. Isso
    ⛔ não é falha de carga — é alcance da fonte, e a tela precisa dizer isso em vez de
    mostrar zero como se fosse medida.
    """
    pendentes = persistencia.senadores_para_casar(conexao)
    if not pendentes:
        log.info("Todos os senadores com voto já têm cpf_hash.")
        return

    mapa: dict[tuple[str, str], str | None] = {}
    for eleicao in ELEICOES_DO_SENADO:
        arquivo = CACHE / f"prestacao-contas-{eleicao}.zip"
        if not arquivo.exists():
            url = tse.url_de_prestacao_de_contas(eleicao)
            if not tse.existe(url):
                log.warning("  TSE não respondeu para %s; seguindo sem essa eleição", url)
                continue
            arquivo = tse.baixar(url, arquivo)

        do_ano = receitas.cpf_de_senadores(arquivo, eleicao)
        log.info("  %d candidatos a Senador em %d", len(do_ano), eleicao)

        for chave, cpf in do_ano.items():
            # Chave repetida entre as duas eleições com CPF diferente é ambiguidade, e
            # ambiguidade não se resolve escolhendo uma.
            if chave in mapa and mapa[chave] != cpf:
                mapa[chave] = None
            else:
                mapa.setdefault(chave, cpf)

    if not mapa:
        log.warning("Nenhum candidato a Senador lido do TSE; cpf_hash não foi tocado.")
        return

    casados = ambiguos = 0
    for pessoa_id, nome_civil, uf in pendentes:
        cpf = mapa.get((normalizacao.sem_acento_maiusculo(nome_civil), uf.upper()))
        if cpf is None:
            ambiguos += (normalizacao.sem_acento_maiusculo(nome_civil), uf.upper()) in mapa
            continue

        hash_cpf = normalizacao.hash_de_cpf(cpf)
        if hash_cpf:
            persistencia.gravar_cpf_hash(conexao, pessoa_id, hash_cpf)
            casados += 1

    log.info("  %d de %d senadores casados por nome civil + UF", casados, len(pendentes))
    if ambiguos:
        log.warning("  %d ficaram de fora por ambiguidade de nome + UF", ambiguos)


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

    _cota_do_senado(conexao, anos)


def _cota_do_senado(conexao: psycopg.Connection, anos: list[int]) -> None:
    """CEAPS — a cota do Senado, na MESMA tabela `despesas` da Camara.

    A tabela ja e generica: a ficha consulta por `pessoa_id`, entao o senador passa a
    ter gasto de gabinete sem tocar em API nem em tela.

    O de-para e por NOME parlamentar, porque a CEAPS nao publica id. Quem nao casa e
    descartado: atribuir gasto por semelhanca seria inventar dono.
    """
    for ano in anos:
        log.info("CEAPS de %d...", ano)

        # O ano civil atravessa a posse: janeiro ainda é da legislatura anterior. O
        # de-para é o das duas, e o senador de mandato de 8 anos é a mesma pessoa nelas.
        legislaturas = sorted(
            {ingestao.legislatura_da_data(f"{ano}-01-15"), ingestao.legislatura_da_data(f"{ano}-12-15")}
        )
        por_nome = persistencia.senadores_por_nome(conexao, legislaturas)
        if not por_nome:
            log.info("  nenhum senador votou em %s; CEAPS de %d ⛔ lida.", legislaturas, ano)
            continue

        arquivo = senado.baixar_ceaps(ano, CACHE / f"ceaps-{ano}.csv")
        registros = senado.ler_ceaps(arquivo)

        linhas = cota.para_linhas_do_senado(registros, por_nome)
        gravadas = persistencia.gravar_despesas(
            conexao, list(por_nome.values()), linhas
        )

        log.info("  %d linhas, %d gravadas", len(registros), gravadas)

        # Descarte alto significa de-para incompleto ou nome grafado diferente — e a
        # ficha mostraria gasto a menos, sem erro.
        descartadas = len(registros) - len(linhas)
        if descartadas > len(registros) * 0.2:
            nao_casaram = sorted(
                {
                    normalizacao.sem_acento_maiusculo(r.get("SENADOR"))
                    for r in registros
                    if normalizacao.sem_acento_maiusculo(r.get("SENADOR")) not in por_nome
                }
            )
            log.warning(
                "  %d de %d descartadas. Nomes sem de-para: %s",
                descartadas, len(registros), ", ".join(nao_casaram[:10]) or "-",
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

    # O cargo esperado sai da casa em que a pessoa votou. Sem isto, a campanha ao
    # Senado que um deputado atual PERDEU entraria no financiamento dele.
    casas = persistencia.casa_por_pessoa(conexao)

    todas: list[dict] = []
    for nome in nomes:
        linhas = receitas.para_linhas(
            receitas.ler_receitas(arquivo, nome), hashes, eleicao, casas
        )
        todas.extend(linhas)

        if linhas:
            log.info("  %s — %d linhas de parlamentar em exercício", nome, len(linhas))

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
        # ⭐ A EMENTA primeiro, e a descrição depois. A descrição diz o NÚMERO do
        #    projeto; a ementa diz sobre o que ele é — e é dela que sai a pergunta.
        if candidata.ementa:
            log.info("    ementa: %s", candidata.ementa[:150])
        else:
            # ⚠️ 3 das 266 substantivas ⛔ não têm proposição vinculada. Dizer isso é
            #    melhor que omitir a linha: quem cura precisa saber que vai ter de
            #    procurar a matéria à mão.
            log.info("    ementa: (sem proposicao vinculada - procure pelo numero)")
        log.info("    votacao: %s", candidata.descricao[:110])

    log.info("")
    log.info("A afirmacao em linguagem leiga e a polaridade FINAL sao leitura humana.")
    log.info("Formato: src/Poligraph.Migrations/curadoria/perguntas-lote-1.json")


def _materias_do_senado(conexao: psycopg.Connection, votacoes_brutas: list[dict]) -> None:
    """A ementa das votações do Senado — o que a descrição ⛔ não diz.

    ## 🔴 Por que

    A descrição diz o NÚMERO do projeto:

    > *"Votação nominal do Projeto de Lei Complementar nº 124, de 2022, nos termos do
    > parecer."*

    ⛔ Sem a matéria, os votos do Senado ⛔ não têm assunto nenhum — a ficha do senador
    lista vinte linhas assim, e a curadoria do questionário vira adivinhação. É o mesmo
    buraco que a PL40 fechou na Câmara.

    ## ⚠️ Uma chamada por matéria

    ⛔ Não há arquivo em lote: o Senado publica matéria a matéria. São ~360 chamadas por
    carga completa, e por isso só se baixa o que ainda ⛔ não está no banco — recarregar
    o ano inteiro toda vez custaria minutos sem trazer nada novo.
    """
    codigos = {}
    for votacao in votacoes_brutas:
        codigo = votacao.get("codigoMateria")
        sessao = votacao.get("codigoSessaoVotacao")
        if codigo and sessao:
            codigos[f"SF-{sessao}"] = str(codigo)

    if not codigos:
        return

    # ⭐ Só o que falta. A ementa ⛔ não muda depois de a matéria ser apresentada, e a
    #    releitura custaria uma requisição por matéria a cada execução.
    with conexao.cursor() as cursor:
        cursor.execute(
            "SELECT id FROM proposicoes WHERE casa = 'SENADO' AND id = ANY(%s)",
            ([int(c) for c in set(codigos.values()) if c.isdigit()],),
        )
        ja_temos = {str(linha[0]) for linha in cursor.fetchall()}

    faltam = sorted(set(codigos.values()) - ja_temos)
    log.info("  %d matérias distintas, %d a baixar", len(set(codigos.values())), len(faltam))

    materias = []
    for posicao, codigo in enumerate(faltam, 1):
        if posicao % 50 == 0:
            log.info("    %d de %d...", posicao, len(faltam))
        materias.append(senado.baixar_materia(codigo))

    linhas, vinculo = proposicoes.do_senado(materias, codigos)

    if linhas:
        persistencia.gravar_proposicoes(conexao, linhas)

    # 🔴 O vínculo cobre TODAS as votações do ano, ⛔ não só as recém-baixadas: matéria
    #    já no banco continua precisando ser apontada pelas votações novas.
    todas = {v: c for v, c in codigos.items()}
    ligados = persistencia.vincular_proposicoes(
        conexao,
        {v: int(c) for v, c in todas.items() if c.isdigit()},
        casa="SENADO",
    )

    log.info("  %d matérias gravadas, %d votações vinculadas", len(linhas), ligados)


def _conferir(conexao: psycopg.Connection) -> None:
    """PL66 — confere o banco inteiro. ⛔ Escreve nada; falha se alguma regra der ERRO.

    ⭐ Feito para rodar no fim de toda carga: os 203 senadores da 55ª (achado #37) teriam
    aparecido aqui no dia, ⛔ por acaso semanas depois.
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
            nivel("    %s %sª · %s", achado.casa, achado.legislatura, achado.detalhe)
        if len(lista) > 10:
            nivel("    … e mais %d", len(lista) - 10)

    erros = sum(1 for a in achados if a.severidade == "ERRO")
    avisos = len(achados) - erros
    log.info("Conferência: %d erro(s), %d aviso(s).", erros, avisos)

    if erros:
        raise RuntimeError(f"Conferência encontrou {erros} erro(s) — o dado ⛔ deve ir à tela assim.")


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
    # ⚠️ Da CÂMARA e da legislatura validada (PL54): "a mais recente" de qualquer casa
    #    comparava a matriz da Câmara com as comunidades do Senado quando ele rodava por
    #    último.
    execucao = conexao.execute(
        """
        SELECT max(id) FROM execucoes
         WHERE status = 'CONCLUIDA' AND casa = 'CAMARA' AND legislatura = %s
        """,
        (legislatura,),
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

    partido_de = _partido_mais_recente(conexao, legislatura)
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


def _partido_mais_recente(conexao: psycopg.Connection, legislatura: int) -> dict[int, str]:
    """⚠️ Partido vem do voto, não da pessoa: o registro é histórico e deputado troca.

    ⚠️ O último voto DENTRO da legislatura validada: comparar comunidade × partido de 2019
    com a sigla de 2025 mediria a troca de partido, ⛔ o agrupamento.
    """
    linhas = conexao.execute(
        """
        SELECT DISTINCT ON (x.pessoa_id) x.pessoa_id, x.partido_no_voto
          FROM votos x JOIN votacoes v ON v.id = x.votacao_id
         WHERE v.legislatura = %s
         ORDER BY x.pessoa_id, v.data DESC
        """,
        (legislatura,),
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
