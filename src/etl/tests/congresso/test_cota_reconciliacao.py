"""Regra 5: o total da cota fecha com o arquivo da casa, e o que fica fora tem motivo.

A reconciliação sai do mesmo resultado que é gravado: os descartes da transformação.
"""

from poligraph_etl.congresso import cota
from poligraph_etl.contratos import entrada
from poligraph_etl.contratos.camara import LinhaDaCotaDaCamara
from poligraph_etl.contratos.senado import LinhaDaCotaDoSenado


def _camara(id_na_camara: str, valor: str) -> dict:
    return {
        "ideCadastro": id_na_camara, "vlrLiquido": valor, "numAno": "2025", "numMes": "1", "txtDescricao": "X",
        "txtFornecedor": "F", "txtCNPJCPF": "", "datEmissao": "", "urlDocumento": "",
    }


def _senado(nome: str, valor: str) -> dict:
    return {
        "SENADOR": nome, "VALOR_REEMBOLSADO": valor, "ANO": "2025", "MES": "1", "TIPO_DESPESA": "X",
        "FORNECEDOR": "F", "CNPJ_CPF": "", "DATA": "",
    }


def test_camara_separa_lideranca_e_fora_do_de_para():
    linhas = entrada.ler(LinhaDaCotaDaCamara, [
        _camara("204379", "100.00"),
        _camara("", "40.00"),
        _camara("999999", "7.50"),
        _camara("204379", "0"),
    ])

    transformado = cota.transformar_camara(linhas, {"204379": 1})
    conta = cota.reconciliar(transformado, "COTA_CAMARA", 2025)

    assert len(transformado.despesas) == 1
    assert (conta["conjunto"], conta["total_na_fonte"], conta["total_na_base"]) == ("COTA_CAMARA", 147.5, 100.0)
    assert conta["motivos"] == {"SEM_PARLAMENTAR": 40.0, "FORA_DO_DE_PARA": 7.5}
    assert conta["total_na_fonte"] == conta["total_na_base"] + sum(conta["motivos"].values())


def test_senado_nome_que_nao_casa_fica_fora_com_motivo():
    linhas = entrada.ler(LinhaDaCotaDoSenado, [_senado("FULANO DE TAL", "10,00"), _senado("SICRANO", "5,00")])

    conta = cota.reconciliar(cota.transformar_senado(linhas, {"FULANO DE TAL": 1}), "COTA_SENADO", 2025)

    assert (conta["total_na_base"], conta["motivos"]) == (10.0, {"FORA_DO_DE_PARA": 5.0})
