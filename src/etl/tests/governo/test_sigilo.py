"""O gasto sigiloso: o cartão corporativo e as ações de caráter sigiloso."""

import pandas as pd

from poligraph_etl.governo import sigilo


def _cartao(*linhas):
    return pd.DataFrame(
        [{"NOME ÓRGÃO SUPERIOR": o, "NOME PORTADOR": p, "VALOR TRANSAÇÃO": v} for o, p, v in linhas]
    )


def test_cartao_separa_o_sigiloso_do_total_por_orgao():
    mes = sigilo.cartao_do_mes(_cartao(
        ("Presidência da República", "Sigiloso", "1.000,00"),
        ("Presidência da República", "Sigiloso", "500,00"),
        ("Presidência da República", "FULANA DE TAL", "250,00"),
        ("Ministério da Saúde", "BELTRANO", "- 100,00"),
    ))

    assert mes["Presidência da República"] == {"total": 1750.0, "sigiloso": 1500.0, "lancamentos": 2}
    assert mes["Ministério da Saúde"] == {"total": -100.0, "sigiloso": 0.0, "lancamentos": 0}


def test_cpf_do_portador_nao_e_lido():
    """RISCO: O arquivo traz o CPF mascarado do portador; não é coluna que o ETL peça."""
    assert not any("CPF" in c for c in sigilo.COLUNAS_DO_CARTAO)


def _execucao(*linhas):
    return pd.DataFrame([
        {"Nome Órgão Superior": o, "Código Ação": c, "Nome Ação": n,
         "Valor Pago (R$)": p, "Valor Restos a Pagar Pagos (R$)": r}
        for o, c, n, p, r in linhas
    ])


def test_acao_sigilosa_soma_pago_e_restos_pelo_nome_da_acao():
    mes = sigilo.acoes_do_mes(_execucao(
        ("Ministério da Defesa", "2866", "ACOES DE CARATER SIGILOSO", "100,00", "50,00"),
        ("Ministério da Defesa", "20XV", "OPERACAO DE PAZ", "999,00", "0,00"),
    ))

    assert mes == {"Ministério da Defesa": 150.0}


def test_mes_sem_acao_sigilosa_devolve_vazio():
    assert sigilo.acoes_do_mes(_execucao(("Ministério da Saúde", "8585", "ATENCAO BASICA", "1,00", "0,00"))) == {}


def test_somar_meses():
    cartao = sigilo.somar_cartao([
        {"PR": {"total": 10.0, "sigiloso": 4.0, "lancamentos": 1}},
        {"PR": {"total": 5.0, "sigiloso": 5.0, "lancamentos": 2}},
    ])

    assert cartao == {"PR": {"total": 15.0, "sigiloso": 9.0, "lancamentos": 3}}
    assert sigilo.somar_acoes([{"MD": 1.0}, {"MD": 2.0, "PR": 3.0}]) == {"MD": 3.0, "PR": 3.0}


def test_acao_com_estorno_nao_vira_linha_negativa():
    """O órgão "Sem informação" soma estorno de centavos; uma linha negativa afirmaria gasto negativo."""
    linhas = sigilo.para_linhas(2025, {}, 12, {"Ministério da Defesa": 10.0, "Sem informação": -0.01}, 12)

    assert [(l["orgao_superior"], l["total"], l["lancamentos"]) for l in linhas] == [("Ministério da Defesa", 10.0, None)]


def test_nome_cortado_pelo_cartao_e_completado_pela_execucao():
    """O cartão corta o nome em 42 letras; a execução traz o inteiro (2026-10-03)."""
    completos = {"Ministério da Integração e do Desenvolvimento Regional", "Ministério da Saúde"}

    assert sigilo.nome_completo("Ministério da Integração e do Desenvolvime", completos) == (
        "Ministério da Integração e do Desenvolvimento Regional"
    )
    assert sigilo.nome_completo("Ministério da Saúde", completos) == "Ministério da Saúde"
    assert sigilo.nome_completo("Órgão que não está", completos) == "Órgão que não está"


def test_nome_cortado_ambiguo_fica_como_veio():
    completos = {"Ministério do Desenvolvimento Agrário", "Ministério do Desenvolvimento Social"}

    assert sigilo.nome_completo("Ministério do Desenvolvimento", completos) == "Ministério do Desenvolvimento"
