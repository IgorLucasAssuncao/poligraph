"""O download do Portal da Transparência.

RISCO: Duas coisas que o servidor faz e o código precisa aguentar: responder 405 quando
limita a taxa, e entregar CSV em Latin-1.
"""

import zipfile
from datetime import date
from unittest import mock

import pytest
import requests

from poligraph_etl.fontes import portal


class Resposta:
    def __init__(self, status: int, corpo: bytes = b""):
        self.status_code = status
        self._corpo = corpo

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def iter_content(self, chunk_size):
        yield self._corpo


def test_405_e_limite_de_taxa_e_tenta_de_novo(tmp_path):
    """MEDIDO: Medido em 2026-09-24: 405 depois de ~18 downloads seguidos, e 200 depois da pausa."""
    esperas: list[int] = []
    respostas = iter([Resposta(405), Resposta(200, b"zip")])

    with mock.patch.object(portal.requests, "get", side_effect=lambda *a, **k: next(respostas)):
        destino = portal.baixar("orcamento-despesa/2025", tmp_path / "o.zip", esperar=esperas.append)

    assert destino.read_bytes() == b"zip"
    assert esperas == [portal.ESPERA_ENTRE_TENTATIVAS]


def test_desiste_depois_das_tentativas_sem_deixar_cache(tmp_path):
    """ATENÇÃO: Download que falhou não pode virar cache válido na próxima execução."""
    with mock.patch.object(portal.requests, "get", side_effect=lambda *a, **k: Resposta(405)):
        with pytest.raises(RuntimeError, match="405"):
            portal.baixar("orcamento-despesa/2025", tmp_path / "o.zip", esperar=lambda _: None)

    assert not (tmp_path / "o.zip").exists()


def test_le_latin1_como_texto(tmp_path):
    """RISCO: Latin-1, não UTF-8 — e tudo como texto, para `"00SJ"` e `"03101"` ficarem inteiros."""
    arquivo = tmp_path / "a.zip"
    conteudo = '"CÓDIGO AÇÃO";"CÓDIGO UNIDADE"\n"00SJ";"03101"\n'.encode("latin-1")
    with zipfile.ZipFile(arquivo, "w") as zf:
        info = zipfile.ZipInfo("2025_OrcamentoDespesa.csv", date_time=(2026, 9, 22, 5, 2, 0))
        zf.writestr(info, conteudo)

    df = portal.ler_csv(arquivo, "2025_OrcamentoDespesa.csv")

    assert df.to_dict("records") == [{"CÓDIGO AÇÃO": "00SJ", "CÓDIGO UNIDADE": "03101"}]
    assert portal.gerado_em(arquivo, "2025_OrcamentoDespesa.csv") == date(2026, 9, 22)


def test_403_passageiro_nao_vira_mes_nao_publicado(monkeypatch, tmp_path):
    """RISCO: o Portal responde 403 também quando limita o ritmo; o mês só falta se o 403 persistir."""
    respostas = iter([403, 403, 200])

    def baixar(recurso, destino, **_):
        codigo = next(respostas)
        if codigo == 403:
            resposta = requests.Response()
            resposta.status_code = 403
            raise requests.HTTPError(response=resposta)
        destino.write_bytes(b"ok")
        return destino

    monkeypatch.setattr(portal, "baixar", baixar)
    esperas: list[int] = []

    assert portal.baixar_publicado("cpcc/202102", tmp_path / "a.zip", esperar=esperas.append) == tmp_path / "a.zip"
    assert esperas == [portal.ESPERA_DO_403, portal.ESPERA_DO_403 * 2]


def test_403_que_persiste_e_404_sao_mes_nao_publicado(monkeypatch, tmp_path):
    def baixar_com(codigo):
        def baixar(recurso, destino, **_):
            resposta = requests.Response()
            resposta.status_code = codigo
            raise requests.HTTPError(response=resposta)
        return baixar

    monkeypatch.setattr(portal, "baixar", baixar_com(403))
    assert portal.baixar_publicado("cpdc/202301", tmp_path / "a.zip", esperar=lambda _: None) is None
    monkeypatch.setattr(portal, "baixar", baixar_com(404))
    assert portal.baixar_publicado("cpdc/202301", tmp_path / "a.zip", esperar=lambda _: None) is None

