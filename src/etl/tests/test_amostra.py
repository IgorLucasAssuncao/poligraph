"""Pendência 67 — o sorteio repetível e a comparação voto a voto."""

from poligraph_etl import amostra


def test_a_mesma_semente_sorteia_as_mesmas_e_a_ordem_de_entrada_nao_importa():
    ids = [f"v{n}" for n in range(100)]

    primeira = amostra.sortear(ids, 20, 2026, "CAMARA-57")
    segunda = amostra.sortear(list(reversed(ids)), 20, 2026, "CAMARA-57")

    assert primeira == segunda and len(primeira) == 20


def test_grupos_diferentes_sorteiam_diferente_e_grupo_pequeno_vai_inteiro():
    ids = [f"v{n}" for n in range(100)]

    assert amostra.sortear(ids, 20, 2026, "CAMARA-56") != amostra.sortear(ids, 20, 2026, "CAMARA-57")
    assert amostra.sortear(["b", "a"], 20, 2026, "SENADO-55") == ["a", "b"]


def test_comparar_separa_divergente_de_quem_falta_em_cada_lado():
    base = {"1": 1, "2": -1, "3": None, "4": 1}
    fonte = {"1": 1, "2": 1, "3": None, "5": 0}

    resultado = amostra.comparar(base, fonte)

    assert (resultado.iguais, resultado.divergentes, resultado.so_na_base, resultado.so_na_fonte) == (2, 1, 1, 1)
    assert not resultado.confere


def test_tudo_igual_confere():
    assert amostra.comparar({"1": 1, "2": None}, {"1": 1, "2": None}).confere
