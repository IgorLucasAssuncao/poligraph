"""Regra 5: o total da cota fecha com o arquivo da casa, e o que fica fora tem motivo."""

from poligraph_etl import cota


def test_camara_separa_lideranca_e_fora_do_de_para():
    registros = [
        {"ideCadastro": "204379", "vlrLiquido": "100.00"},
        {"ideCadastro": "", "vlrLiquido": "40.00"},
        {"ideCadastro": "999999", "vlrLiquido": "7.50"},
        {"ideCadastro": "204379", "vlrLiquido": "0"},
    ]

    conta = cota.reconciliar_camara(registros, {"204379": 1}, 2025)

    assert (conta["conjunto"], conta["total_na_fonte"], conta["total_na_base"]) == ("COTA_CAMARA", 147.5, 100.0)
    assert conta["motivos"] == {"SEM_PARLAMENTAR": 40.0, "FORA_DO_DE_PARA": 7.5}
    assert conta["total_na_fonte"] == conta["total_na_base"] + sum(conta["motivos"].values())


def test_senado_nome_que_nao_casa_fica_fora_com_motivo():
    registros = [
        {"SENADOR": "FULANO DE TAL", "VALOR_REEMBOLSADO": "10,00"},
        {"SENADOR": "SICRANO", "VALOR_REEMBOLSADO": "5,00"},
    ]

    conta = cota.reconciliar_senado(registros, {"FULANO DE TAL": 1}, 2025)

    assert (conta["total_na_base"], conta["motivos"]) == (10.0, {"FORA_DO_DE_PARA": 5.0})
