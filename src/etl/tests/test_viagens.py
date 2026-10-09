"""Viagens a serviço: do ZIP anual do Portal às duas tabelas, sem perder pagamento nem ler o viajante."""

import csv
import io
import zipfile

import pytest

from poligraph_etl import __main__ as etl
from poligraph_etl import viagens
from poligraph_etl.contratos import entrada
from poligraph_etl.contratos.banco import DestinoDeViagem, ViagensDoOrgao
from poligraph_etl.contratos.portal import LinhaDePagamentoDeViagem, LinhaDeTrechoDeViagem, LinhaDeViagem
from poligraph_etl.fontes import portal


def pagamento(orgao: str, tipo: str, valor: str) -> dict:
    return {"Nome do órgão superior": orgao, "Tipo de pagamento": tipo, "Valor": valor}


def viagem(orgao: str, situacao: str = "Realizada", urgente: str = "NÃO") -> dict:
    return {"Nome do órgão superior": orgao, "Situação": situacao, "Viagem Urgente": urgente,
            "Nome": "SERVIDOR", "CPF viajante": "***.240.140-**"}


def trecho(pais: str, uf: str, cidade: str, diarias: str = "1,50") -> dict:
    return {"Destino - País": pais, "Destino - UF": uf, "Destino - Cidade": cidade, "Número Diárias": diarias}


@pytest.mark.parametrize(
    ("bruto", "tipo"),
    [("DIÁRIAS", "DIARIAS"), ("DIRIAS", "DIARIAS"), ("PASSAGEM", "PASSAGENS"), ("RESTITUIÇÃO", "RESTITUICAO"),
     ("RESTITUIO", "RESTITUICAO"), ("Serviço correlato: seguro", "SEGURO"), ("Servio correlato: seguro", "SEGURO")],
)
def test_tipo_reconhece_a_grafia_quebrada_do_arquivo(bruto, tipo):
    """MEDIDO (2026-10-09): o arquivo de 2026 traz as duas grafias de cada tipo acentuado."""
    assert viagens.tipo_do_pagamento(bruto) == tipo


def test_tipo_desconhecido_derruba_a_carga():
    with pytest.raises(entrada.LayoutMudou, match="HOSPEDAGEM"):
        viagens.tipo_do_pagamento("HOSPEDAGEM")


def test_soma_por_orgao_sem_perder_pagamento():
    pagamentos = entrada.ler(LinhaDePagamentoDeViagem, [
        pagamento("Ministério da Saúde", "DIÁRIAS", "1.000,00"),
        pagamento("Ministério da Saúde", "DIRIAS", "500,00"),
        pagamento("Ministério da Saúde", "PASSAGEM", "2.000,00"),
        pagamento("Sigiloso", "PASSAGEM", "300,00"),
        pagamento("Sigiloso", "Serviço correlato: seguro", "10,00"),
    ])
    lidas = entrada.ler(LinhaDeViagem, [
        viagem("Ministério da Saúde", urgente="SIM"), viagem("Ministério da Saúde", situacao="Não realizada"),
        viagem("Sigiloso"),
    ])

    orgaos = viagens.por_orgao(2026, pagamentos, lidas)

    assert orgaos == [
        ViagensDoOrgao(ano=2026, orgao_superior="Ministério da Saúde", viagens=2, urgentes=1, nao_realizadas=1,
                       diarias=1500.0, passagens=2000.0, restituicao=0.0, seguro=0.0),
        ViagensDoOrgao(ano=2026, orgao_superior="Sigiloso", viagens=1, urgentes=0, nao_realizadas=0,
                       diarias=0.0, passagens=300.0, restituicao=0.0, seguro=10.0),
    ]
    assert sum(o.diarias + o.passagens + o.restituicao + o.seguro for o in orgaos) == 3810.0


def test_o_contrato_nao_le_quem_viajou():
    """A tela mostra o órgão, não a pessoa: nome, CPF, cargo e motivo ficam no arquivo."""
    lidas = set(entrada.colunas_da_fonte(LinhaDeViagem).values())

    assert lidas.isdisjoint({"Nome", "CPF viajante", "Cargo", "Motivo"})


def test_destinos_tem_uf_so_no_brasil():
    trechos = entrada.ler(LinhaDeTrechoDeViagem, [
        trecho("Brasil", "Rio Grande do Sul", "Pelotas"),
        trecho("Brasil", "Rio Grande do Sul", "Pelotas", "0,50"),
        trecho("Inválido", "Inválido", "Inválido", "0,00"),
    ])

    assert viagens.destinos(2026, trechos) == [
        DestinoDeViagem(ano=2026, pais="Brasil", uf="Rio Grande do Sul", cidade="Pelotas", chegadas=2,
                        numero_de_diarias=2.0),
        DestinoDeViagem(ano=2026, pais="Inválido", uf=None, cidade="Inválido", chegadas=1, numero_de_diarias=0.0),
    ]


def _csv(linhas: list[dict]) -> bytes:
    texto = io.StringIO()
    escritor = csv.DictWriter(texto, fieldnames=list(linhas[0]), delimiter=";", quoting=csv.QUOTE_ALL)
    escritor.writeheader()
    escritor.writerows(linhas)
    return texto.getvalue().encode("latin-1")


@pytest.mark.integracao
def test_comando_grava_o_ano_nas_duas_tabelas(conexao, tmp_path, monkeypatch):
    conexao.execute("TRUNCATE cargas, viagens_do_orgao, destinos_de_viagem" " CASCADE")

    def baixar(recurso, destino, **_):
        with zipfile.ZipFile(destino, "w") as arquivo:
            arquivo.writestr(viagens.membro(2024, "pagamento"), _csv([pagamento("Sigiloso", "DIÁRIAS", "250,00")]))
            arquivo.writestr(viagens.membro(2024, "viagem"), _csv([viagem("Sigiloso", urgente="SIM")]))
            arquivo.writestr(viagens.membro(2024, "trecho"), _csv([trecho("França", "", "Paris", "3,00")]))
        return destino

    monkeypatch.setattr(etl, "CACHE", tmp_path)
    monkeypatch.setattr(portal, "baixar", baixar)

    etl._viagens(conexao, [2024])

    assert conexao.execute(
        "SELECT orgao_superior, viagens, urgentes, diarias::float, carga_id IS NOT NULL FROM viagens_do_orgao"
    ).fetchall() == [("Sigiloso", 1, 1, 250.0, True)]
    assert conexao.execute("SELECT pais, uf, cidade, chegadas FROM destinos_de_viagem").fetchall() == [
        ("França", None, "Paris", 1)]
