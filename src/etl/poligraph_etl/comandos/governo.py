"""O dinheiro do governo federal: orçamento e arrecadação, cartões, Defesa Civil, viagens, compras, sanções e a Selic."""

import logging
from datetime import date
from pathlib import Path

import psycopg
import requests

from ..fontes import bcb, portal
from ..governo import (
    arrecadacao, compras, compras_centralizadas, defesa_civil, orcamento, sancoes, selic, sigilo, viagens,
)
from ..nucleo import persistencia
from ..contratos import entrada
from ..contratos.entrada import colunas_da_fonte
from ..contratos.bcb import LinhaDaSerie
from ..nucleo.tipos import TipoFonteDeCarga
from ..contratos.portal import (
    LinhaDeCompra, LinhaDeCompraCentralizadaNoCartao, LinhaDeSancao, LinhaDeTrechoDeViagem, LinhaDeViagem, LinhaDePagamentoDeViagem, LinhaDoCartaoDaDefesaCivil,
)
from . import comum
from .comum import carga_de_resposta, carga_de_varios, carga_do_arquivo, reais
from .eleicoes import rodar_mandatos

log = logging.getLogger("poligraph")


def rodar_governo(conexao: psycopg.Connection, anos: list[int], eleicao: int) -> None:
    """O perfil do governo federal: a chapa eleita, quanto gastou e de onde veio o dinheiro.

    A chapa sai de `mandatos` (Pendência 56): este comando carrega os eleitos da eleição pelo `mandatos`,
    e a tabela `gestoes` deixou de ser gravada.

    É **contexto** da legislatura, não medida de afinidade, e não liga a parlamentar.

    ATENÇÃO: Os arquivos do ano corrente mudam todo dia; os dos anos fechados, não . O cache
    leva a data nos do ano corrente e não nos fechados — os meses de execução são 48
    arquivos de ~10 MB, e rebaixá-los todo dia seria meio gigabyte por nada.
    """
    rodar_mandatos(conexao, [eleicao])

    funcoes: list[dict] = []
    encargos: list[dict] = []
    receitas_do_periodo: list[dict] = []
    sigilosos: list[dict] = []
    contas_do_orcamento: list[tuple[dict, int]] = []
    divida: list[tuple[list, int]] = []

    for ano in anos:
        sufixo = f"-{date.today():%Y%m%d}" if ano >= date.today().year else ""

        arquivo = portal.baixar(
            orcamento.RECURSO.format(ano=ano), comum.CACHE / f"orcamento-{ano}{sufixo}.zip"
        )
        membro = orcamento.arquivo(ano)
        tabela = portal.ler_csv(arquivo, membro)
        carga_orcamento = carga_do_arquivo(
            conexao, "PORTAL_TRANSPARENCIA", portal.url(orcamento.RECURSO.format(ano=ano)), arquivo
        )
        do_ano = [{**l, "carga_id": carga_orcamento} for l in orcamento.para_linhas(tabela, portal.gerado_em(arquivo, membro))]
        encargos_do_ano = [{**l, "carga_id": carga_orcamento} for l in orcamento.encargos_para_linhas(tabela)]
        divida.append((orcamento.divida_para_linhas(tabela, portal.gerado_em(arquivo, membro)), carga_orcamento))

        restos = _restos_a_pagar_do_ano(ano)
        carga_das_acoes = carga_de_varios(
            conexao, "PORTAL_TRANSPARENCIA", f"{portal.url(orcamento.EXECUCAO.format(ano=ano, mes=1))[:-2]}*",
            restos["arquivos"], comum.CACHE / "indices" / f"execucao-{ano}.json",
        )
        for linha in do_ano:
            linha["restos_a_pagar_pagos"] = round(restos["por_funcao"].get(linha["codigo_funcao"], 0.0), 2)
        for linha in encargos_do_ano:
            linha["restos_a_pagar_pagos"] = round(restos["por_subfuncao"].get(linha["codigo_subfuncao"], 0.0), 2)

        pago_anual = sum(linha["pago"] for linha in do_ano)
        if restos["meses"] == 12:
            conta = orcamento.reconciliar_mensal_e_anual(ano, restos["pago"], pago_anual)
            contas_do_orcamento.append((conta, carga_orcamento))
            log.info("  %d: pago mensal %s, anual %s — diferença guardada na reconciliação",
                     ano, reais(restos["pago"]), reais(pago_anual))

        log.info("  %d: %d funções; restos a pagar pagos R$ %.1f bi (%d meses)",
                 ano, len(do_ano), sum(restos["por_funcao"].values()) / 1e9, restos["meses"])

        cartao, meses_do_cartao, arquivos_do_cartao = _cartao_do_ano(ano)
        carga_do_cartao = carga_de_varios(
            conexao, "PORTAL_TRANSPARENCIA", f"{portal.url(sigilo.RECURSO_DO_CARTAO.format(ano=ano, mes=1))[:-2]}*",
            arquivos_do_cartao, comum.CACHE / "indices" / f"cpgf-{ano}.json",
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
            arrecadacao.RECURSO.format(ano=ano), comum.CACHE / f"receitas-{ano}{sufixo}.zip"
        )
        membro_receita = arrecadacao.arquivo(ano)
        carga_receita = carga_do_arquivo(
            conexao, "PORTAL_TRANSPARENCIA", portal.url(arrecadacao.RECURSO.format(ano=ano)), arquivo_receita
        )
        receitas_do_periodo.extend({**l, "carga_id": carga_receita} for l in arrecadacao.para_linhas(
            portal.ler_csv(arquivo_receita, membro_receita),
            portal.gerado_em(arquivo_receita, membro_receita),
        ))

    with conexao.transaction():
        persistencia.gravar_orcamento(conexao, anos, funcoes)
        persistencia.gravar_encargos(conexao, anos, encargos)
        persistencia.gravar_divida_federal(conexao, anos, divida)
        persistencia.gravar_arrecadacao(conexao, anos, receitas_do_periodo)
        persistencia.gravar_sigilosos(conexao, anos, sigilosos)
        for conta, carga in contas_do_orcamento:
            persistencia.gravar_reconciliacoes(conexao, [conta], carga)


