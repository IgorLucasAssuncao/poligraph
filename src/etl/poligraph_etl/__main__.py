"""Orquestrador do ETL.

ATENÇÃO: Não é serviço: roda, faz o trabalho e morre. Em produção é uma Scheduled Task do
Coolify, dentro do VPS — o Postgres nunca sai de lá.

    python -m poligraph_etl ingerir  --anos 2023 2024 2025 2026
    python -m poligraph_etl analisar --legislatura 57
"""

import argparse
import logging
import os
import sys
import time
from datetime import date
from pathlib import Path

import psycopg

from .comandos import analise, cidades, congresso, eleicoes, emendas, governo, orquestracao, pessoas, qualidade
from .governo import selic
from .nucleo import conexao as conexao_mod
from .nucleo import persistencia, rotina, telemetria
from .nucleo.tipos import TipoCasa
from .qualidade import amostra

log = logging.getLogger("poligraph")

COMANDOS_QUE_SO_LEEM = {"conferir", "limpar-cache", "amostra", "validar"}
"""Os que não gravam no banco: depois deles, o `ANALYZE` não tem o que refazer."""


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
                congresso.rodar_ingerir(conexao, args.anos)
            elif args.comando == "senado":
                congresso.rodar_senado(conexao, args.anos)
            elif args.comando == "curar":
                analise.rodar_curar(conexao, args.casa, args.legislatura, args.limite)
            elif args.comando == "emendas":
                if args.resolver:
                    emendas.resolver_a_mao(conexao, args.resolver)
                else:
                    emendas.rodar_emendas(conexao, args.anos)
            elif args.comando == "governo":
                governo.rodar_governo(conexao, args.anos, args.eleicao)
            elif args.comando == "defesa-civil":
                governo.rodar_defesa_civil(conexao, args.anos)
            elif args.comando == "viagens":
                governo.rodar_viagens(conexao, args.anos)
            elif args.comando == "compras":
                governo.rodar_compras(conexao, args.anos)
            elif args.comando == "sancoes":
                governo.rodar_sancoes(conexao)
            elif args.comando == "em-exercicio":
                congresso.rodar_em_exercicio(conexao)
            elif args.comando == "compras-centralizadas":
                governo.rodar_compras_centralizadas(conexao, args.anos)
            elif args.comando == "convenios":
                emendas.rodar_convenios(conexao)
            elif args.comando == "patrimonio":
                eleicoes.rodar_patrimonio(conexao, args.anos)
            elif args.comando == "mandatos":
                eleicoes.rodar_mandatos(conexao, args.eleicoes)
            elif args.comando == "selic":
                governo.rodar_selic(conexao, args.desde)
            elif args.comando == "redes":
                eleicoes.rodar_redes(conexao, args.anos)
            elif args.comando == "municipios":
                cidades.rodar_municipios(conexao, args.diretorio)
            elif args.comando == "cpf":
                pessoas.rodar_cpf(conexao, args.todas_legislaturas)
            elif args.comando == "rechavear-cpf":
                orquestracao.rodar_rechavear_cpf(conexao)
            elif args.comando == "cota":
                congresso.rodar_cota(conexao, args.anos)
            elif args.comando == "fundo":
                eleicoes.rodar_fundo(conexao, args.eleicao, args.arquivo)
            elif args.comando == "conferir":
                qualidade.rodar_conferir(conexao)
            elif args.comando == "simbolicas":
                congresso.rodar_simbolicas(conexao, args.anos)
            elif args.comando == "populacao":
                cidades.rodar_populacao(conexao)
            elif args.comando == "fundir-pessoas":
                pessoas.rodar_fundir_pessoas(conexao)
            elif args.comando == "siconfi":
                cidades.rodar_siconfi(conexao, args.anos, args.municipios, args.arquivo)
            elif args.comando == "reclassificar":
                congresso.rodar_reclassificar(conexao)
            elif args.comando == "rotina":
                orquestracao.rodar_rotina(conexao, args.frequencia)
            elif args.comando == "limpar-cache":
                orquestracao.rodar_limpar_cache()
            elif args.comando == "tirar-cpf":
                pessoas.rodar_tirar_cpf(conexao)
            elif args.comando == "palavras-chave":
                congresso.rodar_palavras_chave(conexao, args.limite)
            elif args.comando == "inteiro-teor":
                congresso.rodar_inteiro_teor(conexao)
            elif args.comando == "sedes-brasilapi":
                cidades.rodar_sedes_brasilapi(conexao, args.limite)
            elif args.comando == "amostra":
                qualidade.rodar_amostra(conexao, args.por_grupo, args.semente)
            elif args.comando == "validar":
                analise.rodar_validar(conexao, args.legislatura, args.divisao_minima)
            else:
                for legislatura in analise.legislaturas_a_analisar(conexao, args):
                    analise.rodar_analisar(conexao, legislatura, args.casa)
            if args.comando not in COMANDOS_QUE_SO_LEEM:
                persistencia.atualizar_estatisticas(conexao)
    except Exception:
        log.exception("ETL falhou")
        return 1

    log.info("Concluído em %.1fs", time.monotonic() - inicio)
    return 0


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
    sub.add_parser(
        "inteiro-teor", help="endereço do texto integral das proposições votadas da Câmara, pelo arquivo anual de proposições"
    )
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
    sub.add_parser("tirar-cpf", help="tira o CPF do texto já gravado: nome de MEI, ementa (regra 3); rodar de novo não muda nada")
    sub.add_parser("limpar-cache", help="apaga do cache o que venceu: downloads com mais de 35 dias, procedência com mais de 180")
    sub.add_parser(
        "rechavear-cpf",
        help="refaz todo hash de CPF com a chave atual: pessoas, cota, campanha e patrimônio",
    )

    sub.add_parser(
        "convenios",
        help="completa CNPJ do convenente, situação e liberado dos convênios de emenda (Portal)",
    )
    sel = sub.add_parser("selic", help="a Selic de cada ano (Banco Central, SGS 4390), ao lado dos juros da dívida federal")
    sel.add_argument("--desde", type=int, default=selic.DESDE)
    man = sub.add_parser("mandatos", help="os eleitos de cada eleição (TSE): estaduais, governadores, prefeitos e vices")
    man.add_argument("--eleicoes", type=int, nargs="+", default=eleicoes.ELEICOES_DOS_MANDATOS)
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


if __name__ == "__main__":
    raise SystemExit(main())
