"""Os feeds RSS — a entrada da coleta de notícias.

⚠️ O que se testa aqui é a RESILIÊNCIA, não o download: a coleta roda sobre três
veículos, e o modo de falha que interessa é um deles derrubar os outros dois.
"""

import logging

import pytest
import requests

from poligraph_etl import noticias
from poligraph_etl.fontes import rss


class RespostaFalsa:
    def __init__(self, texto="<rss/>", erro=None):
        self.text = texto
        self.content = texto.encode()
        self._erro = erro

    def raise_for_status(self):
        if self._erro:
            raise self._erro


# ═══════════════════════════════════════════════════════════════════
# Os feeds declarados
# ═══════════════════════════════════════════════════════════════════


def test_so_ha_feeds_de_fonte_publica():
    """🔴 RF-38 — só Legislativo e EBC.

    Veículo comercial acrescentaria discussão de termos de uso a um projeto que ⛔ não
    precisa dela para demonstrar o método.
    """
    permitidos = ("camara.leg.br", "senado.leg.br", "ebc.com.br")

    for _, url in rss.FEEDS:
        assert url.startswith("https://")
        assert any(dominio in url for dominio in permitidos), url


def test_cada_veiculo_aparece_uma_vez():
    """Veículo repetido gravaria a mesma notícia duas vezes com nomes iguais."""
    nomes = [veiculo for veiculo, _ in rss.FEEDS]

    assert len(nomes) == len(set(nomes))


# ═══════════════════════════════════════════════════════════════════
# 🔴 Um feed fora do ar ⛔ não derruba os outros
# ═══════════════════════════════════════════════════════════════════


def test_erro_de_rede_devolve_none_em_vez_de_estourar(monkeypatch):
    def explodir(*_, **__):
        raise requests.ConnectionError("sem rota")

    monkeypatch.setattr(rss.requests, "get", explodir)

    assert rss.baixar("https://exemplo.invalido/rss") is None


def test_http_500_devolve_none(monkeypatch):
    monkeypatch.setattr(
        rss.requests,
        "get",
        lambda *_, **__: RespostaFalsa(erro=requests.HTTPError("500")),
    )

    assert rss.baixar("https://exemplo.invalido/rss") is None


def test_corpo_vazio_devolve_none(monkeypatch):
    """⚠️ 200 com corpo vazio ⛔ não é feed sem notícia: é feed quebrado."""
    monkeypatch.setattr(rss.requests, "get", lambda *_, **__: RespostaFalsa("   "))

    assert rss.baixar("https://exemplo.invalido/rss") is None


def test_feed_valido_devolve_o_xml(monkeypatch):
    monkeypatch.setattr(rss.requests, "get", lambda *_, **__: RespostaFalsa("<rss>oi</rss>"))

    assert rss.baixar("https://exemplo.invalido/rss") == "<rss>oi</rss>"


# ═══════════════════════════════════════════════════════════════════
# 🔴 XML malformado — medido, ⛔ não hipotético
# ═══════════════════════════════════════════════════════════════════


def test_xml_malformado_devolve_lista_vazia(caplog):
    """🔴 Medido em 2026-08-29: `senado.leg.br/noticias/ultimas/rss` responde 200 com
    `mismatched tag` na linha 185. Estourar ali perderia os outros dois veículos.
    """
    quebrado = "<rss><channel><item><title>Sem fechar</channel></rss>"

    with caplog.at_level(logging.WARNING):
        assert noticias.ler_feed(quebrado, "Veículo") == []

    assert "XML inválido" in caplog.text


def test_xml_valido_sem_item_nao_e_erro():
    """⚠️ Feed que ⛔ não publicou nada hoje é caso NORMAL, ⛔ não falha."""
    assert noticias.ler_feed("<rss><channel></channel></rss>", "Veículo") == []


# ═══════════════════════════════════════════════════════════════════
# Canário de volume
# ═══════════════════════════════════════════════════════════════════


def test_volume_normal_nao_avisa(caplog):
    with caplog.at_level(logging.WARNING):
        rss.conferir_volume(rss.MINIMO_NO_TOTAL)

    assert caplog.text == ""


def test_volume_baixo_avisa_mas_nao_estoura(caplog):
    """⚠️ Avisa, ⛔ não levanta: notícia é fluxo contínuo, e um dia magro ⛔ não é
    motivo para derrubar o ETL — diferente do CSV da Câmara, que é carga fechada.
    """
    with caplog.at_level(logging.WARNING):
        rss.conferir_volume(0)

    assert "confira" in caplog.text


@pytest.mark.parametrize("total", [0, 1, rss.MINIMO_NO_TOTAL - 1])
def test_limiar_do_canario(total, caplog):
    with caplog.at_level(logging.WARNING):
        rss.conferir_volume(total)

    assert caplog.text != ""
