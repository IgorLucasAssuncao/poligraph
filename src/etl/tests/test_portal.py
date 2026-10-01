"""O download do Portal da Transparência.

🔴 Duas coisas que o servidor faz e o código precisa aguentar: responder 405 quando
limita a taxa, e entregar CSV em Latin-1.
"""

import zipfile
from datetime import date
from unittest import mock

import pytest

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
    """📐 Medido em 2026-09-24: 405 depois de ~18 downloads seguidos, e 200 depois da pausa."""
    esperas: list[int] = []
    respostas = iter([Resposta(405), Resposta(200, b"zip")])

    with mock.patch.object(portal.requests, "get", side_effect=lambda *a, **k: next(respostas)):
        destino = portal.baixar("orcamento-despesa/2025", tmp_path / "o.zip", esperar=esperas.append)

    assert destino.read_bytes() == b"zip"
    assert esperas == [portal.ESPERA_ENTRE_TENTATIVAS]


def test_desiste_depois_das_tentativas_sem_deixar_cache(tmp_path):
    """⚠️ Download que falhou ⛔ pode virar cache válido na próxima execução."""
    with mock.patch.object(portal.requests, "get", side_effect=lambda *a, **k: Resposta(405)):
        with pytest.raises(RuntimeError, match="405"):
            portal.baixar("orcamento-despesa/2025", tmp_path / "o.zip", esperar=lambda _: None)

    assert not (tmp_path / "o.zip").exists()


def test_le_latin1_como_texto(tmp_path):
    """🔴 Latin-1, ⛔ UTF-8 — e tudo como texto, para `"00SJ"` e `"03101"` ficarem inteiros."""
    arquivo = tmp_path / "a.zip"
    conteudo = '"CÓDIGO AÇÃO";"CÓDIGO UNIDADE"\n"00SJ";"03101"\n'.encode("latin-1")
    with zipfile.ZipFile(arquivo, "w") as zf:
        info = zipfile.ZipInfo("2025_OrcamentoDespesa.csv", date_time=(2026, 9, 22, 5, 2, 0))
        zf.writestr(info, conteudo)

    df = portal.ler_csv(arquivo, "2025_OrcamentoDespesa.csv")

    assert df.to_dict("records") == [{"CÓDIGO AÇÃO": "00SJ", "CÓDIGO UNIDADE": "03101"}]
    assert portal.gerado_em(arquivo, "2025_OrcamentoDespesa.csv") == date(2026, 9, 22)
