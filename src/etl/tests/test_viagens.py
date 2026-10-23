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


def pagamento(orgao: str, tipo: str, valor: str, identificador: str = "") -> dict:
    return {"Identificador do processo de viagem": identificador, "Nome do órgão superior": orgao,
            "Tipo de pagamento": tipo, "Valor": valor}


def viagem(orgao: str, situacao: str = "Realizada", urgente: str = "NÃO", identificador: str = "") -> dict:
    return {"Identificador do processo de viagem": identificador, "Nome do órgão superior": orgao,
            "Situação": situacao, "Viagem Urgente": urgente, "Nome": "SERVIDOR", "CPF viajante": "***.240.140-**"}


def trecho(pais: str, uf: str, cidade: str, diarias: str = "1,50", identificador: str = "") -> dict:
    return {"Identificador do processo de viagem ": identificador, "Destino - País": pais, "Destino - UF": uf,
            "Destino - Cidade": cidade, "Número Diárias": diarias}


@pytest.mark.parametrize(
    ("bruto", "tipo"),
    [("DIÁRIAS", "DIARIAS"), ("DIRIAS", "DIARIAS"), ("PASSAGEM", "PASSAGENS"), ("RESTITUIÇÃO", "RESTITUICAO"),
     ("RESTITUIO", "RESTITUICAO"), ("Serviço correlato: seguro", "SEGURO"), ("Servio correlato: seguro", "SEGURO"),
     ("Taxa de agenciamento", "PASSAGENS")],
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


def test_pagamento_sigiloso_vai_para_o_orgao_da_viagem():
    """MEDIDO (2026-10-09): em 2026 todo pagamento `Sigiloso` tem a viagem em `Viagem.csv`, e 66.625
    deles são do Ministério da Justiça. Só fica em `Sigiloso` o que a viagem também esconde."""
    pagamentos = entrada.ler(LinhaDePagamentoDeViagem, [
        pagamento("Sigiloso", "DIÁRIAS", "400,00", identificador="1"),
        pagamento("Ministério da Justiça e Segurança Pública", "PASSAGEM", "100,00", identificador="2"),
        pagamento("Sigiloso", "PASSAGEM", "50,00", identificador="3"),
    ])
    lidas = entrada.ler(LinhaDeViagem, [
        viagem("Ministério da Justiça e Segurança Pública", identificador="1"),
        viagem("Ministério da Justiça e Segurança Pública", identificador="2"),
        viagem("Sigiloso", identificador="3"),
    ])

    orgaos = {o.orgao_superior: o for o in viagens.por_orgao(2026, pagamentos, lidas)}

    justica = orgaos["Ministério da Justiça e Segurança Pública"]
    assert (justica.diarias, justica.passagens, justica.pago_com_orgao_sigiloso) == (400.0, 100.0, 400.0)
    assert (orgaos["Sigiloso"].passagens, orgaos["Sigiloso"].pago_com_orgao_sigiloso) == (50.0, 0.0)


def test_destino_leva_o_orgao_da_viagem():
    lidas = entrada.ler(LinhaDeViagem, [viagem("Presidência da República", identificador="7")])
    trechos = entrada.ler(LinhaDeTrechoDeViagem, [
        trecho("Brasil", "Bahia", "Salvador", identificador="7"),
        trecho("Brasil", "Bahia", "Salvador", identificador="99"),
    ])

    destinos = viagens.destinos(2026, trechos, viagens.orgao_da_viagem(lidas))

    assert [(d.orgao_superior, d.chegadas) for d in destinos] == [
        ("Presidência da República", 1), (viagens.SEM_VIAGEM, 1)]


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

    assert viagens.destinos(2026, trechos, {}) == [
        DestinoDeViagem(ano=2026, pais="Brasil", uf="Rio Grande do Sul", cidade="Pelotas",
                        orgao_superior=viagens.SEM_VIAGEM, chegadas=2, numero_de_diarias=2.0),
        DestinoDeViagem(ano=2026, pais="Inválido", uf=None, cidade="Inválido",
                        orgao_superior=viagens.SEM_VIAGEM, chegadas=1, numero_de_diarias=0.0),
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
            arquivo.writestr(viagens.membro(2024, "pagamento"), _csv([pagamento("Sigiloso", "DIÁRIAS", "250,00", "5")]))
            arquivo.writestr(viagens.membro(2024, "viagem"), _csv([viagem("Sigiloso", urgente="SIM", identificador="5")]))
            arquivo.writestr(viagens.membro(2024, "trecho"), _csv([trecho("França", "", "Paris", "3,00", "5")]))
        return destino

    monkeypatch.setattr(etl, "CACHE", tmp_path)
    monkeypatch.setattr(portal, "baixar", baixar)

    etl._viagens(conexao, [2024])

    assert conexao.execute(
        "SELECT orgao_superior, viagens, urgentes, diarias::float, carga_id IS NOT NULL FROM viagens_do_orgao"
    ).fetchall() == [("Sigiloso", 1, 1, 250.0, True)]
    assert conexao.execute("SELECT orgao_superior, pais, uf, cidade, chegadas FROM destinos_de_viagem").fetchall() == [
        ("Sigiloso", "França", None, "Paris", 1)]