def rodar_selic(conexao: psycopg.Connection, desde: int) -> None:
    """A Selic de cada ano desde `desde`, capitalizada dos meses da série 4390 do Banco Central."""
    registros = bcb.baixar_serie(selic.SERIE_DA_SELIC_NO_MES, desde)
    carga = carga_de_resposta(
        conexao, TipoFonteDeCarga.BANCO_CENTRAL, bcb.url(selic.SERIE_DA_SELIC_NO_MES, desde), registros,
        comum.CACHE / f"selic-{date.today():%Y%m%d}.json",
    )
    linhas = selic.selic_para_linhas(entrada.ler(LinhaDaSerie, registros))
    with conexao.transaction():
        persistencia.gravar_selic(conexao, linhas, carga)
    log.info("Selic: %d anos, de %d a %d; o último com %d meses.", len(linhas), linhas[0].ano, linhas[-1].ano, linhas[-1].meses)


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
                comum.CACHE / f"execucao-{ano}{mes:02d}{sufixo}.zip",
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
                sigilo.RECURSO_DO_CARTAO.format(ano=ano, mes=mes), comum.CACHE / f"cpgf-{ano}{mes:02d}{sufixo}.zip"
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


def rodar_defesa_civil(conexao: psycopg.Connection, anos: list[int]) -> None:
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
            arquivo = portal.baixar_publicado(recurso, comum.CACHE / f"cpdc-{ano}{mes:02d}{sufixo}.zip")
            if arquivo is None:
                faltaram.append(f"{mes:02d}/{ano}")
                continue

            publicados.append((ano, mes))
            carga = carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(recurso), arquivo)
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


def rodar_viagens(conexao: psycopg.Connection, anos: list[int]) -> None:
    """As viagens a serviço de cada ano (ver `viagens.py`). Um ZIP por ano, que o Portal regera.

    ATENÇÃO: o ZIP do ano tem centenas de MB. Cada membro é lido só nas colunas do contrato, e o
    ano troca inteiro numa transação.
    """
    hoje = date.today()
    for ano in anos:
        recurso = viagens.RECURSO.format(ano=ano)
        sufixo = f"-{hoje:%Y%m%d}" if ano >= hoje.year - 1 else ""
        arquivo = portal.baixar(recurso, comum.CACHE / f"viagens-{ano}{sufixo}.zip")
        carga = carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(recurso), arquivo)

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


def rodar_compras(conexao: psycopg.Connection, anos: list[int]) -> None:
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
            arquivo = portal.baixar_publicado(recurso, comum.CACHE / f"compras-{ano}{mes:02d}{sufixo}.zip")
            if arquivo is None:
                faltaram.append(f"{mes:02d}/{ano}")
                continue
            cargas[mes] = carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(recurso), arquivo)
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


def rodar_compras_centralizadas(conexao: psycopg.Connection, anos: list[int]) -> None:
    """O CPCC mês a mês (ver `compras_centralizadas.py`). Mês com 403 ou 404 é pulado, como no CPDC."""
    hoje = date.today()
    for ano in anos:
        meses = 0
        for mes in range(1, 13):
            if (ano, mes) > (hoje.year, hoje.month):
                break
            recurso = compras_centralizadas.RECURSO.format(ano=ano, mes=mes)
            sufixo = f"-{hoje:%Y%m%d}" if (ano, mes) >= (hoje.year, hoje.month - 1) else ""
            arquivo = portal.baixar_publicado(recurso, comum.CACHE / f"cpcc-{ano}{mes:02d}{sufixo}.zip")
            if arquivo is None:
                continue
            carga = carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(recurso), arquivo)
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


def rodar_sancoes(conexao: psycopg.Connection) -> None:
    """O CEIS e o CNEP do dia (ver `sancoes.py`). Os dois cadastros trocam juntos, numa transação."""
    todas: list = []
    cargas: list[int] = []
    for cadastro in sancoes.CADASTROS:
        arquivo, data = _retrato_mais_recente(cadastro)
        cargas.append(carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(f"{cadastro}/{data}"), arquivo))
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
            return portal.baixar(f"{cadastro}/{data}", comum.CACHE / f"{cadastro}-{data}.zip"), data
        except requests.HTTPError as erro:
            if erro.response is None or erro.response.status_code not in (403, 404):
                raise
    raise RuntimeError(f"Nenhum retrato do {cadastro.upper()} nos últimos {DIAS_PARA_TRAS_DO_RETRATO} dias.")


def _antes_do_ultimo_publicado(mes_ano: str, publicados: list[tuple[int, int]]) -> bool:
    """Mês que falta antes do último publicado é buraco; depois dele, é só o que ainda não saiu."""
    mes, ano = (int(parte) for parte in mes_ano.split("/"))
    return bool(publicados) and (ano, mes) < max(publicados)
