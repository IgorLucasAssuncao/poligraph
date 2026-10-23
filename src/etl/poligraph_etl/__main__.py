"""Orquestrador do ETL.

ATENÇÃO: Não é serviço: roda, faz o trabalho e morre. Em produção é uma Scheduled Task do
Coolify, dentro do VPS — o Postgres nunca sai de lá.

    python -m poligraph_etl ingerir  --anos 2023 2024 2025 2026
    python -m poligraph_etl analisar --legislatura 57
"""

import argparse
import csv
import hashlib
import json
import logging
import os
import sys
import time
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import numpy as np
import psycopg
import requests

from . import conexao as conexao_mod
from . import (
    arrecadacao, comparacao, cota, curadoria, emendas, grafo, ingestao,
    ingestao_senado, municipios, normalizacao, orcamento, orientacoes,
    persistencia, proposicoes, receitas, sigilo, similaridade, validacao,
)
from .fontes import brasilapi, camara, portal, receita, senado, tse
from . import amostra, mandatos, compras, compras_centralizadas, conferencia, convenentes, defesa_civil, em_exercicio, limpeza, patrimonio, procedencia, redes, rotina, sancoes, telemetria, viagens
from .contratos import entrada
from .contratos.entrada import colunas_da_fonte
from .contratos.tse import LinhaDeCandidatura
from .tipos import FonteDaRedeSocial, TipoCargo, TipoCasa, TipoFonteDeCarga, TipoFonteDeIdentificador
from .contratos.portal import (
    LinhaDeCompra, LinhaDeCompraCentralizadaNoCartao, LinhaDeSancao, LinhaDeTrechoDeViagem, LinhaDeViagem, LinhaDePagamentoDeViagem, LinhaDoCartaoDaDefesaCivil,
)

log = logging.getLogger("poligraph")

CACHE = Path(os.environ.get("POLIGRAPH_CACHE", ".cache"))

# ATENÇÃO: Segundos entre chamadas na busca de CPF — são centenas contra serviço público.
PAUSA_ENTRE_CHAMADAS = 0.15

# RISCO: Abaixo disto a legislatura fica SEM grafo, e a tela não a oferece.
#
# MEDIDO: O discovery (§4.1.1.1) mediu o intervalo de confiança da concordância de um par:
#    ~±17 pp com 56 votações, ~±10 pp com 182. Com 100 fica em ~±13 pp. Abaixo disso
#    o desenho separaria gente por ruído, e um grafo errado com cara de medida é pior
#    que nenhum. Conta só o que entra na matriz: plenário, nominal, aberta.
VOTACOES_MINIMAS_PARA_GRAFO = 100


def main(argv: list[str] | None = None) -> int:
    """RISCO: O Aspire injeta no formato do Npgsql (`Host=...;Database=...`) e o psycopg
    fala libpq (`host=... dbname=...`). Sem traduzir, morre antes de conectar.
    """
    _saida_em_utf8()
    args = _argumentos(argv)
    _configurar_log()

    conexao_str = os.environ.get("ConnectionStrings__poligraph") or os.environ.get(
        "POLIGRAPH_CONEXAO"
    )
    if not conexao_str:
        log.error("Defina ConnectionStrings__poligraph (ou POLIGRAPH_CONEXAO).")
        return 2

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
            elif args.comando == "defesa-civil":
                _defesa_civil(conexao, args.anos)
            elif args.comando == "viagens":
                _viagens(conexao, args.anos)
            elif args.comando == "compras":
                _compras(conexao, args.anos)
            elif args.comando == "sancoes":
                _sancoes(conexao)
            elif args.comando == "em-exercicio":
                _em_exercicio(conexao)
            elif args.comando == "compras-centralizadas":
                _compras_centralizadas(conexao, args.anos)
            elif args.comando == "convenios":
                _convenios(conexao)
            elif args.comando == "patrimonio":
                _patrimonio(conexao, args.anos)
            elif args.comando == "mandatos":
                _mandatos(conexao, args.eleicoes)
            elif args.comando == "redes":
                _redes(conexao, args.anos)
            elif args.comando == "municipios":
                _municipios(conexao, args.diretorio)
            elif args.comando == "cpf":
                _cpf(conexao, args.todas_legislaturas)
            elif args.comando == "rechavear-cpf":
                _rechavear_cpf(conexao)
            elif args.comando == "cota":
                _cota(conexao, args.anos)
            elif args.comando == "fundo":
                _fundo(conexao, args.eleicao, args.arquivo)
            elif args.comando == "conferir":
                _conferir(conexao)
            elif args.comando == "simbolicas":
                _simbolicas(conexao, args.anos)
            elif args.comando == "populacao":
                _populacao(conexao)
            elif args.comando == "fundir-pessoas":
                _fundir_pessoas(conexao)
            elif args.comando == "siconfi":
                _siconfi(conexao, args.anos, args.municipios, args.arquivo)
            elif args.comando == "reclassificar":
                _reclassificar(conexao)
            elif args.comando == "rotina":
                _rotina(conexao, args.frequencia)
            elif args.comando == "limpar-cache":
                _limpar_cache()
            elif args.comando == "palavras-chave":
                _palavras_chave(conexao, args.limite)
            elif args.comando == "sedes-brasilapi":
                _sedes_brasilapi(conexao, args.limite)
            elif args.comando == "amostra":
                _amostra(conexao, args.por_grupo, args.semente)
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


def _saida_em_utf8() -> None:
    """O console do Windows abre em cp1252, e o `--help` tem "—" e "→": sem isto, a ajuda quebra."""
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8", errors="replace")


def _argumentos(argv: list[str] | None) -> argparse.Namespace:
    """DECISÃO: Sem legislatura, a CORRENTE — a maior em `votacoes`, não um 57 fixo que
    ficaria velho na posse da 58ª.

    ATENÇÃO: ~6 GB por mês. Uma pasta já baixada evita rebaixar o cadastro inteiro.

    ATENÇÃO: Ano da ELEIÇÃO presidencial, não do mandato: 2022 elegeu a gestão 2023–2026.

    A porta da reconciliação MANUAL: sem ela os autores ambíguos ficam sem saída,
    porque ambiguidade não pode virar palpite automático.

    ATENÇÃO: Ano da ELEIÇÃO, não do exercício. 2022 elegeu a legislatura 57.
    """
    parser = argparse.ArgumentParser(prog="poligraph_etl")
    sub = parser.add_subparsers(dest="comando", required=True)

    ingerir = sub.add_parser("ingerir", help="baixa e grava votações e votos")
    ingerir.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    sen = sub.add_parser("senado", help="ingere senadores, votações e votos do Senado")
    sen.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    analisar = sub.add_parser("analisar", help="calcula similaridade e grafo")
    analisar.add_argument("--legislatura", type=int, nargs="+", default=[])
    analisar.add_argument(
        "--todas", action="store_true",
        help="todas as legislaturas da casa que estão na base",
    )
    analisar.add_argument(
        "--casa", choices=[TipoCasa.CAMARA, TipoCasa.SENADO], default=TipoCasa.CAMARA,
        help="uma casa por execução — as duas não são comparáveis entre si",
    )

    cpf = sub.add_parser("cpf", help="completa o cpf_hash das duas casas (Câmara: API; Senado: TSE)")
    cpf.add_argument("--todas-legislaturas", action="store_true",
                     help="deputados de todas as legislaturas da base, e não só da corrente")
    pal = sub.add_parser(
        "palavras-chave", help="palavras-chave das proposições votadas que ainda não têm (Pendência 70)"
    )
    pal.add_argument("--limite", type=int, default=None, help="no máximo tantas, para ir por partes")
    sed = sub.add_parser(
        "sedes-brasilapi", help="município da sede dos CNPJs de emenda que faltam, pela BrasilAPI (Pendência 71)"
    )
    sed.add_argument("--limite", type=int, default=None, help="no máximo tantos CNPJs nesta execução")
    amo = sub.add_parser(
        "amostra", help="confere votações sorteadas contra um segundo canal oficial de cada casa (Pendência 67)"
    )
    amo.add_argument("--por-grupo", type=int, default=amostra.POR_GRUPO_PADRAO,
                     help="votações sorteadas por casa e legislatura")
    amo.add_argument("--semente", type=int, default=amostra.SEMENTE_PADRAO,
                     help="a mesma semente sorteia as mesmas votações")
    sim = sub.add_parser(
        "simbolicas",
        help="conta as votações simbólicas da Câmara a partir dos arquivos de votações do cache",
    )
    sim.add_argument("--anos", type=int, nargs="+", required=True)
    sub.add_parser("fundir-pessoas", help="junta numa pessoa só quem foi deputado e senador (mesmo cpf_hash); o cpf já faz isso no fim")
    sic = sub.add_parser("siconfi", help="contas anuais das prefeituras (DCA do Tesouro, Siconfi): receita e despesa")
    sic.add_argument("--anos", type=int, nargs="+", default=[date.today().year - 1])
    sic.add_argument("--municipios", nargs="+", help="códigos do IBGE; sem isto, todos os municípios da base")
    sic.add_argument("--arquivo", type=Path, help="regrava um ano a partir da resposta guardada em siconfi/, sem consultar o Tesouro de novo")
    sub.add_parser(
        "populacao",
        help="população estimada de cada município (IBGE, SIDRA 6579), para o mapa por habitante",
    )
    sub.add_parser(
        "reclassificar",
        help="recalcula a categoria de toda votação pela regra atual e diz o que mudou",
    )
    rot = sub.add_parser("rotina", help="a carga agendada (Pendência 64): semanal ou mensal, terminando em conferir")
    rot.add_argument("--frequencia", choices=list(rotina.FREQUENCIAS), required=True)
    sub.add_parser("limpar-cache", help="apaga do cache o que venceu: downloads com mais de 35 dias, procedência com mais de 180")
    sub.add_parser(
        "rechavear-cpf",
        help="refaz todo hash de CPF com a chave atual: pessoas, cota, campanha e patrimônio",
    )

    sub.add_parser(
        "convenios",
        help="completa CNPJ do convenente, situação e liberado dos convênios de emenda (Portal)",
    )
    man = sub.add_parser("mandatos", help="os eleitos de cada eleição (TSE): estaduais, governadores, prefeitos e vices")
    man.add_argument("--eleicoes", type=int, nargs="+", default=ELEICOES_DOS_MANDATOS)
    pat = sub.add_parser("patrimonio", help="bens declarados ao TSE, por tipo — não a descrição")
    pat.add_argument("--anos", type=int, nargs="+", default=[2018, 2022, 2026])
    red = sub.add_parser("redes", help="redes sociais: Câmara para deputados, TSE para senadores e para os outros cargos")
    red.add_argument("--anos", type=int, nargs="+", default=[2018, 2020, 2022, 2024, 2026],
                     help="eleições do TSE; vale a mais recente de cada pessoa")

    mun = sub.add_parser(
        "municipios",
        help="liga quem recebeu emenda à cidade da sede, por CNPJ → TOM → IBGE (Receita)",
    )
    mun.add_argument("--diretorio", type=Path, default=None,
                     help="pasta com Estabelecimentos0..9.zip já baixados, dentro da pasta de cache (POLIGRAPH_CACHE)")

    gov = sub.add_parser(
        "governo",
        help="ingere quem governa (TSE), o orçamento, o pago e a arrecadação (Portal)",
    )
    gov.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    gov.add_argument("--eleicao", type=int, default=2022)

    dfc = sub.add_parser(
        "defesa-civil",
        help="cartão de pagamento da Defesa Civil: o gasto federal de estados e municípios em desastres (Portal)",
    )
    dfc.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    vgm = sub.add_parser(
        "viagens",
        help="viagens a serviço do Executivo federal: diárias e passagens por órgão, e destinos (Portal)",
    )
    vgm.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    cmp = sub.add_parser(
        "compras",
        help="contratos do Executivo federal publicados no Diário Oficial: por órgão, modalidade e contratado (Portal)",
    )
    cmp.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    sub.add_parser("sancoes", help="empresas sancionadas no CEIS e no CNEP, pelo CNPJ (Portal)")
    sub.add_parser("em-exercicio", help="quem está em exercício hoje, pela lista oficial da Câmara e do Senado")

    cpcc = sub.add_parser(
        "compras-centralizadas", help="cartão de pagamento de compras centralizadas (CPCC), por órgão e mês (Portal)"
    )
    cpcc.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    emd = sub.add_parser(
        "emendas", help="ingere emendas, favorecidos e convênios (Portal)"
    )
    emd.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    emd.add_argument(
        "--resolver",
        nargs="+",
        default=[],
        metavar="CODIGO=ID_NA_CAMARA",
        help=(
            "vincula autores à mão, ex.: --resolver 4184=204521. "
            "ATENÇÃO: O segundo valor é o id NA CÂMARA — `pessoas.id` muda a cada reingestão"
        ),
    )

    cotas = sub.add_parser("cota", help="ingere a cota parlamentar (CEAP)")
    cotas.add_argument("--anos", type=int, nargs="+", default=[2023, 2024, 2025, 2026])

    fundo = sub.add_parser(
        "fundo", help="ingere o financiamento de campanha, incluindo o fundão (TSE)"
    )
    fundo.add_argument("--eleicao", type=int, default=2022)
    fundo.add_argument(
        "--arquivo",
        type=Path,
        default=None,
        help="ZIP baixado à mão, dentro da pasta de cache (POLIGRAPH_CACHE): o plano B para quando o WAF do TSE endurecer",
    )

    curar = sub.add_parser(
        "curar", help="lista votações candidatas a pergunta, das mais divididas"
    )
    curar.add_argument("--casa", choices=[TipoCasa.CAMARA, TipoCasa.SENADO], default=TipoCasa.SENADO)
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
    """RISCO: O console do Windows é cp1252, e `logging` não trata erro de codificação:
    imprime um rastro de exceção no lugar da mensagem e segue. `errors="replace"` faz
    o texto degradar em vez de sumir; as mensagens evitam o problema na origem.
    """
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        stream=sys.stdout,
    )
    telemetria.ligar_logs(logging.getLogger())


