"""PL45 — a reconciliação manual de autor de emenda.

🔴 O que este arquivo protege: **entrada malformada tem de ESTOURAR.** `--resolver 4184`
sem o `=` seria descartado em silêncio, e a pessoa concluiria que vinculou quando não
vinculou — o mesmo formato de falha que este projeto persegue em todo lugar.

⭐ E é a única saída dos **9 autores ambíguos**: dois parlamentares com o mesmo nome de
urna ⛔ não são separáveis por texto, então a reconciliação automática desiste de
propósito e quem decide é uma pessoa.
"""

import pytest

from poligraph_etl.__main__ import pares_de_resolucao


def test_converte_o_par():
    assert pares_de_resolucao(["4184=612"]) == [("4184", 612)]


def test_converte_varios():
    assert pares_de_resolucao(["4184=612", "3767=91"]) == [("4184", 612), ("3767", 91)]


def test_espaco_em_volta_nao_atrapalha():
    assert pares_de_resolucao([" 4184 = 612 "]) == [("4184", 612)]


@pytest.mark.parametrize("ruim", ["4184", "=612", "4184=", "", "="])
def test_entrada_malformada_estoura(ruim):
    """🔴 ⛔ Nunca ignorar em silêncio — a mensagem diz o formato certo."""
    with pytest.raises(ValueError, match="CODIGO=PESSOA_ID"):
        pares_de_resolucao([ruim])


def test_id_nao_numerico_estoura():
    with pytest.raises(ValueError, match="não é um id de pessoa"):
        pares_de_resolucao(["4184=fulano"])


def test_zero_a_esquerda_do_codigo_sobrevive():
    """⚠️ O código do autor é TEXTO — `0418` ⛔ não pode virar 418.

    🔴 A coluna é `varchar(16)` justamente por isso: convertido a número, `0418` casaria
    com o autor errado, e a emenda apareceria na ficha de outra pessoa.
    """
    assert pares_de_resolucao(["0418=612"]) == [("0418", 612)]
