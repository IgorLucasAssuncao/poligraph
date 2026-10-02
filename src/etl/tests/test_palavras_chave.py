"""PL70 — as palavras-chave da Câmara, onde está o nome popular da proposição."""

import requests

from poligraph_etl.fontes import camara


class _Resposta:
    def __init__(self, corpo, status=200):
        self._corpo = corpo
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))

    def json(self):
        return self._corpo


def test_devolve_as_palavras_com_espaco_colapsado(monkeypatch):
    monkeypatch.setattr(camara.requests, "get", lambda *a, **k: _Resposta(
        {"dados": {"keywords": "Sistema Tributário Nacional,  criação. _Reforma tributária, tributação."}}))

    assert camara.palavras_chave_da_proposicao(2196833) == (
        "Sistema Tributário Nacional, criação. _Reforma tributária, tributação.")


def test_sem_palavras_e_vazio_e_nao_nulo(monkeypatch):
    """Vazio marca "consultada": nulo faria a próxima execução perguntar de novo, para sempre."""
    monkeypatch.setattr(camara.requests, "get", lambda *a, **k: _Resposta({"dados": {"keywords": None}}))

    assert camara.palavras_chave_da_proposicao(1) == ""


def test_falha_e_nulo_para_tentar_de_novo(monkeypatch):
    monkeypatch.setattr(camara.requests, "get", lambda *a, **k: _Resposta({}, status=503))

    assert camara.palavras_chave_da_proposicao(1) is None
