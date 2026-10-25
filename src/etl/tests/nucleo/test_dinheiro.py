"""RISCO: As duas convenções numéricas que convivem no projeto.

O que estes testes protegem: **`"1.234"` vale 1234 no Portal e 1,234 na CEAP.** Mil
vezes de diferença, na mesma string, sem exceção nenhuma para avisar. Enquanto cada
módulo tinha a própria conversão, nada impedia que uma fosse usada no lugar da outra —
e o sintoma seria um total plausível e errado na ficha do parlamentar.
"""

import pytest

from poligraph_etl.nucleo.normalizacao import valor_com_ponto, valor_pt_br


# ═══════════════════════════════════════════════════════════════════
# pt-BR — Portal da Transparência (emendas) e TSE (prestação de contas)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("12.599,10", 12599.10),        # ponto é MILHAR
        ("- 26.002,00", -26002.00),     # ATENÇÃO: negativo separado do número
        ("1.234.567,89", 1234567.89),
        ("3170000,00", 3170000.00),     # DECISÃO: o TSE não usa separador de milhar
        ("0,00", 0.0),
        ("", 0.0),
        ("#NULO", 0.0),
        ("#NULO#", 0.0),
        (None, 0.0),
        ("nao e numero", 0.0),
    ],
)
def test_valor_pt_br(bruto, esperado):
    assert valor_pt_br(bruto) == pytest.approx(esperado)


# ═══════════════════════════════════════════════════════════════════
# Ponto decimal — cota parlamentar (CEAP)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("1234.56", 1234.56),
        ("-89.90", -89.90),             # DECISÃO: estorno é caso normal
        ("0", 0.0),
        ("", 0.0),
        (None, 0.0),
        ("lixo", 0.0),
    ],
)
def test_valor_com_ponto(bruto, esperado):
    assert valor_com_ponto(bruto) == pytest.approx(esperado)


# ═══════════════════════════════════════════════════════════════════
# RISCO: A divergência — a razão de as duas existirem com nomes diferentes
# ═══════════════════════════════════════════════════════════════════


def test_a_mesma_string_vale_mil_vezes_mais_numa_convencao():
    """RISCO: O erro que nenhuma exceção denunciaria.

    ATENÇÃO: `"1.234"` é **mil duzentos e trinta e quatro** para o Portal e **um vírgula
    duzentos e trinta e quatro** para a CEAP. As duas leituras são válidas; só o
    contexto decide. Por isso as funções não **não** podem ter nome genérico.
    """
    assert valor_pt_br("1.234") == 1234.0
    assert valor_com_ponto("1.234") == pytest.approx(1.234)

    assert valor_pt_br("1.234") == pytest.approx(valor_com_ponto("1.234") * 1000)


def test_valores_sem_ambiguidade_concordam():
    """DECISÃO: Onde não há separador de milhar, as duas coincidem — e é o caso comum.

    ATENÇÃO: É justamente isso que torna a troca perigosa: ela passa despercebida na maioria
    das linhas e explode só nas de valor alto, que são as que importam.
    """
    for texto, esperado in [("500", 500.0), ("0", 0.0), ("42", 42.0)]:
        assert valor_pt_br(texto) == esperado
        assert valor_com_ponto(texto) == esperado


def test_emendas_e_cota_usam_a_fonte_unica():
    """ATENÇÃO: Se um módulo voltar a ter cópia própria, este teste avisa."""
    from poligraph_etl.congresso import cota
    from poligraph_etl.emendas import emendas

    assert emendas.valor_brasileiro is valor_pt_br
    assert cota._decimal_com_ponto is valor_com_ponto
