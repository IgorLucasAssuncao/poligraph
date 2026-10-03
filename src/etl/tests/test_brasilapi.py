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

    sede = brasilapi.sede("76208867000107", brasilapi.Ritmo(esperar=lambda _: None))

    assert sede == {"cnpj": "76208867000107", "codigo_ibge": "4104808", "municipio": "CASCAVEL", "uf": "PR"}
    assert "FULANO" not in str(sede)


def test_recusa_dobra_a_pausa_e_tenta_de_novo(monkeypatch):
    respostas = iter([_Resposta(429), _Resposta(403), _Resposta(200, CASCAVEL)])
    esperas = []
    monkeypatch.setattr(brasilapi.requests, "get", lambda *a, **k: next(respostas))
    ritmo = brasilapi.Ritmo(esperar=esperas.append)

    assert brasilapi.sede("76208867000107", ritmo)["codigo_ibge"] == "4104808"
    assert esperas == [0.1, 0.2, 0.4]
    assert ritmo.recusas == 2


def test_a_pausa_encurta_depois_de_uma_sequencia_sem_erro_e_nao_passa_dos_limites():
    ritmo = brasilapi.Ritmo(esperar=lambda _: None)
    for _ in range(20):
        ritmo.recusou()
    assert ritmo.pausa == brasilapi.Ritmo.MAXIMA

    for _ in range(brasilapi.Ritmo.SEQUENCIA_PARA_ENCURTAR):
        ritmo.respondeu()
    assert ritmo.pausa == brasilapi.Ritmo.MAXIMA / 2

    for _ in range(brasilapi.Ritmo.SEQUENCIA_PARA_ENCURTAR * 20):
        ritmo.respondeu()
    assert ritmo.pausa == brasilapi.Ritmo.MINIMA


def test_nao_encontrado_ou_sem_codigo_e_nulo(monkeypatch):
    monkeypatch.setattr(brasilapi.requests, "get", lambda *a, **k: _Resposta(404, {}))
    assert brasilapi.sede("00000000000000", brasilapi.Ritmo(esperar=lambda _: None)) is None

    monkeypatch.setattr(brasilapi.requests, "get", lambda *a, **k: _Resposta(200, {"codigo_municipio_ibge": None}))
    assert brasilapi.sede("00000000000000", brasilapi.Ritmo(esperar=lambda _: None)) is None


def test_pede_com_user_agent_proprio(monkeypatch):
    """Com o user-agent padrão do `requests`, a BrasilAPI responde 429 a tudo."""
    pedidos = []
    monkeypatch.setattr(brasilapi.requests, "get", lambda *a, **k: pedidos.append(k) or _Resposta(200, CASCAVEL))

    brasilapi.sede("76208867000107", brasilapi.Ritmo(esperar=lambda _: None))

    assert pedidos[0]["headers"]["User-Agent"].startswith("poligraph-etl")

