"""Pendência 71 — a sede pelo código IBGE, e nada mais da resposta."""

from poligraph_etl.fontes import brasilapi


class _Resposta:
    def __init__(self, status, corpo=None):
        self.status_code = status
        self._corpo = corpo

    def json(self):
        return self._corpo


CASCAVEL = {
    "cnpj": "76208867000107", "codigo_municipio_ibge": 4104808, "municipio": "CASCAVEL", "uf": "PR",
    "qsa": [{"nome_socio": "FULANO DE TAL", "cnpj_cpf_do_socio": "***123456**"}],
}


def test_so_os_quatro_campos_e_o_socio_nao_sai(monkeypatch):
    monkeypatch.setattr(brasilapi.requests, "get", lambda *a, **k: _Resposta(200, CASCAVEL))

    sede = brasilapi.sede("76208867000107")

    assert sede == {"cnpj": "76208867000107", "codigo_ibge": "4104808", "municipio": "CASCAVEL", "uf": "PR"}
    assert "FULANO" not in str(sede)


def test_limite_de_requisicoes_espera_e_tenta_de_novo(monkeypatch):
    respostas = iter([_Resposta(429), _Resposta(200, CASCAVEL)])
    esperas = []
    monkeypatch.setattr(brasilapi.requests, "get", lambda *a, **k: next(respostas))

    assert brasilapi.sede("76208867000107", esperar=esperas.append)["codigo_ibge"] == "4104808"
    assert esperas == [brasilapi.ESPERA_NO_LIMITE]


def test_nao_encontrado_ou_sem_codigo_e_nulo(monkeypatch):
    monkeypatch.setattr(brasilapi.requests, "get", lambda *a, **k: _Resposta(404, {}))
    assert brasilapi.sede("00000000000000") is None

    monkeypatch.setattr(brasilapi.requests, "get", lambda *a, **k: _Resposta(200, {"codigo_municipio_ibge": None}))
    assert brasilapi.sede("00000000000000") is None
