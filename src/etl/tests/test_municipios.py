"""A cidade da sede de quem recebeu emenda — só por chave forte."""

import zipfile

import pytest

from poligraph_etl import malhas, municipios
from poligraph_etl.fontes import receita

TABELA = [
    {"CÓDIGO DO MUNICÍPIO - TOM": "7979", "CÓDIGO DO MUNICÍPIO - IBGE": "4113734",
     "MUNICÍPIO - TOM": "LINDOESTE", "MUNICÍPIO - IBGE": "Lindoeste", "UF": "PR"},
    {"CÓDIGO DO MUNICÍPIO - TOM": "1", "CÓDIGO DO MUNICÍPIO - IBGE": "5200050",
     "MUNICÍPIO - TOM": "ABADIA DE GOIAS", "MUNICÍPIO - IBGE": "Abadia de Goiás", "UF": "go"},
    {"CÓDIGO DO MUNICÍPIO - TOM": "9999", "CÓDIGO DO MUNICÍPIO - IBGE": "",
     "MUNICÍPIO - TOM": "SEM IBGE", "MUNICÍPIO - IBGE": "", "UF": "EX"},
]


def test_tom_ganha_zeros_a_esquerda():
    """ATENÇÃO: A tabela grava "1"; o cadastro de CNPJ, "0001". Sem o zfill a chave não casa."""
    linhas = municipios.municipios_para_linhas(TABELA)

    assert {"codigo_ibge": "5200050", "codigo_tom": "0001", "nome": "Abadia de Goiás", "uf": "GO"} in linhas


def test_municipio_sem_ibge_fica_de_fora():
    linhas = municipios.municipios_para_linhas(TABELA)

    assert [l["codigo_ibge"] for l in linhas] == ["4113734", "5200050"]


def test_sede_vira_ibge_pelo_tom_e_guarda_o_mes_do_cadastro():
    tom_para_ibge = {"7979": "4113734", "0001": "5200050"}

    linhas = municipios.sedes_para_linhas(
        {"12345678000190": "7979", "11222333000144": "1", "99888777000166": "4321"}, tom_para_ibge, "2026-09"
    )

    assert linhas == [
        {"cnpj": "12345678000190", "codigo_ibge": "4113734", "cadastro_de": "2026-09-01"},
        {"cnpj": "11222333000144", "codigo_ibge": "5200050", "cadastro_de": "2026-09-01"},
    ]


def _linha_do_cadastro(basico: str, ordem: str, dv: str, tom: str) -> str:
    colunas = [basico, ordem, dv] + ["X"] * 17 + [tom] + ["Y"] * 9
    return ";".join(f'"{c}"' for c in colunas)


def test_sedes_le_so_os_cnpjs_pedidos(tmp_path):
    arquivo = tmp_path / "Estabelecimentos0.zip"
    conteudo = "\n".join([
        _linha_do_cadastro("12345678", "0001", "90", "7979"),
        _linha_do_cadastro("11222333", "0001", "44", "0001"),
        _linha_do_cadastro("55555555", "0001", "55", "1234"),
    ])
    with zipfile.ZipFile(arquivo, "w") as zf:
        zf.writestr("K3241.ESTABELE", conteudo.encode("latin-1"))

    achados = receita.sedes([arquivo], {"12345678000190", "11222333000144"})

    assert achados == {"12345678000190": "7979", "11222333000144": "0001"}


def test_campo_com_quebra_de_linha_nao_desloca_as_colunas(tmp_path):
    """ATENÇÃO: O cadastro tem texto livre com quebra de linha dentro de aspas."""
    arquivo = tmp_path / "Estabelecimentos1.zip"
    colunas = ["12345678", "0001", "90"] + ["X"] * 3 + ["NOME\nFANTASIA"] + ["X"] * 13 + ["7979"] + ["Y"] * 9
    with zipfile.ZipFile(arquivo, "w") as zf:
        zf.writestr("K3241.ESTABELE", ";".join(f'"{c}"' for c in colunas).encode("latin-1"))

    assert receita.sedes([arquivo], {"12345678000190"}) == {"12345678000190": "7979"}


def test_tabela_tom_e_lida_em_latin1(tmp_path):
    caminho = tmp_path / "municipios.csv"
    caminho.write_bytes(
        "CÓDIGO DO MUNICÍPIO - TOM;CÓDIGO DO MUNICÍPIO - IBGE;MUNICÍPIO - TOM;MUNICÍPIO - IBGE;UF\n"
        "0001;5200050;ABADIA DE GOIAS;Abadia de Goiás;GO\n".encode("latin-1")
    )

    assert receita.ler_tabela_tom(caminho)[0]["MUNICÍPIO - IBGE"] == "Abadia de Goiás"


class _Resposta:
    def __init__(self, corpo: dict):
        self._corpo = corpo

    def raise_for_status(self):
        pass

    def json(self):
        return self._corpo


def test_malha_que_nao_e_topojson_para_com_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(malhas.requests, "get", lambda *_a, **_k: _Resposta({"type": "FeatureCollection"}))

    with pytest.raises(RuntimeError, match="TopoJSON"):
        malhas.baixar("https://exemplo", tmp_path / "brasil.json")


def test_malha_e_gravada_compacta(tmp_path, monkeypatch):
    topologia = {"type": "Topology", "objects": {}, "arcs": []}
    monkeypatch.setattr(malhas.requests, "get", lambda *_a, **_k: _Resposta(topologia))

    malhas.baixar("https://exemplo", tmp_path / "brasil.json")

    assert (tmp_path / "brasil.json").read_text(encoding="utf-8") == '{"type":"Topology","objects":{},"arcs":[]}'
