"""Pendência 90, fase 5: a DCA do Siconfi vira as contas da prefeitura no ano."""

from poligraph_etl import siconfi
from poligraph_etl.contratos.siconfi import LinhaDaDca


def _linha(conta: str, coluna: str, valor: float) -> LinhaDaDca:
    return LinhaDaDca(ano="2023", codigo_ibge="3509502", coluna_da_dca=coluna, cod_conta=conta, valor=str(valor))


def test_receita_bruta_e_deducoes_e_despesa_correntes_mais_capital():
    receitas = [
        _linha("ReceitasExcetoIntraOrcamentarias", "Receitas Brutas Realizadas", 1000),
        _linha("ReceitasExcetoIntraOrcamentarias", "Deduções - FUNDEB", 100),
        _linha("ReceitasExcetoIntraOrcamentarias", "Outras Deduções da Receita", 5),
        _linha("RO1.0.0.0.00.0.0", "Receitas Brutas Realizadas", 900),
    ]
    despesas = [
        _linha("DO3.0.00.00.00.00", "Despesas Empenhadas", 700),
        _linha("DO4.0.00.00.00.00", "Despesas Empenhadas", 80),
        _linha("DO3.0.00.00.00.00", "Despesas Pagas", 650),
        _linha("DO3.1.00.00.00.00", "Despesas Pagas", 400),
    ]

    contas = siconfi.contas_para_linha("3509502", 2023, receitas, despesas)

    assert (contas.receita_bruta, contas.deducoes, contas.despesa_empenhada, contas.despesa_paga) == (1000, 105, 780, 650)


def test_municipio_que_nao_declarou_fica_sem_linha_e_nao_vira_zero():
    assert siconfi.contas_para_linha("3509502", 2023, [], []) is None
