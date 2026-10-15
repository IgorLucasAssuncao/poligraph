"""Compras do Executivo federal: o valor final, o contrato sigiloso e a empresa pelo CNPJ."""

import csv
import io
import zipfile

import pytest
import requests

from poligraph_etl import __main__ as etl
from poligraph_etl import compras
from poligraph_etl.contratos import entrada
from poligraph_etl.contratos.banco import ContratacoesDoOrgao, ContratadoDoGoverno
from poligraph_etl.contratos.portal import LinhaDeCompra
from poligraph_etl.fontes import portal


def compra(**campos) -> dict:
    """DECISÃO: valores de uma linha REAL de `202501_Compras.csv`, sem o objeto."""
    base = {
        "Nome Órgão Superior": "Ministério da Defesa", "Modalidade Compra": "Sem Informação",
        "Código Contratado": "12345678000190", "Nome Contratado": "DAVITA SERVICOS DE NEFROLOGIA MARCO LTDA.",
        "Valor Inicial Compra": "1960000000000,0000", "Valor Final Compra": "1400000,0000",
    }
    return {**base, **campos}


@pytest.mark.parametrize(
    ("inicial", "final", "valor", "descartado"),
    [
        ("1960000000000,0000", "1400000,0000", 1_400_000.0, 1_959_998_600_000.0),
        ("1000000,00", "55840000000,00", 1_000_000.0, 55_839_000_000.0),
        ("1000000,00", "1200000,00", 1_200_000.0, 0.0),
        ("0,00", "500,00", 500.0, 0.0),
    ],
)
def test_valor_do_contrato_descarta_o_erro_de_digitacao_dos_dois_lados(inicial, final, valor, descartado):
    """MEDIDO: jan/2025 o inicial está errado; 2022 o final. Aditivo comum (20%) fica com o final."""
    [linha] = entrada.ler(LinhaDeCompra, [compra(**{"Valor Inicial Compra": inicial, "Valor Final Compra": final})])

    assert compras.valor_do_contrato(linha) == (valor, descartado)


def test_soma_por_modalidade_conta_o_sigiloso_e_o_divergente():
    """O valor inicial desta linha é o erro de digitação da fonte (R$ 1,96 tri): fica fora da soma e à vista."""
    linhas = entrada.ler(LinhaDeCompra, [
        compra(),
        compra(**{"Código Contratado": "-11", "Nome Contratado": "Sigiloso", "Valor Inicial Compra": "60000,0000",
                  "Valor Final Compra": "60000,0000"}),
        compra(**{"Modalidade Compra": "Pregão", "Valor Inicial Compra": "10,00", "Valor Final Compra": "10,00"}),
    ])

    assert compras.por_orgao(2025, 1, linhas) == [
        ContratacoesDoOrgao(ano=2025, mes=1, orgao_superior="Ministério da Defesa", modalidade="Pregão",
                            contratos=1, sigilosos=0, valor=10.0, divergentes=0, valor_descartado=0.0),
        ContratacoesDoOrgao(ano=2025, mes=1, orgao_superior="Ministério da Defesa", modalidade="Sem Informação",
                            contratos=2, sigilosos=1, valor=1460000.0, divergentes=1,
                            valor_descartado=1959998600000.0),
    ]


def test_contratado_so_com_cnpj_e_com_o_nome_mais_frequente():
    linhas = entrada.ler(LinhaDeCompra, [
        compra(),
        compra(**{"Nome Contratado": "DAVITA SERVICOS DE NEFROLOGIA MARCO LTDA.", "Valor Final Compra": "100,00"}),
        compra(**{"Nome Contratado": "DAVITA LTDA", "Valor Final Compra": "1,00"}),
        compra(**{"Código Contratado": "-11", "Nome Contratado": "Sigiloso"}),
    ])

    assert compras.contratados(2025, linhas) == [
        ContratadoDoGoverno(ano=2025, cnpj="12345678000190", nome="DAVITA SERVICOS DE NEFROLOGIA MARCO LTDA.",
                            contratos=3, valor=1400101.0),
    ]


def _zip(destino, ano, mes, linhas):
    texto = io.StringIO()
    escritor = csv.DictWriter(texto, fieldnames=list(linhas[0]), delimiter=";", quoting=csv.QUOTE_ALL)
    escritor.writeheader()
    escritor.writerows(linhas)
    with zipfile.ZipFile(destino, "w") as arquivo:
        arquivo.writestr(compras.membro(ano, mes), texto.getvalue().encode("latin-1"))
    return destino


@pytest.mark.integracao
def test_comando_grava_o_ano_e_pula_o_mes_que_falta(conexao, tmp_path, monkeypatch):
    conexao.execute("TRUNCATE cargas, contratacoes_do_orgao, contratados_do_governo" " CASCADE")

    def baixar(recurso, destino, **_):
        ano, mes = int(recurso[-6:-2]), int(recurso[-2:])
        if mes != 2:
            resposta = requests.Response()
            resposta.status_code = 403
            raise requests.HTTPError(response=resposta)
        return _zip(destino, ano, mes, [compra()])

    monkeypatch.setattr(etl, "CACHE", tmp_path)
    monkeypatch.setattr(portal, "baixar", baixar)
    monkeypatch.setattr(portal, "ESPERA_DO_403", 0)

    etl._compras(conexao, [2024])

    assert conexao.execute(
        "SELECT mes, contratos, valor::float, carga_id IS NOT NULL FROM contratacoes_do_orgao"
    ).fetchall() == [(2, 1, 1400000.0, True)]
    assert conexao.execute("SELECT cnpj, contratos FROM contratados_do_governo").fetchall() == [("12345678000190", 1)]
