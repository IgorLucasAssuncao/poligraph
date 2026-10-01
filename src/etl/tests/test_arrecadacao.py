"""Arrecadação — receitas por origem."""

from datetime import date

import pandas as pd
import pytest

from poligraph_etl import arrecadacao


def receita(**campos) -> dict:
    base = {
        "ANO EXERCÍCIO": "2025",
        "CATEGORIA ECONÔMICA": "Receitas Correntes",
        "ORIGEM RECEITA": "Impostos, Taxas e Contribuições de Melhoria",
        "VALOR PREVISTO ATUALIZADO": "0,00",
        "VALOR REALIZADO": "0,00",
    }
    return {**base, **campos}


def test_soma_por_categoria_e_origem_sem_misturar():
    """🔴 Operação de crédito fica na sua linha: é dívida, ⛔ arrecadação."""
    linhas = arrecadacao.para_linhas(pd.DataFrame([
        receita(**{"VALOR REALIZADO": "100,50"}),
        receita(**{"VALOR REALIZADO": "50,00"}),
        receita(**{"CATEGORIA ECONÔMICA": "Receitas de Capital",
                   "ORIGEM RECEITA": "Operações de Crédito", "VALOR REALIZADO": "999,00"}),
    ], dtype=str), date(2026, 9, 24))

    por_origem = {l["origem"]: l["realizada"] for l in linhas}
    assert por_origem["Impostos, Taxas e Contribuições de Melhoria"] == pytest.approx(150.5)
    assert por_origem["Operações de Crédito"] == pytest.approx(999.0)
    assert {l["gerado_em"] for l in linhas} == {"2026-09-24"}
