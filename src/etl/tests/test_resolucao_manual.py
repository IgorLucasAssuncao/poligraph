"""Pendência 45 e Pendência 47 — a reconciliação manual de autor de emenda.

RISCO: O que este arquivo protege: **entrada malformada tem de ESTOURAR.** `--resolver 4184`
sem o `=` seria descartado em silêncio, e a pessoa concluiria que vinculou quando não
vinculou — o mesmo formato de falha que este projeto persegue em todo lugar.

DECISÃO: E é a única saída dos autores **realmente** ambíguos: dois parlamentares com o mesmo
nome de urna não são separáveis por texto, então a reconciliação automática desiste de
propósito e quem decide é uma pessoa.

## RISCO: O segundo valor mudou em 2026-08-29

Era `pessoas.id`. **Virou o id NA CÂMARA**, depois de o defeito se materializar: a Pendência 47
registrava `--resolver 4511=43` para o Allan Garcês, e depois de uma reingestão o `43`
passou a ser **André Ferreira** — `pessoas.id` é `BIGSERIAL` e é reatribuído.

O comando anotado no dia anterior colocaria as emendas de um parlamentar na ficha de
outro, **em silêncio**, porque a chave estrangeira aceita qualquer id que exista.
"""

import pytest

from poligraph_etl.comandos.emendas import pares_de_resolucao


def test_converte_o_par():
    assert pares_de_resolucao(["4184=204521"]) == [("4184", "204521")]


def test_converte_varios():
    assert pares_de_resolucao(["4184=204521", "3767=91"]) == [
        ("4184", "204521"),
        ("3767", "91"),
    ]


def test_espaco_em_volta_nao_atrapalha():
    assert pares_de_resolucao([" 4184 = 204521 "]) == [("4184", "204521")]


def test_o_id_externo_continua_texto():
    """RISCO: O id da fonte é TEXTO, como o código do autor.

    ATENÇÃO: Convertido a número, um id com zero à esquerda casaria com a pessoa errada — o
    mesmo motivo pelo qual `pessoa_fonte_ids.id_externo` é `text`.
    """
    codigo, externo = pares_de_resolucao(["4184=0204521"])[0]

    assert externo == "0204521"
    assert isinstance(externo, str)


@pytest.mark.parametrize("ruim", ["4184", "=204521", "4184=", "", "="])
def test_entrada_malformada_estoura(ruim):
    """RISCO: Nunca ignorar em silêncio — a mensagem diz o formato certo."""
    with pytest.raises(ValueError, match="CODIGO=ID_NA_CAMARA"):
        pares_de_resolucao([ruim])


def test_id_nao_numerico_estoura():
    """ATENÇÃO: O id da fonte é numérico nas três. Recusar aqui pega o typo com mensagem útil."""
    with pytest.raises(ValueError, match="não é um id da Câmara"):
        pares_de_resolucao(["4184=fulano"])


def test_zero_a_esquerda_do_codigo_sobrevive():
    """ATENÇÃO: O código do autor é TEXTO — `0418` não pode virar 418.

    RISCO: A coluna é `varchar(16)` justamente por isso: convertido a número, `0418` casaria
    com o autor errado, e a emenda apareceria na ficha de outra pessoa.
    """
    assert pares_de_resolucao(["0418=204521"]) == [("0418", "204521")]
