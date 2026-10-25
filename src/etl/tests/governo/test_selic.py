"""A Selic do ano, capitalizada dos meses da série 4390 do Banco Central."""

import pytest

from poligraph_etl.governo import selic
from poligraph_etl.contratos.bcb import LinhaDaSerie


def test_meses_capitalizados_e_ano_em_andamento_diz_quantos_meses():
    linhas = [LinhaDaSerie(data=f"01/{m:02d}/2025", valor="1.00") for m in range(1, 13)]
    linhas += [LinhaDaSerie(data="01/01/2026", valor="1.10"), LinhaDaSerie(data="01/02/2026", valor="0.90")]

    anos = selic.selic_para_linhas(linhas)

    assert [(a.ano, a.meses) for a in anos] == [(2025, 12), (2026, 2)]
    assert anos[0].taxa_no_ano == pytest.approx(12.6825, abs=1e-4)
    assert anos[1].taxa_no_ano == pytest.approx((1.011 * 1.009 - 1) * 100, abs=1e-4)
