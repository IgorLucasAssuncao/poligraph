"""Execução do orçamento por função.

🔴 O ponto sensível é **onde** se compara empenho com dotação. No elemento de despesa a
dotação é zero em quase toda linha, e comparar ali acusaria excesso onde ⛔ há.
"""

from datetime import date

import pandas as pd
import pytest

from poligraph_etl import orcamento


def linha(**campos) -> dict:
    """⭐ Colunas de `2025_OrcamentoDespesa.csv`, com uma programação da Previdência."""
    base = {
        "EXERCÍCIO": "2025",
        "CÓDIGO UNIDADE ORÇAMENTÁRIA": "33904",
        "CÓDIGO FUNÇÃO": "09",
        "NOME FUNÇÃO": "Previdência social",
        "CÓDIGO SUBFUNÇÃO": "271",
        "CÓDIGO PROGRAMA ORÇAMENTÁRIO": "2305",
        "CÓDIGO AÇÃO": "00SJ",
        "CÓDIGO ELEMENTO DE DESPESA": "01",
        "ORÇAMENTO INICIAL (R$)": "0,00",
        "ORÇAMENTO ATUALIZADO (R$)": "0,00",
        "ORÇAMENTO EMPENHADO (R$)": "0,00",
        "ORÇAMENTO REALIZADO (R$)": "0,00",
    }

    return {**base, **campos}


def processar(*linhas: dict) -> list[dict]:
    return orcamento.para_linhas(pd.DataFrame(list(linhas), dtype=str), date(2026, 9, 22))


def test_dotacao_num_elemento_e_empenho_em_outro_nao_e_excesso():
    """🔴 A dotação costuma estar numa linha e o empenho em outra da mesma programação.

    ⚠️ Comparar linha a linha acusaria R$ 100 empenhados sem dotação — que ⛔ existe.
    """
    [funcao] = processar(
        linha(**{"ORÇAMENTO ATUALIZADO (R$)": "100,00"}),
        linha(**{"CÓDIGO ELEMENTO DE DESPESA": "05", "ORÇAMENTO EMPENHADO (R$)": "100,00"}),
    )

    assert funcao["empenhado_acima_da_dotacao"] == 0


def test_empenho_alem_da_dotacao_da_programacao_e_medido():
    """📐 É o caso de 2025: a ação 00SJ empenhou R$ 129,6 bi além da dotação publicada."""
    [funcao] = processar(
        linha(**{"ORÇAMENTO ATUALIZADO (R$)": "981,30", "ORÇAMENTO EMPENHADO (R$)": "1110,90"}),
    )

    assert funcao["empenhado_acima_da_dotacao"] == pytest.approx(129.6)


def test_folga_de_uma_programacao_nao_cobre_o_excesso_de_outra():
    """⚠️ Dotação que sobra numa ação ⛔ paga o que outra empenhou além da sua.

    Somar por função antes de comparar esconderia o excesso: 100 + 0 contra 50 + 50.
    """
    [funcao] = processar(
        linha(**{"ORÇAMENTO ATUALIZADO (R$)": "100,00", "ORÇAMENTO EMPENHADO (R$)": "50,00"}),
        linha(**{"CÓDIGO AÇÃO": "0181", "ORÇAMENTO EMPENHADO (R$)": "50,00"}),
    )

    assert funcao["dotacao_atualizada"] == funcao["empenhado"] == 100.0
    assert funcao["empenhado_acima_da_dotacao"] == pytest.approx(50.0)


def test_uma_linha_por_funcao_com_a_data_do_arquivo():
    funcoes = processar(
        linha(**{"ORÇAMENTO REALIZADO (R$)": "10,00"}),
        linha(**{"CÓDIGO FUNÇÃO": "10", "NOME FUNÇÃO": "Saúde",
                 "ORÇAMENTO REALIZADO (R$)": "7,50"}),
    )

    assert [(f["codigo_funcao"], f["funcao"], f["pago"]) for f in funcoes] == [
        ("09", "Previdência social", 10.0),
        ("10", "Saúde", 7.5),
    ]
    assert {f["gerado_em"] for f in funcoes} == {"2026-09-22"}


# ═══════════════════════════════════════════════════════════════════
# Encargos especiais e restos a pagar
# ═══════════════════════════════════════════════════════════════════


def test_encargos_especiais_saem_por_subfuncao():
    """🔴 A função 28 junta rolagem, juros e FPM. A subfunção separa."""
    linhas = orcamento.encargos_para_linhas(pd.DataFrame([
        linha(**{"CÓDIGO FUNÇÃO": "28", "CÓDIGO SUBFUNÇÃO": "841",
                 "NOME SUBFUNÇÃO": "Refinanciamento da dívida interna",
                 "ORÇAMENTO REALIZADO (R$)": "1354,90"}),
        linha(**{"CÓDIGO FUNÇÃO": "28", "CÓDIGO SUBFUNÇÃO": "845",
                 "NOME SUBFUNÇÃO": "Outras transferências", "ORÇAMENTO REALIZADO (R$)": "475,80"}),
        linha(),
    ], dtype=str))

    assert [(l["codigo_subfuncao"], l["pago"]) for l in linhas] == [("841", 1354.9), ("845", 475.8)]


def execucao(funcao: str, subfuncao: str, pago: str, restos: str) -> dict:
    return {
        "Código Função": funcao,
        "Código Subfução": subfuncao,
        "Valor Pago (R$)": pago,
        "Valor Restos a Pagar Pagos (R$)": restos,
    }


def test_restos_a_pagar_somam_os_meses():
    """📐 Urbanismo 2025: R$ 2,0 bi pagos do exercício e R$ 6,5 bi de anos anteriores."""
    janeiro = orcamento.restos_a_pagar_do_mes(pd.DataFrame([
        execucao("15", "451", "1,00", "4,00"),
        execucao("28", "843", "10,00", "2,00"),
    ], dtype=str))
    fevereiro = orcamento.restos_a_pagar_do_mes(pd.DataFrame([
        execucao("15", "451", "1,00", "2,50"),
    ], dtype=str))

    ano = orcamento.somar_meses([janeiro, fevereiro])

    assert ano["por_funcao"] == {"15": pytest.approx(6.5), "28": pytest.approx(2.0)}
    assert ano["por_subfuncao"] == {"843": pytest.approx(2.0)}
    assert ano["pago"] == pytest.approx(12.0)


# ═══════════════════════════════════════════════════════════════════
# 🔴 Limite de taxa ⛔ é "mês não publicado"
# ═══════════════════════════════════════════════════════════════════


def _erro_http(status: int):
    import requests

    resposta = requests.Response()
    resposta.status_code = status
    return requests.HTTPError(response=resposta)


def test_limite_de_taxa_derruba_a_carga_em_vez_de_encurtar_o_ano(monkeypatch):
    """📐 Aconteceu na primeira carga: o 405 esgotou as tentativas em maio de 2026, e o
    ano foi gravado com 4 meses como se fosse o ano até agora.
    """
    from poligraph_etl import __main__ as principal

    def baixar(recurso, destino):
        raise _erro_http(405)

    monkeypatch.setattr(principal.portal, "baixar", baixar)

    with pytest.raises(Exception):
        principal._restos_a_pagar_do_ano(2025)


def test_mes_nao_publicado_encerra_a_soma(monkeypatch):
    from poligraph_etl import __main__ as principal

    def baixar(recurso, destino):
        raise _erro_http(404)

    monkeypatch.setattr(principal.portal, "baixar", baixar)

    assert principal._restos_a_pagar_do_ano(2025)["meses"] == 0