def _ingerir(conexao: psycopg.Connection, anos: list[int]) -> None:
    """RF-01, RF-03, RF-08 — carga com log auditável.

    RISCO: Zero aqui NÃO é caso normal — é o arquivo ter mudado de forma.

    ATENÇÃO: Foi exatamente assim que o bug do `uri` sobreviveu: `0 deputados no arquivo`
    saiu em INFO, o ETL seguiu, e como o de-para ficou vazio os 13.825 votos de
    2025 também foram descartados, registrando `0 votos`. Dois zeros plausíveis e
    nenhuma exceção. Parar aqui é o que transforma isso em erro visível.

    `camara.conferir_volume(df, ano)`: DECISÃO: canário contra regressão de parsing

    RISCO: Canário do classificador por texto — ver `descricoes_nao_reconhecidas`.
    ATENÇÃO: Frase nova não derruba a ingestão, mas não passa em silêncio: sem
    isto, uma mudança de redação na fonte mandaria tudo para SUBSTANTIVA.

    RISCO: Cruzamento com o ÚNICO sinal estruturado que a fonte dá sobre o tipo do
    voto: a sigla no começo de `ultimaAberturaVotacao_descricao`.

    ATENÇÃO: NÃO corrige a categoria — o campo é da última abertura da SESSÃO, não
    da votação. Serve para a divergência aparecer, e foi assim que a votação
    2613731-65 ("Resultado. Sim: 182; Não: 182") se revelou um destaque de
    emenda depois de já ter virado pergunta.

    ATENÇÃO: A votação entra SEM proposição: ela é ingerida antes de a proposição
    existir, e a FK recusaria a linha. O vínculo vem logo abaixo.

    DECISÃO: A ementa é o que destrava a curadoria (Pendência 11): a DESCRIÇÃO da votação diz o
    número do projeto e não diz sobre o que ele é.

    ATENÇÃO: Voto fora do de-para é descartado, não inventado. Em volume, o problema
    está na ingestão de deputados — e aí o número precisa aparecer.

    DECISÃO: Orientação de bancada: é o que transforma "votou Sim" em posição. Sem ela,
    `governismo` e `disciplina` ficam nulos — as colunas existem desde o
    schema inicial e passaram a legislatura inteira vazias.
    MEDIDO: A Câmara não publica orientações de 2001 e 2002: 404, conferido em
    2026-10-01 (achado #35). Sem elas o ano entra inteiro, e só `governismo` e
    `disciplina` ficam nulos — que é o que já acontece no Senado inteiro.
    """
    log.info("Ingerindo deputados...")
    caminho = camara.baixar("deputados", anos[0], CACHE / "deputados.csv")
    carga_dos_deputados = _carga_do_arquivo(conexao, TipoFonteDeCarga.CAMARA, camara.url_do_arquivo("deputados", anos[0]), caminho)
    deputados = ingestao.deputados_para_linhas(camara.ler_csv(caminho))
    novos = persistencia.gravar_pessoas(conexao, deputados, carga_dos_deputados)
    log.info("  %d deputados no arquivo, %d novos", len(deputados), novos)

    if not deputados:
        raise RuntimeError(
            f"Nenhum deputado lido de {caminho}. O layout do CSV mudou? "
            "Sem o de-para, todos os votos seriam descartados em silêncio."
        )

    mapa = _mapa_pessoas(conexao)

    for ano in anos:
        log.info("Ingerindo %d...", ano)

        arquivo, carga_votacoes = _baixar_da_camara(conexao, "votacoes", ano)
        df = camara.ler_csv(arquivo)
        camara.conferir_volume(df, ano)

        votacoes = ingestao.votacoes_para_linhas(df)
        simbolicas = persistencia.gravar_simbolicas(
            conexao, TipoCasa.CAMARA, ano, ingestao.simbolicas_por_legislatura(df), carga_votacoes
        )
        log.info("  %d votações simbólicas contadas (não entram na comparação)", simbolicas)

        orfas = normalizacao.descricoes_nao_reconhecidas(
            linha["descricao"] for linha in votacoes
        )
        if orfas:
            log.warning(
                "  %d descrições que nenhum padrão de categoria reconhece — a 1ª: %s",
                len(orfas), (orfas[0] or "")[:90],
            )

        aberturas = dict(
            zip(df["id"], df.get("ultimaAberturaVotacao_descricao", []), strict=False)
        )
        divergentes = normalizacao.divergencias_de_destaque(
            {**linha, "abertura": aberturas.get(linha["id"])} for linha in votacoes
        )
        if divergentes:
            log.warning(
                "  %d votações que a fonte abre como DTQ e nós não classificamos como "
                "DESTAQUE — confira antes de curar. A 1ª: %s",
                len(divergentes), divergentes[0][0],
            )

        persistencia.desconectar_proposicoes_ausentes(conexao, votacoes)
        persistencia.gravar_votacoes(conexao, votacoes, carga_votacoes)
        log.info("  %d registros, %d votações nominais", len(df), len(votacoes))

        arquivo_prop = camara.baixar(
            "votacoesProposicoes", ano, CACHE / f"votacoesProposicoes-{ano}.csv"
        )
        lista, vinculo = proposicoes.para_linhas(
            camara.ler_csv(arquivo_prop).to_dict("records"),
            {v["id"] for v in votacoes},
        )
        carga_prop = _carga_do_arquivo(conexao, TipoFonteDeCarga.CAMARA, camara.url_do_arquivo("votacoesProposicoes", ano), arquivo_prop)
        persistencia.gravar_proposicoes(conexao, lista, carga_prop)
        vinculadas = persistencia.vincular_proposicoes(conexao, vinculo, carga_id=carga_prop)
        log.info(
            "  %d proposições, %d votações vinculadas (%d sem ementa)",
            len(lista), vinculadas,
            sum(1 for p in lista if not p["ementa"]),
        )

        arquivo_votos, carga_votos = _baixar_da_camara(conexao, "votacoesVotos", ano)
        df_votos = camara.ler_csv(arquivo_votos)
        votos = ingestao.votos_para_linhas(df_votos, mapa)
        persistencia.gravar_votos(conexao, votos, carga_votos)
        log.info("  %d votos de %d linhas", len(votos), len(df_votos))

        descartados = len(df_votos) - len(votos)
        if descartados:
            log.warning(
                "  %d votos descartados: deputado fora do de-para", descartados
            )

        try:
            arquivo_orientacoes, carga_orientacoes = _baixar_da_camara(
                conexao, "votacoesOrientacoes", ano
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
        persistencia.gravar_orientacoes(conexao, linhas, carga_orientacoes)
        log.info(
            "  %d orientações de %d linhas (%d bancadas)",
            len(linhas), len(df_orientacoes), len({l["bancada"] for l in linhas}),
        )

    secretas = persistencia.marcar_secretas_de_fato(conexao, TipoCasa.CAMARA)
    if secretas:
        log.info("  %d votações sem nenhuma posição marcadas como secretas (Pendência 69)", secretas)


def _baixar_da_camara(conexao: psycopg.Connection, recurso: str, ano: int):
    """Baixa um arquivo da Câmara e registra a carga (Pendência 72): devolve o caminho e o id.

    O arquivo também fica guardado em `procedencia/`, com o hash no nome: é o que deixa
    qualquer pessoa refazer a conta a partir do mesmo arquivo.
    """
    destino = CACHE / f"{recurso}-{ano}.csv"
    baixado = camara.baixar_com_procedencia(recurso, ano, destino)
    procedencia.guardar(baixado, CACHE / "procedencia")
    return destino, persistencia.registrar_carga(conexao, baixado, procedencia.comando())


def _carga_de_varios(
    conexao: psycopg.Connection, fonte: str, url: str, arquivos: list[tuple[str, Path]], indice: Path
) -> int | None:
    """Registra cada arquivo e um índice que lista todos, e devolve o id da carga do índice.

    DECISÃO (2026-10-10): para linha que soma vários arquivos, como o gasto sigiloso de um ano, que
    junta 12 extratos mensais. Cada arquivo entra em `cargas` com o próprio hash; o índice guarda a
    URL, o hash e a carga de cada um, e é para ele que a linha aponta. Sem arquivo, não há carga.
    """
    if not arquivos:
        return None
    partes = []
    for url_do_arquivo, arquivo in arquivos:
        partes.append({
            "url": url_do_arquivo,
            "sha256": hashlib.sha256(arquivo.read_bytes()).hexdigest(),
            "carga_id": _carga_do_arquivo(conexao, fonte, url_do_arquivo, arquivo),
        })
    indice.parent.mkdir(parents=True, exist_ok=True)
    indice.write_text(json.dumps({"url": url, "arquivos": partes}, ensure_ascii=False, indent=1), encoding="utf-8")
    return _carga_do_arquivo(conexao, fonte, url, indice)


def _carga_de_resposta(conexao: psycopg.Connection, fonte: str, url: str, conteudo, arquivo: Path) -> int:
    """Grava em arquivo o que uma API devolveu e registra esse arquivo, com o hash dele.

    Para o dado que não vem de arquivo publicado, como os senadores em exercício ou a rede de cada
    deputado: sem isto, a linha não teria de onde dizer que veio.
    """
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    arquivo.write_text(json.dumps(conteudo, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return _carga_do_arquivo(conexao, fonte, url, arquivo)


def _carga_do_arquivo(conexao: psycopg.Connection, fonte: str, url: str, arquivo: Path) -> int:
    """Registra a carga de um arquivo que já está no cache (Pendência 72) e devolve o id.

    Mesmo papel de `_baixar_da_camara`, para as cargas que baixam em fluxo: o hash sai do
    arquivo, e a cópia vai para `procedencia/` quando cabe em `LIMITE_PARA_GUARDAR`.
    """
    baixado = procedencia.de_arquivo(fonte, url, arquivo, CACHE)
    procedencia.guardar(baixado, CACHE / "procedencia")
    return persistencia.registrar_carga(conexao, baixado, procedencia.comando())


def _senado(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Ingestão do Senado — senadores, votações e votos.

    As duas casas não são comparáveis entre si (achado #7), então isto alimenta um grafo
    próprio: o `analisar` recebe a casa e monta uma matriz separada. Nenhuma aresta liga
    deputado a senador.

    Zero senadores é mudança de contrato, não Senado vazio — e sem o de-para todos os
    votos seriam descartados em silêncio, como já aconteceu com a Câmara.

    DECISÃO: Depois do descarte: o volume que importa é o do ano de verdade.

    A lista de exercício só tem quem está hoje; os votos alcançam quem saiu,
    licenciou-se ou devolveu a cadeira. Criá-los a partir do próprio voto evita
    descartar 10,5% da base por falta de dono.

    Sigla nova é sinal de que o domínio mudou. Ela vira None e a ingestão segue,
    mas o log precisa denunciar — senão a base encolhe sem ninguém perceber.
    """
    log.info("Ingerindo senadores...")
    em_exercicio = senado.baixar_senadores()
    carga_dos_senadores = _carga_de_resposta(
        conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/senador/lista/atual", em_exercicio,
        CACHE / "respostas" / f"senadores-{date.today():%Y%m%d}.json",
    )
    senadores = ingestao_senado.senadores_para_linhas(em_exercicio)
    novos = persistencia.gravar_pessoas(conexao, senadores, carga_dos_senadores)
    log.info("  %d senadores em exercício, %d novos", len(senadores), novos)

    if not senadores:
        raise RuntimeError(
            "Nenhum senador lido de /senador/lista/atual. O envelope do JSON mudou? "
            "Sem o de-para, todos os votos seriam descartados em silêncio."
        )

    for ano in anos:
        log.info("Ingerindo Senado %d...", ano)

        brutas, baixado = senado.baixar_votacoes_com_procedencia(ano)
        procedencia.guardar(baixado, CACHE / "procedencia")
        carga = persistencia.registrar_carga(conexao, baixado, procedencia.comando())
        votacoes_brutas, fora = ingestao_senado.separar_fora_de_epoca(brutas)
        if fora:
            apagadas = persistencia.apagar_votacoes(
                conexao, [ingestao_senado.id_da_votacao(v) for v in fora]
            )
            log.warning(
                "  %d votações FORA DE ÉPOCA descartadas: o código é de outra numeração "
                "que a data (achado #37). %d já gravadas por carga anterior, apagadas.",
                len(fora), apagadas,
            )

        senado.conferir_volume(votacoes_brutas, ano)

        anteriores = ingestao_senado.senadores_dos_votos(
            votacoes_brutas, ja_conhecidos={s["id_externo"] for s in senadores}
        )
        recuperados = persistencia.gravar_pessoas(conexao, anteriores, carga)
        if recuperados:
            log.info("  %d senadores fora da lista de exercício, criados pelo voto",
                     recuperados)

        mapa = _mapa_pessoas(conexao, fonte=TipoFonteDeIdentificador.SENADO)

        votacoes = ingestao_senado.votacoes_para_linhas(votacoes_brutas)
        persistencia.gravar_votacoes(conexao, votacoes, carga)

        abertas = sum(1 for linha in votacoes if not linha["secreta"])
        log.info(
            "  %d votações, %d abertas (%.0f%% secretas)",
            len(votacoes), abertas,
            100 * (len(votacoes) - abertas) / max(len(votacoes), 1),
        )

        votos = ingestao_senado.votos_para_linhas(votacoes_brutas, mapa)
        persistencia.gravar_votos(conexao, votos, carga)

        com_posicao = sum(1 for linha in votos if linha["valor"] is not None)
        log.info(
            "  %d votos, %d com posição utilizável (%.0f%%)",
            len(votos), com_posicao, 100 * com_posicao / max(len(votos), 1),
        )

        descartados = sum(len(v.get("votos") or []) for v in votacoes_brutas) - len(votos)
        if descartados:
            log.warning("  %d votos descartados: senador fora do de-para", descartados)

        _materias_do_senado(conexao, votacoes_brutas)

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

    ATENÇÃO: O grafo sai da CONCORDANCIA, não do cosseno: é a métrica que a
    tela explica ("votaram igual em X de Y"). O cosseno fica gravado em
    `similaridades` para a comparação da RF-18.

    DECISÃO: É aqui que o grafo ganha NÓS. Sem esta parte ele tem ligações e
    nenhum ponto com comunidade, cor ou posição — nada a desenhar.
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

            if metrica == "CONCORDANCIA":
                arestas = similaridade.arestas_knn(pares)
                gravadas = persistencia.gravar_arestas(conexao, execucao_id, arestas)
                log.info("  grafo kNN: %d arestas gravadas", gravadas)

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

    DECISÃO: **Governismo** é seguir a bancada `Governo`; **disciplina** é seguir o próprio
    partido no momento do voto. O partido vem de `votos.partido_no_voto`, não da
    filiação de hoje: trocar de partido é comum, e medir disciplina contra a filiação
    atual reescreveria o passado.

    ATENÇÃO: Sai sem fazer nada no Senado — lá não existe orientação de bancada, e as duas
    colunas continuam nulas de propósito.

    ATENÇÃO: Uma consulta só, e não uma por pessoa: são 643 parlamentares, e o laço com
    ida ao banco levaria minutos para devolver o que cabe numa varredura.

    Sem base, NULO — nunca zero. Zero afirmaria "nunca seguiu o governo",
    e o que houve foi não haver votação comparável.

    DECISÃO: A base vai junto: a API a lia por conta própria, com a regra antiga
    de sigla exata, e mostraria um percentual novo sobre a base velha.
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

        metricas.append(
            {
                "pessoa_id": pessoa_id,
                "governismo": segue_gov / base_gov if base_gov else None,
                "disciplina": segue_part / base_part if base_part else None,
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

    RISCO: **Decisão do autor:** a chave é o **código do autor**, não o nome. Nada é
    descartado por não ter dono conhecido — senador, emenda de bancada e parlamentar de
    outra legislatura entram com `pessoa_id` nulo e ficam na fila de reconciliação.

    DECISÃO: O casamento por nome roda **uma vez**, como SUGESTÃO (`AUTOMATICO`). Depois disso
    o vínculo vive no código, e a grafia deixa de importar.

    ATENÇÃO: O arquivo é regerado todo dia, então o cache leva a data: o de ontem não serve.
    E emendas, favorecidos e convênios trocam **juntos**, numa transação — uma falha no
    meio deixaria a ficha com o favorecido de hoje e a emenda de ontem.
    """
    arquivo = portal.baixar(
        emendas.RECURSO, CACHE / f"emendas-{date.today():%Y%m%d}.zip"
    )
    carga = _carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(emendas.RECURSO), arquivo)

    tabela_de_emendas = portal.ler_csv(arquivo, emendas.ARQUIVO_EMENDAS)
    linhas, autores = emendas.para_linhas(tabela_de_emendas, anos)
    codigos = {linha["codigo_emenda"] for linha in linhas}
    log.info("  %d linhas, %d emendas, %d autores", len(linhas), len(codigos), len(autores))

    tabela_de_favorecidos = portal.ler_csv(arquivo, emendas.ARQUIVO_FAVORECIDOS)
    favorecidos = emendas.favorecidos_para_linhas(tabela_de_favorecidos, codigos)
    convenios, ligacoes = emendas.convenios_para_linhas(
        portal.ler_csv(arquivo, emendas.ARQUIVO_CONVENIOS), codigos
    )

    with conexao.transaction():
        gravadas = persistencia.gravar_emendas(conexao, anos, linhas, carga)
        persistencia.registrar_autores(conexao, autores, carga)
        persistencia.gravar_favorecidos(conexao, anos, favorecidos, carga)
        persistencia.gravar_convenios(conexao, anos, convenios, ligacoes, carga)
        codigos_na_base, anos_na_base = persistencia.codigos_e_anos_de_emenda(conexao)
        contas = (emendas.reconciliar_emendas(tabela_de_emendas, anos)
                  + emendas.reconciliar_pagamentos(tabela_de_favorecidos, codigos_na_base, anos_na_base)
                  + emendas.reconciliar_pago_e_recebido(persistencia.pago_e_recebido_por_emenda(conexao, anos)))
        persistencia.gravar_reconciliacoes(conexao, contas, carga)
    _registrar_o_que_nao_fecha(contas)

    log.info(
        "%d linhas de emenda, %d pagamentos a favorecidos, %d convênios (%d ligações)",
        gravadas, len(favorecidos), len(convenios), len(ligacoes),
    )

    _reconciliar_autores(conexao)


def _registrar_o_que_nao_fecha(contas: list[dict]) -> None:
    """Diz no log, por ano, quanto do total do Portal ficou fora da base e por quê (Pendência 81)."""
    for conta in contas:
        fora = conta["total_na_fonte"] - conta["total_na_base"]
        if abs(fora) < 0.01:
            continue
        motivos = ", ".join(f"{m} {_reais(v)}" for m, v in sorted(conta["motivos"].items(), key=lambda i: -i[1]))
        log.info("  %s %s %d: %s da fonte fora da base — %s",
                 conta["conjunto"], conta["medida"], conta["ano"], _reais(fora), motivos)


def _reais(valor: float) -> str:
    """Em bi a partir de um bilhão, em mi abaixo: "R$ 0,00 bi" escondia os milhões da cota."""
    return f"R$ {valor / 1e9:.2f} bi" if abs(valor) >= 1e9 else f"R$ {valor / 1e6:.2f} mi"


def _governo(conexao: psycopg.Connection, anos: list[int], eleicao: int) -> None:
    """O perfil do governo federal: a chapa eleita, quanto gastou e de onde veio o dinheiro.

    A chapa sai de `mandatos` (Pendência 56): este comando carrega os eleitos da eleição pelo `mandatos`,
    e a tabela `gestoes` deixou de ser gravada.

    É **contexto** da legislatura, não medida de afinidade, e não liga a parlamentar.

    ATENÇÃO: Os arquivos do ano corrente mudam todo dia; os dos anos fechados, não . O cache
    leva a data nos do ano corrente e não nos fechados — os meses de execução são 48
    arquivos de ~10 MB, e rebaixá-los todo dia seria meio gigabyte por nada.
    """
    _mandatos(conexao, [eleicao])

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
        carga_orcamento = _carga_do_arquivo(
            conexao, "PORTAL_TRANSPARENCIA", portal.url(orcamento.RECURSO.format(ano=ano)), arquivo
        )
        do_ano = [{**l, "carga_id": carga_orcamento} for l in orcamento.para_linhas(tabela, portal.gerado_em(arquivo, membro))]
        encargos_do_ano = [{**l, "carga_id": carga_orcamento} for l in orcamento.encargos_para_linhas(tabela)]

        restos = _restos_a_pagar_do_ano(ano)
        carga_das_acoes = _carga_de_varios(
            conexao, "PORTAL_TRANSPARENCIA", f"{portal.url(orcamento.EXECUCAO.format(ano=ano, mes=1))[:-2]}*",
            restos["arquivos"], CACHE / "indices" / f"execucao-{ano}.json",
        )
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

        cartao, meses_do_cartao, arquivos_do_cartao = _cartao_do_ano(ano)
        carga_do_cartao = _carga_de_varios(
            conexao, "PORTAL_TRANSPARENCIA", f"{portal.url(sigilo.RECURSO_DO_CARTAO.format(ano=ano, mes=1))[:-2]}*",
            arquivos_do_cartao, CACHE / "indices" / f"cpgf-{ano}.json",
        )
        do_sigilo = [
            {**linha, "carga_id": carga_do_cartao if linha["origem"] == "CARTAO_CORPORATIVO" else carga_das_acoes}
            for linha in sigilo.para_linhas(
                ano, cartao, meses_do_cartao, restos["sigilosas"], restos["meses"], sigilo.nomes_de_orgao(tabela)
            )
        ]
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
        carga_receita = _carga_do_arquivo(
            conexao, "PORTAL_TRANSPARENCIA", portal.url(arrecadacao.RECURSO.format(ano=ano)), arquivo_receita
        )
        receitas_do_periodo.extend({**l, "carga_id": carga_receita} for l in arrecadacao.para_linhas(
            portal.ler_csv(arquivo_receita, membro_receita),
            portal.gerado_em(arquivo_receita, membro_receita),
        ))

    with conexao.transaction():
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
    carga = _carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(convenentes.RECURSO.format(data=data)), arquivo)
    linhas = convenentes.ler(arquivo, numeros)
    log.info("  retrato de %s: %d de %d convênios achados, %d com CNPJ", data, len(linhas), len(numeros),
             sum(1 for linha in linhas if linha["cnpj_convenente"]))

    with conexao.transaction():
        persistencia.gravar_convenentes(conexao, linhas, carga)


ELEICOES_DOS_MANDATOS = [1998, 2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026]
"""As eleições que o TSE publica no layout atual do cadastro de candidatos (MEDIDO em 2026-10-21, de 2010 a 2024; 2026 em
2026-10-23, com o primeiro turno apurado)."""


def _mandatos(conexao: psycopg.Connection, eleicoes: list[int]) -> None:
    """Os eleitos de cada eleição viram mandatos, e quem não está no Congresso ganha pessoa (Pendência 90).

    Rode depois de `cpf` e de `municipios`: a pessoa casa pelo `cpf_hash`, e o município do TSE casa pelo
    nome com a tabela de municípios.
    """
    cargas: dict[int, int] = {}
    por_eleicao: dict[int, list] = {}
    for ano in eleicoes:
        url = f"{tse.CDN}/{mandatos.RECURSO.format(ano=ano)}"
        arquivo = tse.baixar(url, CACHE / f"consulta-cand-{ano}.zip")
        cargas[ano] = _carga_do_arquivo(conexao, "TSE", url, arquivo)
        por_eleicao[ano] = mandatos.eleitos(entrada.ler(LinhaDeCandidatura, patrimonio.linhas_do_zip(arquivo)))
        contagem = Counter(e.cargo.value for e in por_eleicao[ano])
        log.info("  %d: %d eleitos — %s", ano, len(por_eleicao[ano]), ", ".join(f"{c} {n}" for c, n in sorted(contagem.items())))
    todos = [e for eleitos_do_ano in por_eleicao.values() for e in eleitos_do_ano]

    identidades = mandatos.Identidades(
        persistencia.hashes_de_pessoas(conexao),
        persistencia.hashes_de_titulos(conexao),
        persistencia.pessoas_dos_mandatos(conexao),
        persistencia.pessoas_por_casa(conexao),
    )
    identidades.propagar(todos)
    novas = mandatos.pessoas_novas(todos, identidades, date.today().year)
    ponte = mandatos.ponte_de_municipios(
        [e for e in todos if e.codigo_ue], persistencia.municipios_para_ponte(conexao))
    sem_ibge = sorted({f"{e.nome_ue}-{e.uf} ({e.codigo_ue})" for e in todos if e.codigo_ue and ponte.get(e.codigo_ue) is None})
    if sem_ibge:
        log.warning("  %d municípios do TSE sem par no IBGE: %s", len(sem_ibge), ", ".join(sem_ibge))

    with conexao.transaction():
        for grupo, pessoa in persistencia.gravar_pessoas_do_tse(conexao, novas, cargas):
            for eleito in grupo:
                identidades.guardar(eleito, pessoa)
        faltantes = {}
        for eleito in todos:
            pessoa = identidades.pessoa(eleito)
            if pessoa is not None:
                identidades.guardar(eleito, pessoa)
                faltantes.setdefault(pessoa, {"id": pessoa, "cpf_hash": eleito.cpf_hash, "titulo_hash": eleito.titulo_hash})
        completados = persistencia.completar_hashes(conexao, list(faltantes.values()))
        for ano, eleitos_do_ano in por_eleicao.items():
            linhas = mandatos.mandatos_para_linhas(eleitos_do_ano, identidades, ponte)
            persistencia.gravar_mandatos(conexao, [ano], linhas, cargas[ano])
            sem_pessoa = Counter(e.cargo.value for e in eleitos_do_ano if identidades.pessoa(e) is None)
            log.info("  %d: %d mandatos gravados%s", ano, len(linhas),
                     "; sem pessoa na base: " + ", ".join(f"{c} {n}" for c, n in sorted(sem_pessoa.items())) if sem_pessoa else "")
        apagadas = persistencia.apagar_pessoas_sem_vinculo(conexao)
    log.info("Mandatos: %d pessoas novas, hashes conferidos em %d pessoas, %d pessoas sem vínculo apagadas.",
             len(novas), completados, apagadas)


def _patrimonio(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Bens declarados ao TSE, por tipo. Rode depois de `cpf` e de `mandatos`.

    Duas pontes: o `cpf_hash` liga as candidaturas de parlamentar, eleitas ou não; `mandatos` liga os
    eleitos dos outros cargos, inclusive os de 2024, que vêm sem CPF.
    """
    hashes = persistencia.hashes_de_pessoas(conexao)
    todas: list[dict] = []
    for ano in anos:
        candidatos = tse.baixar(f"{tse.CDN}/{patrimonio.RECURSO_CANDIDATOS.format(ano=ano)}",
                                CACHE / f"consulta-cand-{ano}.zip")
        ligadas = {**persistencia.candidaturas_dos_mandatos(conexao, ano), **patrimonio.candidaturas(candidatos, hashes)}
        url_dos_bens = f"{tse.CDN}/{patrimonio.RECURSO_BENS.format(ano=ano)}"
        bens = tse.baixar(url_dos_bens, CACHE / f"bem-candidato-{ano}.zip")
        carga = _carga_do_arquivo(conexao, "TSE", url_dos_bens, bens)
        linhas = [
            {**linha, "carga_id": carga}
            for linha in patrimonio.bens_para_linhas(patrimonio.linhas_do_zip(bens), ligadas, ano)
        ]
        log.info("  %d: %d candidaturas ligadas, %d pessoas com bem declarado", ano, len(ligadas),
                 len({linha["pessoa_id"] for linha in linhas}))
        todas.extend(linhas)

    with conexao.transaction():
        persistencia.gravar_patrimonios(conexao, anos, todas)


def _redes(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Redes sociais: a Câmara para deputados, o TSE (candidatura) para senadores e para quem só tem mandato no TSE.

    ATENÇÃO: o arquivo de redes do TSE não traz `SG_UE`, só o `SQ_CANDIDATO`. MEDIDO em 2026-10-21: de 2014 em
    diante o número é único entre os eleitos da eleição; em 2012 há 4 repetidos, por isso os anos de antes de
    2014 não entram.

    O TSE da eleição MAIS RECENTE de cada senador: por isso os anos vão do último ao primeiro.

    RISCO: só troca as redes do TSE de quem tem rede nos arquivos lidos. Antes trocava as de todo senador e de todo
    político fora do Congresso, e `redes --anos 2026` (a etapa da rotina pós-eleição) apagou as redes de quem não
    concorreu em 2026: MEDIDO em 2026-10-23, Andrezinho Ceciliano ficou sem as redes de 2022 e de 2024.
    """
    consultados: list[int] = []
    da_camara: list[dict] = []
    respostas_da_camara: dict[str, list[str]] = {}
    for i, (id_camara, pessoa_id) in enumerate(persistencia.deputados_da_legislatura(conexao), 1):
        urls = camara.redes_do_deputado(id_camara)
        if urls is not None:
            consultados.append(pessoa_id)
            respostas_da_camara[id_camara] = urls
            da_camara.extend(redes.para_linhas(pessoa_id, urls, FonteDaRedeSocial.CAMARA))
        if i % 100 == 0:
            log.info("  %d deputados consultados", i)
        time.sleep(0.05)
    log.info("  Câmara: %d deputados, %d redes", len(consultados), len(da_camara))

    senadores = persistencia.senadores_da_legislatura(conexao)
    fora_do_congresso = persistencia.pessoas_fora_do_congresso(conexao)
    hashes = {h: p for h, p in persistencia.hashes_de_pessoas(conexao).items() if p in senadores}
    do_tse: dict[int, list[dict]] = {}
    for ano in sorted((a for a in anos if a >= 2014), reverse=True):
        candidatos = tse.baixar(f"{tse.CDN}/{patrimonio.RECURSO_CANDIDATOS.format(ano=ano)}",
                                CACHE / f"consulta-cand-{ano}.zip")
        por_candidatura = {
            **{c: p for c, p in persistencia.candidaturas_dos_mandatos(conexao, ano).items() if p in fora_do_congresso},
            **patrimonio.candidaturas(candidatos, hashes, frozenset({TipoCargo.SENADOR})),
        }
        ligadas = {sq: pessoa for (_, sq), pessoa in por_candidatura.items()}
        arquivo = tse.baixar(f"{tse.CDN}/{redes.RECURSO_TSE.format(ano=ano)}", CACHE / f"rede-social-{ano}.zip")
        carga_do_ano = _carga_do_arquivo(conexao, "TSE", f"{tse.CDN}/{redes.RECURSO_TSE.format(ano=ano)}", arquivo)
        por_pessoa: dict[int, list[str]] = {}
        for linha in patrimonio.linhas_do_zip(arquivo):
            pessoa = ligadas.get(linha.get("SQ_CANDIDATO"))
            if pessoa is not None and pessoa not in do_tse:
                por_pessoa.setdefault(pessoa, []).append(redes.url_da_linha(linha))
        for pessoa, urls in por_pessoa.items():
            do_tse[pessoa] = [{**linha, "carga_id": carga_do_ano} for linha in redes.para_linhas(pessoa, urls, "TSE")]
    log.info("  TSE: %d senadores e políticos fora do Congresso com rede", len(do_tse))

    carga_da_camara = _carga_de_resposta(
        conexao, TipoFonteDeCarga.CAMARA, f"{camara.API}/deputados", respostas_da_camara,
        CACHE / "respostas" / f"redes-camara-{date.today():%Y%m%d}.json",
    )
    with conexao.transaction():
        persistencia.gravar_redes(conexao, consultados, da_camara, FonteDaRedeSocial.CAMARA, carga_da_camara)
        persistencia.gravar_redes(conexao, list(do_tse), [l for ls in do_tse.values() for l in ls], "TSE")


def _municipios(conexao: psycopg.Connection, diretorio: Path | None) -> None:
    """A cidade da sede de cada CNPJ que recebeu emenda — só por chave forte.

    ATENÇÃO: Rode depois de `emendas`: os CNPJs procurados são os que estão em
    `emendas_favorecidos`. Sem eles, o cadastro inteiro é lido para gravar nada.
    """
    arquivo_tom = receita.baixar_tabela_tom(CACHE / "receita-municipios.csv")
    carga_tom = _carga_do_arquivo(conexao, "RECEITA", receita.TABELA_TOM, arquivo_tom)
    tabela = receita.ler_tabela_tom(arquivo_tom)
    linhas_municipios = municipios.municipios_para_linhas(tabela)
    tom_para_ibge = {m["codigo_tom"]: m["codigo_ibge"] for m in linhas_municipios}
    log.info("  %d municípios na tabela TOM ↔ IBGE", len(linhas_municipios))

    alvos = persistencia.cnpjs_que_receberam_emenda(conexao)
    if not alvos:
        log.warning("Nenhum CNPJ em emendas_favorecidos — rode `emendas` antes.")
        return

    pasta = receita.ultima_pasta()
    sedes: list[dict] = []
    for nome in receita.ARQUIVOS_DE_ESTABELECIMENTOS:
        if diretorio:
            arquivo = diretorio / nome
        else:
            arquivo = receita.baixar(pasta, nome, CACHE / "receita" / pasta / nome)
        carga = _carga_do_arquivo(conexao, "RECEITA", f"{receita.WEBDAV}/{pasta}/{nome}", arquivo)
        sedes.extend(
            {**linha, "carga_id": carga}
            for linha in municipios.sedes_para_linhas(
                receita.sedes([arquivo], alvos), tom_para_ibge, pasta
            )
        )
    log.info("  %d de %d CNPJs com município IBGE", len(sedes), len(alvos))

    with conexao.transaction():
        persistencia.gravar_municipios(conexao, linhas_municipios, carga_tom)
        persistencia.gravar_cnpjs_municipio(conexao, sedes)


def _restos_a_pagar_do_ano(ano: int) -> dict:
    """Soma os arquivos mensais de execução do ano.

    ATENÇÃO: No ano corrente, o mês que o Portal ainda não publicou devolve erro: a soma para no
    último publicado, e `meses` diz até onde foi.

    RISCO: Só 403 e 404 querem dizer "ainda não publicado". O 405 que sobra depois
    das tentativas é limite de taxa: tratá-lo como fim do ano gravaria 4
    meses como se fossem o ano até agora — aconteceu na primeira carga.
    """
    hoje = date.today()
    meses: list[dict] = []
    sigilosas: list[dict] = []
    arquivos: list[tuple[str, Path]] = []

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
        arquivos.append((portal.url(orcamento.EXECUCAO.format(ano=ano, mes=mes)), arquivo))

    return {
        **orcamento.somar_meses(meses), "meses": len(meses), "sigilosas": sigilo.somar_acoes(sigilosas),
        "arquivos": arquivos,
    }


def _cartao_do_ano(ano: int) -> tuple[dict[str, dict], int, list[tuple[str, Path]]]:
    """Soma os extratos mensais do cartão corporativo. Mesma regra de parada da execução.

    Devolve também os arquivos lidos, para a carga registrar cada um.
    """
    hoje = date.today()
    meses: list[dict] = []
    arquivos: list[tuple[str, Path]] = []

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
        arquivos.append((portal.url(sigilo.RECURSO_DO_CARTAO.format(ano=ano, mes=mes)), arquivo))

    return sigilo.somar_cartao(meses), len(meses), arquivos


def _defesa_civil(conexao: psycopg.Connection, anos: list[int]) -> None:
    """O cartão de pagamento da Defesa Civil, mês a mês (ver `defesa_civil.py`).

    ATENÇÃO: mês com 403 ou 404 é pulado, e não encerra o ano como no cartão corporativo: o
    Portal deixou de publicar meses no meio da série (jan/2023, nov/2025), e parar ali perderia
    o resto do ano. O log diz quais faltaram.

    Cada mês troca sozinho, numa transação, com a carga do arquivo dele.
    """
    hoje = date.today()
    faltaram: list[str] = []
    publicados: list[tuple[int, int]] = []
    for ano in anos:
        for mes in range(1, 13):
            if (ano, mes) > (hoje.year, hoje.month):
                break
            recurso = defesa_civil.RECURSO.format(ano=ano, mes=mes)
            sufixo = f"-{hoje:%Y%m%d}" if (ano, mes) >= (hoje.year, hoje.month - 1) else ""
            arquivo = portal.baixar_publicado(recurso, CACHE / f"cpdc-{ano}{mes:02d}{sufixo}.zip")
            if arquivo is None:
                faltaram.append(f"{mes:02d}/{ano}")
                continue

            publicados.append((ano, mes))
            carga = _carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(recurso), arquivo)
            tabela = portal.ler_csv(arquivo, defesa_civil.arquivo_do_mes(ano, mes),
                                    colunas=list(colunas_da_fonte(LinhaDoCartaoDaDefesaCivil).values()))
            gastos = defesa_civil.transformar(entrada.ler_tabela(LinhaDoCartaoDaDefesaCivil, tabela))
            with conexao.transaction():
                gravados = persistencia.gravar_defesa_civil(conexao, ano, mes, gastos, carga)
            log.info("  %02d/%d: R$ %.1f mi em %d executores", mes, ano,
                     sum(g.valor for g in gastos) / 1e6, gravados)

    buracos = [mes for mes in faltaram if _antes_do_ultimo_publicado(mes, publicados)]
    if buracos:
        log.warning("Extratos do cartão da Defesa Civil que o Portal não publicou: %s", ", ".join(buracos))


def _viagens(conexao: psycopg.Connection, anos: list[int]) -> None:
    """As viagens a serviço de cada ano (ver `viagens.py`). Um ZIP por ano, que o Portal regera.

    ATENÇÃO: o ZIP do ano tem centenas de MB. Cada membro é lido só nas colunas do contrato, e o
    ano troca inteiro numa transação.
    """
    hoje = date.today()
    for ano in anos:
        recurso = viagens.RECURSO.format(ano=ano)
        sufixo = f"-{hoje:%Y%m%d}" if ano >= hoje.year - 1 else ""
        arquivo = portal.baixar(recurso, CACHE / f"viagens-{ano}{sufixo}.zip")
        carga = _carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(recurso), arquivo)

        def ler(qual: str, contrato: type):
            tabela = portal.ler_csv(arquivo, viagens.membro(ano, qual), colunas=list(colunas_da_fonte(contrato).values()))
            return entrada.ler_tabela(contrato, tabela)

        lidas = ler("viagem", LinhaDeViagem)
        orgaos = viagens.por_orgao(ano, ler("pagamento", LinhaDePagamentoDeViagem), lidas)
        destinos = viagens.destinos(ano, ler("trecho", LinhaDeTrechoDeViagem), viagens.orgao_da_viagem(lidas))
        with conexao.transaction():
            persistencia.gravar_viagens(conexao, ano, orgaos, destinos, carga)
        log.info("  %d: R$ %.1f mi em diárias, R$ %.1f mi em passagens, %d viagens, %d destinos", ano,
                 sum(o.diarias for o in orgaos) / 1e6, sum(o.passagens for o in orgaos) / 1e6,
                 sum(o.viagens for o in orgaos), len(destinos))


def _compras(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Os contratos publicados de cada ano, mês a mês (ver `compras.py`).

    Mês com 403 ou 404 é pulado e nomeado no log, como no cartão da Defesa Civil. O ano troca
    inteiro numa transação; a carga de cada linha é a do arquivo do mês dela, e a dos contratados,
    a do último mês lido.
    """
    hoje = date.today()
    for ano in anos:
        por_orgao: list = []
        linhas_do_ano: list = []
        cargas: dict[int, int] = {}
        faltaram: list[str] = []
        for mes in range(1, 13):
            if (ano, mes) > (hoje.year, hoje.month):
                break
            recurso = compras.RECURSO.format(ano=ano, mes=mes)
            sufixo = f"-{hoje:%Y%m%d}" if (ano, mes) >= (hoje.year, hoje.month - 1) else ""
            arquivo = portal.baixar_publicado(recurso, CACHE / f"compras-{ano}{mes:02d}{sufixo}.zip")
            if arquivo is None:
                faltaram.append(f"{mes:02d}/{ano}")
                continue
            cargas[mes] = _carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(recurso), arquivo)
            tabela = portal.ler_csv(arquivo, compras.membro(ano, mes), colunas=list(colunas_da_fonte(LinhaDeCompra).values()))
            linhas = entrada.ler_tabela(LinhaDeCompra, tabela)
            por_orgao.append((cargas[mes], compras.por_orgao(ano, mes, linhas)))
            linhas_do_ano.extend(linhas)

        if not cargas:
            continue
        contratados = compras.contratados(ano, linhas_do_ano)
        with conexao.transaction():
            persistencia.gravar_compras(conexao, ano, por_orgao, contratados, cargas[max(cargas)])
        log.info("  %d: %d contratos, R$ %.1f mi pelo valor final, %d contratados%s", ano,
                 sum(c.contratos for _, linhas in por_orgao for c in linhas),
                 sum(c.valor for _, linhas in por_orgao for c in linhas) / 1e6, len(contratados),
                 f"; o Portal não publicou {', '.join(faltaram)}" if faltaram else "")


def _compras_centralizadas(conexao: psycopg.Connection, anos: list[int]) -> None:
    """O CPCC mês a mês (ver `compras_centralizadas.py`). Mês com 403 ou 404 é pulado, como no CPDC."""
    hoje = date.today()
    for ano in anos:
        meses = 0
        for mes in range(1, 13):
            if (ano, mes) > (hoje.year, hoje.month):
                break
            recurso = compras_centralizadas.RECURSO.format(ano=ano, mes=mes)
            sufixo = f"-{hoje:%Y%m%d}" if (ano, mes) >= (hoje.year, hoje.month - 1) else ""
            arquivo = portal.baixar_publicado(recurso, CACHE / f"cpcc-{ano}{mes:02d}{sufixo}.zip")
            if arquivo is None:
                continue
            carga = _carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(recurso), arquivo)
            tabela = portal.ler_csv(arquivo, compras_centralizadas.arquivo_do_mes(ano, mes),
                                    colunas=list(colunas_da_fonte(LinhaDeCompraCentralizadaNoCartao).values()))
            linhas = compras_centralizadas.transformar(
                entrada.ler_tabela(LinhaDeCompraCentralizadaNoCartao, tabela))
            with conexao.transaction():
                persistencia.gravar_compras_centralizadas(conexao, ano, mes, linhas, carga)
            meses += 1
        log.info("  %d: CPCC de %d meses", ano, meses)


DIAS_PARA_TRAS_DO_RETRATO = 7
"""O retrato do CEIS e do CNEP sai de um dia para o outro; se o de hoje ainda não saiu, vale o mais recente da semana."""


def _sancoes(conexao: psycopg.Connection) -> None:
    """O CEIS e o CNEP do dia (ver `sancoes.py`). Os dois cadastros trocam juntos, numa transação."""
    todas: list = []
    cargas: list[int] = []
    for cadastro in sancoes.CADASTROS:
        arquivo, data = _retrato_mais_recente(cadastro)
        cargas.append(_carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(f"{cadastro}/{data}"), arquivo))
        colunas = list(colunas_da_fonte(LinhaDeSancao).values()) + (["VALOR DA MULTA"] if cadastro == "cnep" else [])
        tabela = portal.ler_csv(arquivo, sancoes.membro(cadastro, data), colunas=colunas)
        linhas = entrada.ler_tabela(LinhaDeSancao, tabela)
        multas = tabela["VALOR DA MULTA"].tolist() if cadastro == "cnep" else None
        todas.extend(sancoes.para_empresas(linhas, multas))
        log.info("  %s de %s: %d linhas, %d sanções a empresa", cadastro.upper(), data, len(linhas),
                 sum(1 for s in todas if s.cadastro == cadastro.upper()))
    with conexao.transaction():
        persistencia.gravar_sancoes(conexao, todas, max(cargas))


def _retrato_mais_recente(cadastro: str) -> tuple[Path, str]:
    """O ZIP mais recente do cadastro, voltando dia a dia até `DIAS_PARA_TRAS_DO_RETRATO`."""
    for dias in range(DIAS_PARA_TRAS_DO_RETRATO + 1):
        data = f"{date.fromordinal(date.today().toordinal() - dias):%Y%m%d}"
        try:
            return portal.baixar(f"{cadastro}/{data}", CACHE / f"{cadastro}-{data}.zip"), data
        except requests.HTTPError as erro:
            if erro.response is None or erro.response.status_code not in (403, 404):
                raise
    raise RuntimeError(f"Nenhum retrato do {cadastro.upper()} nos últimos {DIAS_PARA_TRAS_DO_RETRATO} dias.")


def _antes_do_ultimo_publicado(mes_ano: str, publicados: list[tuple[int, int]]) -> bool:
    """Mês que falta antes do último publicado é buraco; depois dele, é só o que ainda não saiu."""
    mes, ano = (int(parte) for parte in mes_ano.split("/"))
    return bool(publicados) and (ano, mes) < max(publicados)


def _reconciliar_autores(conexao: psycopg.Connection) -> None:
    """Sugere o vínculo código → pessoa, pelo nome normalizado.

    ATENÇÃO: Roda só sobre quem ainda NÃO está resolvido — nunca sobrescreve resolução
    manual.

    ATENÇÃO: **Ambiguidade não vira palpite:** se duas pessoas normalizam para o mesmo nome,
    o código fica sem vínculo e aparece na lista de pendências. Chutar seria pior — o
    erro ficaria congelado no código e invisível.

    RISCO: TODAS as pessoas, não só as com `cpf_hash` — filtrar por ele limitava a
    reconciliação aos 643 votantes da 57ª e deixava 241 autores soltos, gente que
    apresentou emenda para 2023 ainda na legislatura anterior (a LOA foi votada em
    2022). A ficha já filtra a legislatura corrente, então autoria antiga não polui.

    DECISÃO: O desempate da Pendência 47 — ver `_desempatar` — com quem votou na legislatura em que
    a emenda foi APRESENTADA: a de um ano entra na lei orçamentária votada no ano
    anterior, e o código do autor é de um mandato só (achado #24).

    ATENÇÃO: Era quem votou na legislatura corrente. Com as emendas de 2014 a 2022, isso
    escolheria o homônimo de hoje para a emenda de 2017 — e a emenda iria para a
    ficha de outra pessoa, sem erro nenhum.

    RISCO: REGRA B — o Portal renomeia o autor para o SUPLENTE que executa a emenda:
    "TIAGO DIMAS (EX-PARLAMENTAR LAZARO BOTELHO, NOS TERMOS ART. 78 LDO 2025)".
    O nome do sucessor não casa com ninguém, e a emenda fica órfã — mas ela é
    de quem a APRESENTOU. DECISÃO: Não é similaridade: é um rótulo da própria fonte.

    ATENÇÃO: Pendência é NORMAL: senadores e bancadas nunca terão dono na nossa base.
    """
    pendentes = persistencia.autores_nao_resolvidos(conexao)
    if not pendentes:
        log.info("Nenhum autor pendente de reconciliação.")
        return

    por_nome: dict[str, list[int]] = {}
    for pessoa_id, nome in conexao.execute(
        "SELECT id, nome_exibicao FROM pessoas"
    ).fetchall():
        por_nome.setdefault(normalizacao.sem_acento_maiusculo(nome), []).append(pessoa_id)

    anos_por_autor = persistencia.anos_dos_autores(conexao)
    votantes = persistencia.votantes_por_legislatura(conexao)
    corrente = max(votantes) if votantes else None

    def com_voto_de(codigo: str) -> set[int]:
        return votantes_do_mandato(anos_por_autor.get(codigo, set()), votantes, corrente)

    resolvidos = por_sucessor = por_desempate = ambiguos = 0

    for codigo, nome_autor in pendentes:
        candidatos = por_nome.get(normalizacao.sem_acento_maiusculo(nome_autor), [])

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
    """Qual das pessoas de mesmo nome é a autora, ou `None` se não dá para saber.

    ## RISCO: REGRA A — o homônimo histórico manufatura ambiguidade

    A busca é contra as **7.993 pessoas** do banco, quase todas de legislaturas antigas.
    MEDIDO: Medido em 2026-08-29, isso criava **14** empates que não existem na realidade:

    | Deputado em exercício | "Concorrente" |
    |---|---|
    | Bebeto — Carlos Roberto Rodrigues, 1.117 votos | *BEBETO* — Adalberto Souza Galvão, **0 votos** |
    | Albuquerque — José F. Lopes, 933 votos | *ALBUQUERQUE* — Manoel J. de Albuquerque, **0 votos** |

    DECISÃO: **Quem não tem voto nenhum na base não aparece em tela nenhuma** — e não é
    o autor de emenda de 2024. Se sobra **exatamente um** com voto, é ele.

    ## Por que isto não é chute

    | Evidência | |
    |---|---|
    | Concorrente ser senador em exercício | RISCO: **0 de 14** — era o risco real, porque senador apresenta emenda |
    | Destino da emenda bate com a UF do parlamentar | DECISÃO: **50 de 56** · 2 discordam · 4 sem UF |
    | Emendas de 2024 em diante, que só a 57ª podia apresentar | 82% |

    ATENÇÃO: **Ambiguidade REAL continua sem vínculo**, e deve continuar: `ÁTILA DE MELO LIRA`
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

    ## RISCO: O segundo valor é o id NA CÂMARA, não `pessoas.id`

    ATENÇÃO: **Isto mudou em 2026-08-29, depois de o defeito se materializar.** A Pendência 47
    registrava `--resolver 4511=43` para o Allan Garcês. Depois de uma reingestão:

    | | |
    |---|---|
    | Quando foi registrado | `43` = Allan Garcês |
    | RISCO: Hoje | `43` = **André Ferreira** · Allan Garcês virou o **31** |

    `pessoas.id` é `BIGSERIAL` e é **reatribuído** quando a base é recarregada. Não Um
    comando anotado no dia anterior colocaria as emendas de um parlamentar na ficha de
    outro — **em silêncio**, porque a FK aceita qualquer id que exista.

    DECISÃO: O id da Câmara vem da fonte e nunca muda. É o mesmo que aparece na URL do
    perfil oficial e em `pessoa_fonte_ids`.

    RISCO: Entrada malformada **estoura**, não é ignorada: `--resolver 4184` sem o `=`
    seria descartado em silêncio, e a pessoa concluiria que vinculou quando não vinculou.

    ATENÇÃO: O id da fonte é numérico nas três (Câmara, Senado, TSE). Recusar aqui pega
    o typo com uma mensagem útil, em vez de devolver "ninguém com id_externo".
    """
    pares: list[tuple[str, str]] = []

    for entrada in entradas:
        codigo, separador, externo = entrada.partition("=")
        if not separador or not codigo.strip() or not externo.strip():
            raise ValueError(
                f"'{entrada}' não é CODIGO=ID_NA_CAMARA. Ex.: --resolver 4184=204521"
            )

        if not externo.strip().isdigit():
            raise ValueError(f"'{externo.strip()}' não é um id da Câmara")

        pares.append((codigo.strip(), externo.strip()))

    return pares


def _resolver_a_mao(conexao: psycopg.Connection, entradas: list[str]) -> None:
    """Pendência 45 — vincula autor de emenda à mão, a saída dos ambíguos.

    Dois parlamentares com o mesmo nome de urna não são separáveis por texto: a
    reconciliação automática desiste de propósito e quem decide é uma pessoa. Fica
    gravado como `MANUAL`, que execução automática posterior nunca sobrescreve.

    RISCO: Resolve o id ESTÁVEL da fonte para a chave interna, na hora de aplicar —
    nunca o contrário. Ver `pares_de_resolucao`.

    A FK pegaria o id inexistente, mas com mensagem do Postgres; aqui dá para
    dizer o que fazer.
    """
    for codigo, id_externo in pares_de_resolucao(entradas):
        pessoa = conexao.execute(
            """
            SELECT p.id, p.nome_exibicao
              FROM pessoas p
              JOIN pessoa_fonte_ids f ON f.pessoa_id = p.id
             WHERE f.id_externo = %s
            """,
            (id_externo,),
        ).fetchone()

        if not pessoa:
            raise RuntimeError(
                f"ninguém com id_externo {id_externo}. ATENÇÃO: É o id NA CÂMARA (o da URL do "
                f"perfil oficial), não `pessoas.id` — que muda a cada reingestão."
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


def _cpf(conexao: psycopg.Connection, todas_as_legislaturas: bool = False) -> None:
    """Completa `cpf_hash` das duas casas — e cada uma tem um caminho.

    Câmara: a API REST publica o CPF, uma requisição por deputado.
    Senado: não publica. O caminho é o nome civil contra a prestação de contas do TSE,
    em `_nome_civil_dos_senadores` e `_cpf_dos_senadores`.
    """
    _cpf_dos_deputados(conexao, todas_as_legislaturas)
    _nome_civil_dos_senadores(conexao)
    _cpf_dos_senadores(conexao, todas_as_legislaturas)
    _fundir_pessoas(conexao)


def _fundir_pessoas(conexao: psycopg.Connection) -> None:
    """Uma pessoa só para quem tem o mesmo CPF ou o mesmo título de eleitor: o deputado que virou senador, o parlamentar que virou prefeito."""
    with conexao.transaction():
        fundidas = persistencia.fundir_pessoas(conexao, persistencia.pares_do_mesmo_cpf(conexao))
    log.info("Pessoas fundidas pelo CPF (deputado e senador): %d.", fundidas)


def _rechavear_cpf(conexao: psycopg.Connection) -> None:
    """Pendência 77 — refaz com a chave atual todo hash de CPF que está no banco.

    Serve para a troca do SHA-256 sem chave pelo HMAC, e para a rotação da chave. Um hash
    não se converte em outro sem o CPF, então cada tabela é recarregada da fonte:

    | Tabela | Coluna | Recarga |
    |---|---|---|
    | `pessoas` | `cpf_hash` | `cpf` |
    | `despesas` | `cnpj_ou_hash` | `cota`, nos anos que estão no banco |
    | `receitas_de_campanha` | `doador_cnpj_ou_hash` | `fundo`, nas eleições que estão no banco |
    | `patrimonios` | a ponte pelo `cpf_hash` | `patrimonio`, nas eleições que estão no banco |
    | `pessoas` | `titulo_hash`, e o `cpf_hash` de quem não está no Congresso | `mandatos`, que acha a pessoa pela candidatura e devolve os dois |

    RISCO: Até o fim, as tabelas misturam as duas chaves e o cruzamento entre elas falha em
    silêncio. Se o comando parar no meio, rode de novo: cada etapa substitui o seu recorte.
    """
    anos_da_cota = [linha[0] for linha in conexao.execute(
        "SELECT DISTINCT ano FROM despesas ORDER BY 1").fetchall()]
    eleicoes = [linha[0] for linha in conexao.execute(
        "SELECT DISTINCT ano_eleicao FROM receitas_de_campanha ORDER BY 1").fetchall()]
    anos_do_patrimonio = [linha[0] for linha in conexao.execute(
        "SELECT DISTINCT ano_eleicao FROM patrimonios ORDER BY 1").fetchall()]
    eleicoes_dos_mandatos = [linha[0] for linha in conexao.execute(
        "SELECT DISTINCT ano_eleicao FROM mandatos ORDER BY 1").fetchall()]

    apagados = conexao.execute(
        "UPDATE pessoas SET cpf_hash = NULL, titulo_hash = NULL WHERE cpf_hash IS NOT NULL OR titulo_hash IS NOT NULL").rowcount
    log.info("cpf_hash apagado de %d pessoas; refazendo com a chave atual.", apagados)
    _cpf(conexao, todas_as_legislaturas=True)

    if anos_da_cota:
        _cota(conexao, anos_da_cota)
    for eleicao in eleicoes:
        _fundo(conexao, eleicao, None)
    if anos_do_patrimonio:
        _patrimonio(conexao, anos_do_patrimonio)
    if eleicoes_dos_mandatos:
        _mandatos(conexao, eleicoes_dos_mandatos)

    refeitos = conexao.execute("SELECT count(cpf_hash) FROM pessoas").fetchone()[0]
    log.info("Rechaveado: %d de %d pessoas voltaram a ter cpf_hash.", refeitos, apagados)


def _cpf_dos_deputados(conexao: psycopg.Connection, todas_as_legislaturas: bool = False) -> None:
    """Completa `cpf_hash` a partir da API REST da Câmara.

    RISCO: **Por que existe um comando só para isto:** a coluna `cpf` do CSV em bloco vem
    VAZIA — 0 de 7.889. O valor só existe em `/api/v2/deputados/{id}`, **uma requisição
    por deputado**.

    DECISÃO: E vale a viagem: contra a prestação de contas do TSE, o CPF casou **15 de 15**,
    contra 14 de 15 do nome civil.

    ATENÇÃO: O CPF em claro existe apenas **em memória** — o que vai para o banco é o hash.

    RISCO: a origem registrada é um índice das consultas (deputado e endereço), SEM a resposta: ela
    traz o CPF em claro, que o projeto não grava em lugar nenhum. O hash prova o índice, não a resposta.

    ATENÇÃO: Uma pausa curta: são centenas de requisições seguidas contra um serviço
    público, e não há motivo para apertá-lo.

    RISCO: Perda grande significa layout mudado ou bloqueio — não "alguns sem CPF".
    """
    faltantes = persistencia.pessoas_sem_cpf(conexao, todas_as_legislaturas)
    if not faltantes:
        log.info("Todos os deputados com voto já têm cpf_hash.")
        return

    log.info("Buscando CPF de %d deputados...", len(faltantes))

    achados_com_hash: list[tuple[int, str]] = []
    consultados: list[dict] = []
    for i, (id_camara, pessoa_id) in enumerate(faltantes, 1):
        cpf = camara.cpf_do_deputado(id_camara)
        hash_cpf = normalizacao.hash_de_cpf(cpf)
        consultados.append({"id_camara": id_camara, "url": f"{camara.API}/deputados/{id_camara}"})

        if hash_cpf:
            achados_com_hash.append((pessoa_id, hash_cpf))

        time.sleep(PAUSA_ENTRE_CHAMADAS)

        if i % 100 == 0:
            log.info("  %d de %d...", i, len(faltantes))

    carga = _carga_de_resposta(
        conexao, TipoFonteDeCarga.CAMARA, f"{camara.API}/deputados", consultados,
        CACHE / "respostas" / f"cpf-deputados-{datetime.now():%Y%m%d-%H%M%S}.json",
    )
    for pessoa_id, hash_cpf in achados_com_hash:
        persistencia.gravar_cpf_hash(conexao, pessoa_id, hash_cpf, carga)
    achados = len(achados_com_hash)
    log.info("  %d de %d com CPF", achados, len(faltantes))

    if achados < len(faltantes) * 0.8:
        log.warning(
            "  ATENÇÃO: Menos de 80%% dos deputados tinham CPF. A API mudou ou está limitando?"
        )


# As duas eleições que compõem a 57ª legislatura do Senado: a Casa renova por terços
# alternados, então metade das cadeiras vem de 2018 e a outra de 2022.
ELEICOES_DO_SENADO = (2010, 2014, 2018, 2022)


def _nome_civil_dos_senadores(conexao: psycopg.Connection) -> int:
    """Completa `nome_civil` pelo detalhe do Senado. É a chave para casar com o TSE.

    A lista de exercício traz `NomeCompletoParlamentar` dos 81 de hoje; os suplentes que
    devolveram a cadeira só aparecem nos votos, e o voto não tem nome completo. O
    endpoint de detalhe responde para qualquer código.

    Só grava se for DIFERENTE do nome parlamentar: gravar o mesmo texto deixaria a
    pessoa fora de `senadores_sem_nome_civil` na próxima execução, escondendo que
    o Senado não tem o dado dela.
    """
    faltantes = persistencia.senadores_sem_nome_civil(conexao)
    if not faltantes:
        log.info("Todos os senadores com voto já têm nome civil.")
        return 0

    log.info("Buscando nome civil de %d senadores...", len(faltantes))

    respostas: dict[str, dict | None] = {}
    nomes: list[tuple[int, str]] = []
    for codigo, pessoa_id in faltantes:
        identificacao = senado.baixar_senador(codigo)
        respostas[codigo] = identificacao
        completo = (identificacao or {}).get("NomeCompletoParlamentar")
        parlamentar = (identificacao or {}).get("NomeParlamentar")

        if completo and completo.strip() != (parlamentar or "").strip():
            nomes.append((pessoa_id, completo.strip()))

        time.sleep(PAUSA_ENTRE_CHAMADAS)

    carga = _carga_de_resposta(
        conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/senador/", respostas,
        CACHE / "respostas" / f"senadores-detalhe-{datetime.now():%Y%m%d-%H%M%S}.json",
    )
    for pessoa_id, nome in nomes:
        persistencia.gravar_nome_civil(conexao, pessoa_id, nome, carga)
    achados = len(nomes)

    log.info("  %d de %d com nome civil", achados, len(faltantes))
    return achados


def _cpf_dos_senadores(conexao: psycopg.Connection, todas_as_legislaturas: bool = False) -> None:
    """Completa `cpf_hash` dos senadores casando o nome civil contra o TSE.

    RISCO: **O Senado não publica CPF.** A prestação de contas eleitoral publica: cada
    candidato a Senador aparece com `NM_CANDIDATO` (civil), `SG_UF` e
    `NR_CPF_CANDIDATO`. O casamento é por **nome civil + UF**, nunca por nome
    sozinho — homônimo em estados diferentes é outra pessoa, e atribuir a campanha de um
    a outro daria número plausível e errado.

    ATENÇÃO: **Teto conhecido:** suplentes não prestam contas próprias. Quem assumiu a cadeira
    sem ter sido eleito titular não está no arquivo, e continua sem `cpf_hash`. Isso
    não é falha de carga — é alcance da fonte, e a tela precisa dizer isso em vez de
    mostrar zero como se fosse medida.

    Chave repetida entre as duas eleições com CPF diferente é ambiguidade, e
    ambiguidade não se resolve escolhendo uma.
    """
    pendentes = persistencia.senadores_para_casar(conexao, todas_as_legislaturas)
    if not pendentes:
        log.info("Todos os senadores com voto já têm cpf_hash.")
        return

    mapa: dict[tuple[str, str], tuple[str, int] | None] = {}
    for eleicao in ELEICOES_DO_SENADO:
        arquivo = CACHE / f"prestacao-contas-{eleicao}.zip"
        if not arquivo.exists():
            url = tse.url_de_prestacao_de_contas(eleicao)
            if not tse.existe(url):
                log.warning("  TSE não respondeu para %s; seguindo sem essa eleição", url)
                continue
            arquivo = tse.baixar(url, arquivo)

        do_ano = receitas.cpf_de_senadores(arquivo, eleicao)
        carga_do_ano = _carga_do_arquivo(conexao, "TSE", tse.url_de_prestacao_de_contas(eleicao), arquivo)
        log.info("  %d candidatos a Senador em %d", len(do_ano), eleicao)

        for chave, cpf in do_ano.items():
            if chave in mapa and (mapa[chave] is None or mapa[chave][0] != cpf):
                mapa[chave] = None
            else:
                mapa.setdefault(chave, (cpf, carga_do_ano))

    if not mapa:
        log.warning("Nenhum candidato a Senador lido do TSE; cpf_hash não foi tocado.")
        return

    casados = ambiguos = 0
    for pessoa_id, nome_civil, uf in pendentes:
        achado = mapa.get((normalizacao.sem_acento_maiusculo(nome_civil), uf.upper()))
        if achado is None:
            ambiguos += (normalizacao.sem_acento_maiusculo(nome_civil), uf.upper()) in mapa
            continue

        cpf, carga_do_cpf = achado
        hash_cpf = normalizacao.hash_de_cpf(cpf)
        if hash_cpf:
            persistencia.gravar_cpf_hash(conexao, pessoa_id, hash_cpf, carga_do_cpf)
            casados += 1

    log.info("  %d de %d senadores casados por nome civil + UF", casados, len(pendentes))
    if ambiguos:
        log.warning("  %d ficaram de fora por ambiguidade de nome + UF", ambiguos)


def _cota(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Cota parlamentar — o gasto de gabinete que vai para a ficha do deputado.

    ATENÇÃO: O descarte é NORMAL (lideranças, órgãos, valor zero), mas em volume alto
    significa de-para incompleto — e aí a ficha mostraria gasto a menos.
    """
    mapa = _mapa_pessoas(conexao)
    if not mapa:
        raise RuntimeError(
            "De-para de pessoas vazio. Rode `ingerir` antes: sem ele, nenhuma despesa "
            "encontra dono e tudo seria descartado em silêncio."
        )

    for ano in anos:
        log.info("Cota de %d...", ano)

        arquivo = camara.baixar_cota(ano, CACHE / f"cota-{ano}.zip")
        linhas = camara.ler_cota(arquivo)
        camara.conferir_volume_de_cota(linhas, ano)
        carga = _carga_do_arquivo(conexao, TipoFonteDeCarga.CAMARA, camara.URL_COTA.format(ano=ano), arquivo)

        transformado = cota.transformar_camara(linhas, mapa)
        gravadas = persistencia.gravar_despesas(conexao, list(mapa.values()), transformado.despesas, carga)
        conta = cota.reconciliar(transformado, "COTA_CAMARA", ano)
        persistencia.gravar_reconciliacoes(conexao, [conta], carga)
        _registrar_o_que_nao_fecha([conta])

        log.info("  %d linhas, %d gravadas", len(linhas), gravadas)
        if transformado.descartes:
            log.warning(
                "  %d descartadas, por motivo: %s",
                len(transformado.descartes), dict(Counter(d.motivo for d in transformado.descartes)),
            )

    _cota_do_senado(conexao, anos)


def _cota_do_senado(conexao: psycopg.Connection, anos: list[int]) -> None:
    """CEAPS — a cota do Senado, na MESMA tabela `despesas` da Camara.

    A tabela ja e generica: a ficha consulta por `pessoa_id`, entao o senador passa a
    ter gasto de gabinete sem tocar em API nem em tela.

    O de-para e por NOME parlamentar, porque a CEAPS nao publica id. Quem nao casa e
    descartado: atribuir gasto por semelhanca seria inventar dono.

    O ano civil atravessa a posse: janeiro ainda é da legislatura anterior. O
    de-para é o das duas, e o senador de mandato de 8 anos é a mesma pessoa nelas.

    Descarte alto significa de-para incompleto ou nome grafado diferente — e a
    ficha mostraria gasto a menos, sem erro.
    """
    for ano in anos:
        log.info("CEAPS de %d...", ano)

        legislaturas = sorted(
            {ingestao.legislatura_da_data(f"{ano}-01-15"), ingestao.legislatura_da_data(f"{ano}-12-15")}
        )
        por_nome = persistencia.senadores_por_nome(conexao, legislaturas)
        if not por_nome:
            log.info("  nenhum senador votou em %s; CEAPS de %d não lida.", legislaturas, ano)
            continue

        arquivo = senado.baixar_ceaps(ano, CACHE / f"ceaps-{ano}.csv")
        linhas = senado.ler_ceaps(arquivo)
        carga = _carga_do_arquivo(conexao, TipoFonteDeCarga.SENADO, senado.CEAPS.format(ano=ano), arquivo)

        transformado = cota.transformar_senado(linhas, por_nome)
        gravadas = persistencia.gravar_despesas(conexao, list(por_nome.values()), transformado.despesas, carga)
        conta = cota.reconciliar(transformado, "COTA_SENADO", ano)
        persistencia.gravar_reconciliacoes(conexao, [conta], carga)
        _registrar_o_que_nao_fecha([conta])

        log.info("  %d linhas, %d gravadas", len(linhas), gravadas)

        if len(transformado.descartes) > len(linhas) * 0.2:
            nao_casaram = sorted(
                {
                    normalizacao.sem_acento_maiusculo(linha.nome_do_senador)
                    for linha in linhas
                    if normalizacao.sem_acento_maiusculo(linha.nome_do_senador) not in por_nome
                }
            )
            log.warning(
                "  %d de %d descartadas. Nomes sem de-para: %s",
                len(transformado.descartes), len(linhas), ", ".join(nao_casaram[:10]) or "-",
            )


def _fundo(conexao: psycopg.Connection, eleicao: int, arquivo: Path | None) -> None:
    """Financiamento de campanha — o fundão e o resto, ligados por CPF.

    RISCO: **Depende de `cpf` ter rodado antes.** Sem `cpf_hash` em `pessoas`, o de-para sai
    vazio e **toda** linha do TSE é descartada — 396 MB lidos para gravar zero, com log
    de sucesso. É exatamente o tipo de falha silenciosa que este projeto já pagou caro.

    Vários arquivos significa que o TSE não publicou o consolidado — e aí o DF fica
    de fora, ver `receitas.nomes_de_receita`.

    O cargo esperado sai da casa em que a pessoa votou. Sem isto, a campanha ao
    Senado que um deputado atual PERDEU entraria no financiamento dele.

    RISCO: Separados pelo mesmo motivo que no banco: somá-los é decisão de quem analisa.

    Casar pouco não é erro do TSE, é `cpf` incompleto — e sem o aviso a ficha
    mostraria financiamento zerado para a maioria, sem ninguém perceber.
    """
    hashes = persistencia.mapa_de_cpf_hash(conexao)
    if not hashes:
        raise RuntimeError(
            "Nenhuma pessoa com `cpf_hash`. Rode `cpf` antes: o join com o TSE é por "
            "hash de CPF, e sem ele toda receita seria descartada em silêncio."
        )

    log.info("De-para: %d pessoas com CPF hasheado", len(hashes))

    url = tse.url_de_prestacao_de_contas(eleicao)
    if arquivo is None:
        if not tse.existe(url):
            raise tse.ErroDeAcessoAoTse(
                f"O TSE não respondeu para {url}. Se for 403, a receita de headers "
                "caiu; baixe à mão e use --arquivo. Ver docs/12-fonte-tse.md §2.2."
            )
        arquivo = tse.baixar(url, CACHE / f"prestacao-contas-{eleicao}.zip")

    carga = _carga_do_arquivo(conexao, "TSE", url, arquivo)

    nomes = receitas.nomes_de_receita(arquivo, eleicao)
    if not nomes:
        raise RuntimeError(
            f"Nenhum `receitas_candidatos_{eleicao}_*.csv` dentro de {arquivo.name}. "
            "O layout do ZIP mudou?"
        )

    log.info(
        "%d arquivo(s) de receita: %s", len(nomes),
        "consolidado" if len(nomes) == 1 else f"{len(nomes)} estaduais (sem DF)",
    )

    casas = persistencia.casa_por_pessoa(conexao)
    fora_do_congresso = persistencia.pessoas_fora_do_congresso(conexao)
    por_candidatura = {
        c: p for c, p in persistencia.candidaturas_dos_mandatos(conexao, eleicao).items() if p in fora_do_congresso
    }
    log.info("  %d candidaturas eleitas de fora do Congresso (Pendência 90)", len(por_candidatura))

    todas: list[dict] = []
    for nome in nomes:
        linhas = receitas.para_linhas(
            receitas.ler_receitas(arquivo, nome), hashes, eleicao, casas, por_candidatura
        )
        todas.extend(linhas)

        if linhas:
            log.info("  %s — %d linhas de quem está na base", nome, len(linhas))

    gravadas = persistencia.gravar_receitas(conexao, eleicao, todas, carga)
    resumo = receitas.resumir(todas)

    log.info(
        "Eleição %d: %d receitas gravadas, %d pessoas",
        eleicao, gravadas, int(resumo["parlamentares"]),
    )
    log.info(
        "  total R$ %.2f · fundo especial (FEFC) R$ %.2f",
        resumo["total"], resumo["fundo_especial"],
    )

    if eleicao % 4 == 0:
        log.info("  eleição municipal: a conferência contra os deputados da legislatura não vale aqui")
        return

    legislatura = ingestao.legislatura_da_data(f"{eleicao + 1}-03-01")
    da_legislatura = {
        linha[0] for linha in conexao.execute(
            """
            SELECT DISTINCT p.id FROM pessoas p
             WHERE p.cpf_hash IS NOT NULL
               AND EXISTS (SELECT 1 FROM votos v JOIN votacoes t ON t.id = v.votacao_id
                            WHERE v.pessoa_id = p.id AND t.legislatura = %s)
            """,
            (legislatura,),
        ).fetchall()
    }
    eleitos = len(da_legislatura)
    casados = len({linha["pessoa_id"] for linha in todas} & da_legislatura)
    if eleitos and casados < eleitos * 0.5:
        log.warning(
            "  só %d de %d com CPF e voto na %dª casaram com a eleição de %d. Rode `cpf` de novo, "
            "ou confira se a eleição é a que elegeu a legislatura.",
            casados, eleitos, legislatura, eleicao,
        )
    else:
        log.info("  %d de %d com CPF e voto na %dª têm receita na eleição de %d", casados, eleitos, legislatura, eleicao)


def _curar(conexao: psycopg.Connection, casa: str, legislatura: int, limite: int) -> None:
    """Pendência 11 — reduz o universo às votações que valem leitura humana.

    Não grava pergunta nenhuma. A polaridade sugerida é auxílio: atribuí-la
    automaticamente é o erro que este projeto persegue, porque um sinal invertido não
    aparece na tela, aparece como número plausível.

    DECISÃO: A EMENTA primeiro, e a descrição depois. A descrição diz o NÚMERO do
    projeto; a ementa diz sobre o que ele é — e é dela que sai a pergunta.

    ATENÇÃO: 3 das 266 substantivas não têm proposição vinculada. Dizer isso é
    melhor que omitir a linha: quem cura precisa saber que vai ter de
    procurar a matéria à mão.
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
        if candidata.ementa:
            log.info("    ementa: %s", candidata.ementa[:150])
        else:
            log.info("    ementa: (sem proposicao vinculada - procure pelo numero)")
        log.info("    votacao: %s", candidata.descricao[:110])

    log.info("")
    log.info("A afirmacao em linguagem leiga e a polaridade FINAL sao leitura humana.")
    log.info("Formato: src/Poligraph.Migrations/curadoria/perguntas-lote-1.json")


def _materias_do_senado(conexao: psycopg.Connection, votacoes_brutas: list[dict]) -> None:
    """A ementa das votações do Senado — o que a descrição não diz.

    ## RISCO: Por que

    A descrição diz o NÚMERO do projeto:

    > *"Votação nominal do Projeto de Lei Complementar nº 124, de 2022, nos termos do
    > parecer."*

    Sem a matéria, os votos do Senado não têm assunto nenhum — a ficha do senador
    lista vinte linhas assim, e a curadoria do questionário vira adivinhação. É o mesmo
    buraco que a Pendência 40 fechou na Câmara.

    ## ATENÇÃO: Uma chamada por matéria

    Não há arquivo em lote: o Senado publica matéria a matéria. São ~360 chamadas por
    carga completa, e por isso só se baixa o que ainda não está no banco — recarregar
    o ano inteiro toda vez custaria minutos sem trazer nada novo.

    DECISÃO: Só o que falta. A ementa não muda depois de a matéria ser apresentada, e a
    releitura custaria uma requisição por matéria a cada execução.

    RISCO: O vínculo cobre TODAS as votações do ano, não só as recém-baixadas: matéria
    já no banco continua precisando ser apontada pelas votações novas.
    """
    codigos = {}
    for votacao in votacoes_brutas:
        codigo = votacao.get("codigoMateria")
        sessao = votacao.get("codigoSessaoVotacao")
        if codigo and sessao:
            codigos[f"SF-{sessao}"] = str(codigo)

    if not codigos:
        return

    with conexao.cursor() as cursor:
        cursor.execute(
            "SELECT id FROM proposicoes WHERE casa = 'SENADO' AND id = ANY(%s) AND carga_id IS NOT NULL",
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
        carga_das_materias = _carga_de_resposta(
            conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/materia/", [m for m in materias if m is not None],
            CACHE / "respostas" / f"materias-{date.today():%Y%m%d-%H%M%S}.json",
        )
        persistencia.gravar_proposicoes(conexao, linhas, carga_das_materias)

    todas = {v: c for v, c in codigos.items()}
    ligados = persistencia.vincular_proposicoes(
        conexao,
        {v: int(c) for v, c in todas.items() if c.isdigit()},
        casa=TipoCasa.SENADO,
    )

    log.info("  %d matérias gravadas, %d votações vinculadas", len(linhas), ligados)


def _simbolicas(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Conta as simbólicas dos anos pedidos sem reingerir os votos: lê o arquivo de votações do
    cache e baixa só o que faltar. O `ingerir` já conta as do ano que carrega."""
    for ano in anos:
        arquivo = CACHE / f"votacoes-{ano}.csv"
        if arquivo.exists():
            carga = _carga_do_arquivo(conexao, TipoFonteDeCarga.CAMARA, camara.url_do_arquivo("votacoes", ano), arquivo)
        else:
            arquivo, carga = _baixar_da_camara(conexao, "votacoes", ano)
        total = persistencia.gravar_simbolicas(
            conexao, TipoCasa.CAMARA, ano, ingestao.simbolicas_por_legislatura(camara.ler_csv(arquivo)), carga
        )
        log.info("  %d: %d votações simbólicas", ano, total)


def _populacao(conexao: psycopg.Connection) -> None:
    """A população estimada pelo IBGE em cada município, o divisor do mapa por habitante.

    A carga é do IBGE, com o arquivo da API no cache e na procedência, como as outras.
    """
    from .fontes import ibge

    arquivo = ibge.baixar(CACHE / "ibge" / f"populacao-{date.today():%Y%m%d}.json")
    carga = _carga_do_arquivo(conexao, "IBGE", ibge.URL, arquivo)
    linhas = ibge.ler(arquivo)
    com_populacao = persistencia.gravar_populacao(conexao, linhas, carga)
    ano = max((l["ano"] for l in linhas), default=None)
    log.info("População %s: %d municípios no arquivo, %d com população na base", ano, len(linhas), com_populacao)


def _recusas(contagem: dict[int, int]) -> str:
    """"3 de 429, 1 sem resposta": as recusas do Tesouro para o log."""
    return ", ".join(f"{n} {'sem resposta' if codigo == 0 else f'de {codigo}'}" for codigo, n in sorted(contagem.items())) or "nenhuma"


ESPERA_DEPOIS_DO_BLOQUEIO = 120
"""Segundos de pausa depois que o Tesouro bloqueia um município até o fim das tentativas."""


def _siconfi(conexao: psycopg.Connection, anos: list[int], municipios: list[str] | None, arquivo: Path | None = None) -> None:
    """As contas anuais das prefeituras, da DCA que cada uma entrega ao Tesouro (Pendência 90, fase 5).

    Uma requisição por município, anexo e ano: a API não responde sem o município. Uma de cada vez.
    MEDIDO em 2026-10-22: com quatro, o Tesouro respondeu 429 em menos de 3 minutos; com duas, depois de
    quatro anos carregados no mesmo dia, o bloqueio passou das oito tentativas e derrubou a carga.

    O progresso vai para `siconfi/dca-{ano}-parcial.json` a cada 100 municípios: rodar de novo continua
    de onde parou. O município que o Tesouro bloqueia fica para uma segunda rodada, depois de uma pausa;
    se ainda faltar algum, o comando para e diz quais, sem gravar o ano pela metade.

    DECISÃO: a procedência guarda as linhas que entram na conta (as contas de `siconfi.py`), não a
    resposta inteira: o ano inteiro passaria de 800 MB, e o resto do anexo não chega ao banco.
    """
    import requests

    from . import siconfi
    from .contratos.siconfi import LinhaDaDca
    from .fontes import siconfi as fonte

    usadas = {siconfi.CONTA_DA_RECEITA} | siconfi.CONTAS_DA_DESPESA
    if arquivo is not None:
        _siconfi_do_arquivo(conexao, anos, arquivo)
        return
    codigos = municipios or [linha[0] for linha in conexao.execute("SELECT codigo_ibge FROM municipios ORDER BY 1").fetchall()]

    def do_municipio(ano: int, codigo: str):
        receitas = fonte.consultar(ano, fonte.ANEXO_DE_RECEITAS, codigo)
        despesas = fonte.consultar(ano, fonte.ANEXO_DE_DESPESAS, codigo) if receitas else []
        lidas_r = entrada.ler(LinhaDaDca, receitas)
        lidas_d = entrada.ler(LinhaDaDca, despesas)
        guardar = [r for r in receitas + despesas if r.get("cod_conta") in usadas]
        return codigo, siconfi.contas_para_linha(codigo, ano, lidas_r, lidas_d), guardar

    for ano in anos:
        inicio = time.monotonic()
        parcial = CACHE / "siconfi" / f"dca-{ano}-parcial.json"
        feito = json.loads(parcial.read_text(encoding="utf-8")) if parcial.exists() and not municipios else {"respostas": {}, "sem_declaracao": []}
        respostas: dict = feito["respostas"]
        sem_declaracao: list = feito["sem_declaracao"]
        ja = set(respostas) | set(sem_declaracao)
        if ja:
            log.info("  %d: retomando, %d municípios já consultados", ano, len(ja))

        def guardar_progresso() -> None:
            parcial.parent.mkdir(parents=True, exist_ok=True)
            parcial.write_text(json.dumps({"respostas": respostas, "sem_declaracao": sem_declaracao}, ensure_ascii=False), encoding="utf-8")

        pendentes = [c for c in codigos if c not in ja]
        for rodada in (1, 2):
            falharam = []
            for i, codigo in enumerate(pendentes, 1):
                try:
                    _, linha, guardar = do_municipio(ano, codigo)
                except requests.RequestException as erro:
                    log.warning("  %d: %s sem resposta do Tesouro (%s); fica para depois", ano, codigo, type(erro).__name__)
                    falharam.append(codigo)
                    time.sleep(ESPERA_DEPOIS_DO_BLOQUEIO)
                    continue
                if linha is None:
                    sem_declaracao.append(codigo)
                else:
                    respostas[codigo] = guardar
                if i % 100 == 0:
                    guardar_progresso()
                if i % 100 == 0:
                    log.info("  %d: %d de %d municípios consultados (%.0f s); recusas do Tesouro até aqui: %s",
                             ano, len(respostas) + len(sem_declaracao), len(codigos), time.monotonic() - inicio,
                             _recusas(fonte.RECUSAS))
            guardar_progresso()
            pendentes = falharam
            if not pendentes:
                break
        if pendentes:
            raise SystemExit(
                f"{ano}: o Tesouro não respondeu para {len(pendentes)} municípios ({', '.join(pendentes[:10])}...). "
                f"O progresso está em {parcial}; rode de novo para continuar de onde parou.")

        lidas = {c: entrada.ler(LinhaDaDca, g) for c, g in respostas.items()}
        linhas = [
            linha for c, l in lidas.items()
            if (linha := siconfi.contas_para_linha(
                c, ano, [x for x in l if x.cod_conta == siconfi.CONTA_DA_RECEITA], [x for x in l if x.cod_conta in siconfi.CONTAS_DA_DESPESA]))
        ]
        carga = _carga_de_resposta(
            conexao, TipoFonteDeCarga.TESOURO, f"{fonte.URL}?an_exercicio={ano}", respostas,
            CACHE / "siconfi" / f"dca-{ano}-{date.today():%Y%m%d}.json",
        )
        with conexao.transaction():
            if municipios:
                conexao.execute("DELETE FROM contas_dos_municipios WHERE ano = %s AND codigo_ibge = ANY(%s)", (ano, codigos))
                persistencia.gravar_contratos(conexao, linhas, carga)
            else:
                persistencia.gravar_contas_dos_municipios(conexao, [ano], linhas, carga)
        log.info("  %d: %d municípios com DCA, %d sem declaração, em %.0f s; recusas do Tesouro: %s", ano, len(linhas), len(sem_declaracao),
                 time.monotonic() - inicio, _recusas(fonte.RECUSAS))
        parcial.unlink(missing_ok=True)


def _siconfi_do_arquivo(conexao: psycopg.Connection, anos: list[int], arquivo: Path) -> None:
    """Regrava um ano da DCA a partir da resposta guardada pelo `siconfi`, sem as 11 mil consultas ao Tesouro.

    O arquivo é o que o `siconfi` grava em `siconfi/dca-{ano}-{data}.json`: as linhas usadas, por município.
    MEDIDO em 2026-10-22: a carga de 2024 levou 77 minutos e caiu na gravação; com o arquivo, segundos.
    """
    from . import siconfi
    from .contratos.siconfi import LinhaDaDca
    from .fontes import siconfi as fonte

    if len(anos) != 1:
        raise SystemExit("Com --arquivo, um ano só: o arquivo é de um ano.")
    ano = anos[0]
    carga = _carga_do_arquivo(conexao, TipoFonteDeCarga.TESOURO, f"{fonte.URL}?an_exercicio={ano}", arquivo)
    respostas = json.loads(arquivo.read_text(encoding="utf-8"))
    linhas = []
    for codigo, guardadas in respostas.items():
        lidas = entrada.ler(LinhaDaDca, guardadas)
        receitas = [l for l in lidas if l.cod_conta == siconfi.CONTA_DA_RECEITA]
        despesas = [l for l in lidas if l.cod_conta in siconfi.CONTAS_DA_DESPESA]
        if (linha := siconfi.contas_para_linha(codigo, ano, receitas, despesas)) is not None:
            linhas.append(linha)
    with conexao.transaction():
        persistencia.gravar_contas_dos_municipios(conexao, [ano], linhas, carga)
    log.info("  %d: %d municípios com DCA, do arquivo %s", ano, len(linhas), arquivo.name)


def _reclassificar(conexao: psycopg.Connection) -> None:
    """A2 — aplica a regra de categoria atual a toda votação gravada, sem baixar nada.

    A categoria muda o peso da votação no grafo; depois de mudar, rode `analisar` nas
    legislaturas que o log lista. Pergunta do questionário que mudasse de categoria
    derruba o comando: a curadoria escolheu a votação pela categoria antiga.
    """
    from .normalizacao import classificar_categoria

    votacoes = conexao.execute("SELECT id, casa, legislatura, categoria, descricao FROM votacoes").fetchall()
    perguntas = {linha[0] for linha in conexao.execute("SELECT votacao_id FROM perguntas WHERE ativa").fetchall()}

    mudancas = [
        (id_, casa, legislatura, antiga, nova)
        for id_, casa, legislatura, antiga, descricao in votacoes
        if (nova := classificar_categoria(descricao)) != antiga
    ]
    afetadas = [m[0] for m in mudancas if m[0] in perguntas]
    if afetadas:
        raise RuntimeError(f"A regra nova muda a categoria de perguntas ativas: {afetadas}")

    with conexao.transaction():
        for id_, _, _, _, nova in mudancas:
            conexao.execute("UPDATE votacoes SET categoria = %s WHERE id = %s", (nova, id_))

    contagem = Counter((casa, legislatura, antiga, nova) for _, casa, legislatura, antiga, nova in mudancas)
    log.info("Reclassificar: %d de %d votações mudaram de categoria", len(mudancas), len(votacoes))
    for (casa, legislatura, antiga, nova), n in sorted(contagem.items()):
        log.info("  %s %dª: %d de %s para %s", casa, legislatura, n, antiga, nova)


def _palavras_chave(conexao: psycopg.Connection, limite: int | None) -> None:
    """Pendência 70 — busca as palavras-chave das proposições votadas que ainda não as têm.

    Câmara pela API (`keywords`), Senado pela matéria (`IndexacaoMateria`). Uma requisição
    por proposição, com pausa curta, gravando de 100 em 100: interromper no meio não perde o
    que já veio, e a próxima execução retoma pelas nulas.
    """
    pendentes = persistencia.proposicoes_sem_palavras_chave(conexao)
    if limite is not None:
        pendentes = pendentes[:limite]
    log.info("Palavras-chave: %d proposições a consultar", len(pendentes))

    lote: list[tuple[str, int, str]] = []
    falhas = 0

    def gravar(lote: list[tuple[str, int, str]]) -> None:
        """Cada lote, por casa, vira um arquivo com as respostas, registrado com o hash antes de gravar."""
        for casa in (TipoCasa.CAMARA, TipoCasa.SENADO):
            da_casa = [linha for linha in lote if linha[0] == casa]
            if not da_casa:
                continue
            url = f"{camara.API}/proposicoes" if casa == TipoCasa.CAMARA else f"{senado.BASE}/materia/"
            carga = _carga_de_resposta(
                conexao, casa, url, [{"id": id_, "palavras_chave": p} for _, id_, p in da_casa],
                CACHE / "respostas" / f"palavras-chave-{casa.lower()}-{datetime.now():%Y%m%d-%H%M%S-%f}.json",
            )
            persistencia.gravar_palavras_chave(conexao, da_casa, carga)

    for posicao, (casa, id_proposicao) in enumerate(pendentes, 1):
        if casa == TipoCasa.CAMARA:
            palavras = camara.palavras_chave_da_proposicao(id_proposicao)
        else:
            materia = senado.baixar_materia(str(id_proposicao))
            palavras = None if materia is None else materia.get("indexacao") or ""
        if palavras is None:
            falhas += 1
        else:
            lote.append((casa, id_proposicao, palavras))
        if len(lote) >= 100:
            gravar(lote)
            lote = []
            log.info("  %d de %d", posicao, len(pendentes))
        time.sleep(0.05)

    gravar(lote)
    if falhas:
        log.warning("  %d não responderam; ficam para a próxima execução", falhas)


def _amostra(conexao: psycopg.Connection, por_grupo: int, semente: int) -> None:
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

    saida = CACHE / f"amostra-{date.today():%Y%m%d}.csv"
    saida.parent.mkdir(parents=True, exist_ok=True)
    with saida.open("w", newline="", encoding="utf-8") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=list(linhas[0].keys()) if linhas else ["casa"])
        escritor.writeheader()
        escritor.writerows(linhas)
    log.info("Amostra gravada em %s", saida)


TAMANHO_DO_LOTE_DE_SEDES = 500

def _sedes_brasilapi(conexao: psycopg.Connection, limite: int | None) -> None:
    """Pendência 71 — a sede dos CNPJs que o cadastro da Receita em bloco não resolveu.

    Em lotes de 500: cada lote vira um arquivo JSONL com os quatro campos (sem sócios), uma
    carga com o hash dele e a gravação. Interromper no meio não perde os lotes gravados, e a
    próxima execução retoma pelos que faltam.

    DECISÃO: A carga é da fonte RECEITA, com a URL da BrasilAPI: o dado é o cadastro aberto
    da Receita, e o caminho por onde ele veio fica escrito.
    """
    pendentes = persistencia.cnpjs_sem_sede(conexao)
    if limite is not None:
        pendentes = pendentes[:limite]
    conhecidos = persistencia.codigos_ibge(conexao)
    log.info("Sedes pela BrasilAPI: %d CNPJs a consultar", len(pendentes))

    hoje = date.today()
    cadastro_de = hoje.replace(day=1).isoformat()
    pasta = CACHE / "brasilapi"
    pasta.mkdir(parents=True, exist_ok=True)

    achadas = sem_resposta = fora_da_tabela = 0
    ritmo = brasilapi.Ritmo()
    for inicio in range(0, len(pendentes), TAMANHO_DO_LOTE_DE_SEDES):
        lote = pendentes[inicio:inicio + TAMANHO_DO_LOTE_DE_SEDES]
        respostas = []
        for cnpj in lote:
            sede = brasilapi.sede(cnpj, ritmo)
            if sede is None:
                sem_resposta += 1
            elif sede["codigo_ibge"] not in conhecidos:
                fora_da_tabela += 1
            else:
                respostas.append(sede)

        if respostas:
            arquivo = pasta / f"sedes-{hoje:%Y%m%d}-{inicio // TAMANHO_DO_LOTE_DE_SEDES:03d}.jsonl"
            arquivo.write_text(
                "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in respostas), encoding="utf-8"
            )
            carga = _carga_do_arquivo(conexao, "RECEITA", f"{brasilapi.BASE}/", arquivo)
            persistencia.gravar_cnpjs_municipio(
                conexao,
                [{"cnpj": r["cnpj"], "codigo_ibge": r["codigo_ibge"], "cadastro_de": cadastro_de} for r in respostas],
                carga,
            )
            achadas += len(respostas)
        log.info("  %d de %d: %d com sede gravada; pausa %.2f s, %d recusas até aqui",
                 inicio + len(lote), len(pendentes), achadas, ritmo.pausa, ritmo.recusas)

    log.info(
        "Sedes: %d gravadas, %d sem resposta (ficam para a próxima), %d com município fora da tabela",
        achadas, sem_resposta, fora_da_tabela,
    )


def _rotina(conexao: psycopg.Connection, frequencia: str) -> None:
    """Pendência 64 — roda as etapas da rotina, na ordem, e para na primeira que falhar.

    DECISÃO: Parar, e não seguir: depois de uma carga que falhou, o `conferir` julgaria um
    banco pela metade, e a próxima rotina refaz tudo de qualquer jeito. O Coolify mostra a
    tarefa como falha, com o log da etapa.
    """
    lista = rotina.etapas(frequencia, date.today())
    log.info("Rotina %s: %s", frequencia, " · ".join(str(etapa) for etapa in lista))

    _travar_rotina(conexao)
    try:
        for numero, etapa in enumerate(lista, 1):
            log.info("Etapa %d de %d: %s", numero, len(lista), etapa)
            _executar_etapa(conexao, etapa)
        _avisar_que_terminou(conexao, frequencia)
    finally:
        conexao.execute("SELECT pg_advisory_unlock(%s)", (TRAVA_DA_ROTINA,))


def _avisar_que_terminou(conexao: psycopg.Connection, frequencia: str) -> None:
    """Pendência 89 — grava em `eventos` que a rotina passou por todas as etapas.

    O worker de notificações lê esse registro e avisa quem segue. Só chega aqui a rotina que
    não falhou: a que parou no meio não grava evento, e ninguém é avisado sobre dado pela metade.
    """
    conexao.execute("INSERT INTO eventos (tipo) VALUES (%s)", (f"ROTINA_{frequencia.upper()}",))
    log.info("Evento ROTINA_%s gravado para o worker de notificações.", frequencia.upper())


TRAVA_DA_ROTINA = 64_2026
"""Chave da trava do Postgres que impede duas rotinas ao mesmo tempo (Pendência 64)."""


def _travar_rotina(conexao: psycopg.Connection) -> None:
    """Espera a outra rotina terminar, se houver uma rodando.

    DECISÃO (2026-10-15): esperar, e não desistir. A semanal e a mensal caem no mesmo dia algumas
    vezes por ano; desistindo, a mensal do mês se perderia. A trava é da sessão: cai sozinha se o
    processo morrer, e a conexão da ETL é autocommit, então nenhuma transação a segura.
    """
    if conexao.execute("SELECT pg_try_advisory_lock(%s)", (TRAVA_DA_ROTINA,)).fetchone()[0]:
        return
    log.info("Outra rotina está rodando; esperando ela terminar.")
    conexao.execute("SELECT pg_advisory_lock(%s)", (TRAVA_DA_ROTINA,))
    log.info("A outra rotina terminou; seguindo.")


def _executar_etapa(conexao: psycopg.Connection, etapa: rotina.Etapa) -> None:
    """Os mesmos comandos da linha de comando; `analisar` vai na legislatura corrente da casa."""
    anos = etapa.argumentos.get("anos", [])
    if etapa.comando == "ingerir":
        _ingerir(conexao, anos)
    elif etapa.comando == "senado":
        _senado(conexao, anos)
    elif etapa.comando == "em-exercicio":
        _em_exercicio(conexao)
    elif etapa.comando == "palavras-chave":
        _palavras_chave(conexao, None)
    elif etapa.comando == "cota":
        _cota(conexao, anos)
    elif etapa.comando == "emendas":
        _emendas(conexao, anos)
    elif etapa.comando == "populacao":
        _populacao(conexao)
    elif etapa.comando == "simbolicas":
        _simbolicas(conexao, anos)
    elif etapa.comando == "sedes-brasilapi":
        _sedes_brasilapi(conexao, None)
    elif etapa.comando == "convenios":
        _convenios(conexao)
    elif etapa.comando == "governo":
        _governo(conexao, anos, etapa.argumentos["eleicao"])
    elif etapa.comando == "defesa-civil":
        _defesa_civil(conexao, anos)
    elif etapa.comando == "viagens":
        _viagens(conexao, anos)
    elif etapa.comando == "compras":
        _compras(conexao, anos)
    elif etapa.comando == "sancoes":
        _sancoes(conexao)
    elif etapa.comando == "compras-centralizadas":
        _compras_centralizadas(conexao, anos)
    elif etapa.comando == "municipios":
        _municipios(conexao, None)
    elif etapa.comando == "fundo":
        _fundo(conexao, etapa.argumentos["eleicao"], None)
    elif etapa.comando == "siconfi":
        _siconfi(conexao, etapa.argumentos["anos"], None)
    elif etapa.comando == "mandatos":
        _mandatos(conexao, etapa.argumentos["eleicoes"])
    elif etapa.comando == "patrimonio":
        _patrimonio(conexao, anos)
    elif etapa.comando == "redes":
        _redes(conexao, anos)
    elif etapa.comando == "analisar":
        casa = etapa.argumentos["casa"]
        corrente = conexao.execute(
            "SELECT max(legislatura) FROM votacoes WHERE casa = %s", (casa,)).fetchone()[0]
        if corrente is not None:
            _analisar(conexao, corrente, casa)
    elif etapa.comando == "conferir":
        _conferir(conexao)
    elif etapa.comando == "limpar-cache":
        _limpar_cache()
    else:
        raise ValueError(f"Etapa sem execução: {etapa.comando}")


def _em_exercicio(conexao: psycopg.Connection) -> None:
    """Quem está em exercício hoje, pela lista oficial de cada casa (decisão do autor, 2026-10-18).

    Roda depois de `ingerir` e `senado`, que criam as pessoas. Uma casa com lista curta derruba a
    carga antes de gravar: o worker tiraria da lista de seguidos de todo mundo quem faltasse.
    """
    hoje = f"{date.today():%Y%m%d}"

    deputados = camara.baixar_deputados_em_exercicio()
    carga = _carga_de_resposta(conexao, TipoFonteDeCarga.CAMARA, camara.URL_EM_EXERCICIO, deputados,
                               CACHE / "respostas" / f"deputados-em-exercicio-{hoje}.json")
    pessoas_da_camara = _mapa_pessoas(conexao, TipoFonteDeIdentificador.CAMARA)
    resultado = em_exercicio.da_camara(deputados, pessoas_da_camara)
    legislatura = next((linha.legislatura for linha in resultado.linhas if linha.legislatura), None)
    licenciados = _licenciados_da_camara(conexao, deputados, legislatura, pessoas_da_camara) if legislatura else []
    gravadas = persistencia.gravar_em_exercicio(conexao, TipoCasa.CAMARA, em_exercicio.juntar(resultado.linhas, licenciados), carga)
    log.info("  Câmara: %d gravados (%d licenciados), %d sem pessoa no banco ainda",
             gravadas, len(licenciados), resultado.sem_pessoa)

    senadores = senado.baixar_senadores()
    carga = _carga_de_resposta(conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/senador/lista/atual", senadores,
                               CACHE / "respostas" / f"senadores-em-exercicio-{hoje}.json")
    pessoas_do_senado = _mapa_pessoas(conexao, TipoFonteDeIdentificador.SENADO)
    resultado = em_exercicio.do_senado(senadores, pessoas_do_senado)
    afastados = senado.baixar_afastados()
    _carga_de_resposta(conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/senador/afastados", afastados,
                       CACHE / "respostas" / f"senadores-afastados-{hoje}.json")
    licenciados = em_exercicio.licenciados_do_senado(afastados, pessoas_do_senado)
    gravadas = persistencia.gravar_em_exercicio(conexao, TipoCasa.SENADO, em_exercicio.juntar(resultado.linhas, licenciados), carga)
    log.info("  Senado: %d gravados (%d licenciados), %d sem pessoa no banco ainda",
             gravadas, len(licenciados), resultado.sem_pessoa)


def _licenciados_da_camara(conexao: psycopg.Connection, em_exercicio_hoje: list[dict], legislatura: int,
                           pessoas: dict[str, int]) -> list:
    """Os licenciados da Câmara: a situação de cada deputado da legislatura que não está em exercício.

    Uma consulta por deputado fora do exercício (MEDIDO em 2026-10-19: 135 na 57ª, ~30 s). A resposta
    de cada um é guardada em `respostas/`, como a de redes e CPF.
    """
    da_legislatura = camara.deputados_da_legislatura(legislatura)
    fora = {str(d.get("id")) for d in da_legislatura} - {str(d.get("id")) for d in em_exercicio_hoje}
    situacoes = {id_camara: camara.situacao_do_deputado(id_camara) for id_camara in sorted(fora)}
    _carga_de_resposta(conexao, TipoFonteDeCarga.CAMARA, f"{camara.API}/deputados/{{id}}", situacoes,
                       CACHE / "respostas" / f"situacao-dos-deputados-{date.today():%Y%m%d}.json")
    return em_exercicio.licenciados_da_camara(situacoes, pessoas, legislatura)


def _limpar_cache() -> None:
    """Apaga do cache o que venceu, pelas regras de `limpeza`. Não toca no banco."""
    log.info("Limpando o cache em %s...", CACHE)
    limpeza.limpar(CACHE, time.time())


def _conferir(conexao: psycopg.Connection) -> None:
    """Pendência 66 — confere o banco inteiro. Não Escreve nada; falha se alguma regra der ERRO.

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


def _validar(conexao: psycopg.Connection, legislatura: int, divisao_minima: float) -> None:
    """RF-20 e a validação do questionário. Não escreve no banco — é medição.

    ═══ 1. Quantas perguntas bastam ═══

    ═══ 1b. Desempate dirigido × aleatório ═══

    ═══ 2. Comunidade × partido (RF-20 / RQ2) ═══
    ATENÇÃO: Da CÂMARA e da legislatura validada (Pendência 54): "a mais recente" de qualquer casa
    comparava a matriz da Câmara com as comunidades do Senado quando ele rodava por
    último.
    """
    pessoas, votacoes, matriz, _ = _montar_matriz(conexao, legislatura)
    log.info("Matriz: %d pessoas × %d votações", len(pessoas), len(votacoes))

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

    _comparar_desempates(matriz, candidatas)

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

    RISCO: O grupo de controle é o que faz isto valer como evidência. Sem ele, o encolhimento
    do empate poderia vir apenas de perguntar mais — e a "contribuição técnica" seria
    só um contador de perguntas.

    ATENÇÃO: Amostra de deputados, não todos: são 655 × 6 rodadas × duas estratégias.
    """
    sorteio = np.random.default_rng(20260826)
    base = sorted(sorteio.choice(candidatas, size=base_inicial, replace=False).tolist())
    restantes = [candidata for candidata in candidatas if candidata not in base]

    quem_avaliar = sorteio.choice(matriz.shape[0], size=120, replace=False)

    def media_por_rodada(dirigido: bool) -> list[float]:
        """ATENÇÃO: Séries têm comprimentos diferentes: quem chega a 1 para antes. O último
        valor é repetido para a média não subir artificialmente ao perdê-los.
        """
        series = [
            validacao.simular_desempate(
                matriz, int(pessoa), base, restantes, rodadas=6, dirigido=dirigido
            )
            for pessoa in quem_avaliar
        ]
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
    """ATENÇÃO: `grafo.montar` espera `.pessoa_a`, `.pessoa_b` e `.valor`."""

    pessoa_a: int
    pessoa_b: int
    valor: float


def _partido_mais_recente(conexao: psycopg.Connection, legislatura: int) -> dict[int, str]:
    """ATENÇÃO: Partido vem do voto, não da pessoa: o registro é histórico e deputado troca.

    ATENÇÃO: O último voto DENTRO da legislatura validada: comparar comunidade × partido de 2019
    com a sigla de 2025 mediria a troca de partido, não o agrupamento.
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

    ATENÇÃO: Conta só posicionamento (Sim ou Não). Ausência e abstenção ficam de fora, pelo
    mesmo motivo do cálculo de afinidade: quem não se posicionou não discordou.

    RISCO: **E só as de peso maior que zero.** PROCEDIMENTAL tem peso 0 e não entra em
    nenhuma conta de similaridade — contá-la aqui produz um número que a tela exibe e
    o método não usou.

    ATENÇÃO: Medido: o Soldado Noelio aparecia com **40 votações** e nenhuma ligação, e 24
    daquelas 40 eram procedimentais. Um leitor olharia "40 votações" ao lado do mínimo
    de 20 e concluiria, com razão, que o corte estava errado — quando o que ele tinha
    eram 16. Número exibido que não é o número usado é o modo de falha deste projeto.
    """
    posicionou = (~np.isnan(matriz)) & (matriz != 0) & (pesos > 0)

    return {pessoa: int(posicionou[i].sum()) for i, pessoa in enumerate(pessoas)}


def _mapa_pessoas(conexao: psycopg.Connection, fonte: str = TipoFonteDeIdentificador.CAMARA) -> dict[str, int]:
    """`id_externo` -> `pessoa_id`, por fonte.

    A fonte é parâmetro porque a mesma pessoa pode ter id nas duas casas: 41 dos 81
    senadores já foram deputados (achado #18). Misturar as duas faria o voto de senador
    procurar dono entre ids da Câmara e ser descartado inteiro.
    """
    linhas = conexao.execute(
        "SELECT id_externo, pessoa_id FROM pessoa_fonte_ids WHERE fonte = %s", (fonte,)
    ).fetchall()
    return {str(externo): pessoa_id for externo, pessoa_id in linhas}


def _montar_matriz(conexao: psycopg.Connection, legislatura: int, casa: str = TipoCasa.CAMARA):
    """Monta a matriz pessoa × votação de UMA casa.

    Só votações nominais de plenário, e não secretas. Votação de comissão fica de fora:
    é 3× mais consensual que plenário (39% contra 12% de quase unanimidade), e misturá-la
    achataria a similaridade. No Senado o filtro de sigilo é o que mais corta — 239 das
    421 votações da legislatura.

    A casa é parâmetro, e nunca uma matriz só: as duas casas não votam as mesmas
    matérias, então similaridade entre deputado e senador não teria denominador
    (achado #7). São dois grafos independentes.

    As pessoas saem dos votos DESTA casa. Sem o recorte, a matriz ganharia 643
    deputados de linhas inteiramente vazias ao analisar o Senado — e o kNN passaria a
    comparar quem não tem voto em comum nenhum.
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
