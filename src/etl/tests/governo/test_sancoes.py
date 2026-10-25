"""Sanções a empresas: só CNPJ entra, e o CPF de pessoa física nunca chega ao banco."""

import csv
import io
import zipfile

import pytest
import requests

from poligraph_etl import __main__ as etl
from poligraph_etl.governo import sancoes
from poligraph_etl.contratos import entrada
from poligraph_etl.contratos.portal import LinhaDeSancao
from poligraph_etl.fontes import portal


def sancao(**campos) -> dict:
    """DECISÃO: valores de uma linha REAL de `20261009_CNEP.csv`."""
    base = {
        "CADASTRO": "CNEP", "CÓDIGO DA SANÇÃO": "133076", "TIPO DE PESSOA": "J",
        "CPF OU CNPJ DO SANCIONADO": "14286903000195", "NOME DO SANCIONADO": "SALOC SERVICOS E MANUTENCAO INDUSTRIAL EIRELI",
        "CATEGORIA DA SANÇÃO": "Multa", "VALOR DA MULTA": "137260,07", "DATA INÍCIO SANÇÃO": "09/03/2022",
        "DATA FINAL SANÇÃO": "", "ÓRGÃO SANCIONADOR": "Petróleo Brasileiro S.A.", "ESFERA ÓRGÃO SANCIONADOR": "FEDERAL",
        "FUNDAMENTAÇÃO LEGAL": "LEI 12846 - ART. 6º, I",
    }
    return {**base, **campos}


def test_pessoa_fisica_nunca_passa():
    """RISCO: o CEIS publica CPF sem máscara. A linha de pessoa física some antes de virar saída."""
    linhas = entrada.ler(LinhaDeSancao, [
        sancao(),
        sancao(**{"TIPO DE PESSOA": "F", "CPF OU CNPJ DO SANCIONADO": "73554405868", "NOME DO SANCIONADO": "PESSOA"}),
    ])

    [empresa] = sancoes.para_empresas(linhas, ["137260,07", ""])

    assert (empresa.cnpj, empresa.inicio, empresa.fim, empresa.valor_da_multa) == ("14286903000195", "2022-03-09", None, 137260.07)
    assert "73554405868" not in repr(sancoes.para_empresas(linhas, ["", ""]))


def test_empresa_individual_sai_sem_o_cpf_do_dono_no_nome():
    linhas = entrada.ler(LinhaDeSancao, [sancao(**{"NOME DO SANCIONADO": "FULANA PEREIRA 529.982.247-25"})])

    [empresa] = sancoes.para_empresas(linhas, [""])

    assert empresa.nome == "FULANA PEREIRA"


def test_esfera_vazia_vira_nula():
    [empresa] = sancoes.para_empresas(entrada.ler(LinhaDeSancao, [sancao(**{"ESFERA ÓRGÃO SANCIONADOR": ""})]))

    assert empresa.esfera is None
    assert empresa.valor_da_multa is None


def _zip(destino, membro, linhas):
    texto = io.StringIO()
    escritor = csv.DictWriter(texto, fieldnames=list(linhas[0]), delimiter=";", quoting=csv.QUOTE_ALL)
    escritor.writeheader()
    escritor.writerows(linhas)
    with zipfile.ZipFile(destino, "w") as arquivo:
        arquivo.writestr(membro, texto.getvalue().encode("latin-1"))
    return destino


@pytest.mark.integracao
def test_comando_troca_o_retrato_e_volta_um_dia_se_o_de_hoje_nao_saiu(conexao, tmp_path, monkeypatch):
    conexao.execute("TRUNCATE cargas, sancoes_de_empresas" " CASCADE")
    pedidos: list[str] = []

    def baixar(recurso, destino, **_):
        pedidos.append(recurso)
        cadastro, data = recurso.split("/")
        if len([p for p in pedidos if p.startswith(cadastro)]) == 1:
            resposta = requests.Response()
            resposta.status_code = 403
            raise requests.HTTPError(response=resposta)
        linha = sancao(**{"CADASTRO": cadastro.upper(), "CÓDIGO DA SANÇÃO": f"{cadastro}-1"})
        if cadastro == "ceis":
            linha.pop("VALOR DA MULTA")
        return _zip(destino, sancoes.membro(cadastro, data), [linha])

    monkeypatch.setattr(etl, "CACHE", tmp_path)
    monkeypatch.setattr(portal, "baixar", baixar)

    etl._sancoes(conexao)

    assert len(pedidos) == 4
    assert conexao.execute(
        "SELECT cadastro, cnpj, valor_da_multa::float FROM sancoes_de_empresas ORDER BY cadastro"
    ).fetchall() == [("CEIS", "14286903000195", None), ("CNEP", "14286903000195", 137260.07)]
