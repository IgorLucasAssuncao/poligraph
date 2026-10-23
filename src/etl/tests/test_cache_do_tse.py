"""O cache do TSE vence quando o TSE publica versão mais nova (achado de 2026-10-23, consulta_cand_2026)."""

import os

import requests

from poligraph_etl.fontes import tse


class _Resposta:
    def __init__(self, status: int, headers: dict[str, str], corpo: bytes = b""):
        self.status_code = status
        self.headers = headers
        self._corpo = corpo

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def raise_for_status(self):
        pass

    def iter_content(self, chunk_size: int):
        yield self._corpo


def _cache(tmp_path, conteudo: bytes = b"velho", quando: float = 1_761_000_000):
    arquivo = tmp_path / "consulta-cand-2026.zip"
    arquivo.write_bytes(conteudo)
    os.utime(arquivo, (quando, quando))
    return arquivo


def test_cache_mais_velho_que_o_publicado_e_baixado_de_novo(tmp_path, monkeypatch):
    arquivo = _cache(tmp_path)
    publicado = {"Last-Modified": "Fri, 23 Oct 2026 11:35:02 GMT", "Content-Length": "5"}
    monkeypatch.setattr(tse.requests, "get", lambda *a, **k: _Resposta(200, publicado, b"novo!"))

    tse.baixar("https://cdn/x.zip", arquivo)

    assert arquivo.read_bytes() == b"novo!"


def test_tamanho_diferente_basta_para_baixar_de_novo(tmp_path, monkeypatch):
    arquivo = _cache(tmp_path, quando=1_900_000_000)
    publicado = {"Last-Modified": "Fri, 23 Oct 2026 11:35:02 GMT", "Content-Length": "6"}
    monkeypatch.setattr(tse.requests, "get", lambda *a, **k: _Resposta(200, publicado, b"outro!"))

    tse.baixar("https://cdn/x.zip", arquivo)

    assert arquivo.read_bytes() == b"outro!"


def test_cache_igual_ao_publicado_fica(tmp_path, monkeypatch):
    arquivo = _cache(tmp_path, quando=1_900_000_000)
    publicado = {"Last-Modified": "Fri, 23 Oct 2026 11:35:02 GMT", "Content-Length": "5"}
    monkeypatch.setattr(tse.requests, "get", lambda *a, **k: _Resposta(200, publicado, b"NAO!!"))

    tse.baixar("https://cdn/x.zip", arquivo)

    assert arquivo.read_bytes() == b"velho"


def test_sem_resposta_do_tse_fica_o_cache(tmp_path, monkeypatch):
    arquivo = _cache(tmp_path)

    def falha(*a, **k):
        raise requests.ConnectionError("fora do ar")

    monkeypatch.setattr(tse.requests, "get", falha)

    assert tse.baixar("https://cdn/x.zip", arquivo).read_bytes() == b"velho"


def test_recusa_do_waf_ao_conferir_fica_o_cache(tmp_path, monkeypatch):
    arquivo = _cache(tmp_path)
    monkeypatch.setattr(tse.requests, "get", lambda *a, **k: _Resposta(403, {}))

    assert tse.baixar("https://cdn/x.zip", arquivo).read_bytes() == b"velho"
