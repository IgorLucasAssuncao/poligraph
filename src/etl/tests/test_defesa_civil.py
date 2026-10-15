"""Cartão de Pagamento da Defesa Civil: do arquivo do Portal à tabela, sem perder real nem mês."""

import csv
import io
import zipfile

import pytest
import requests

from poligraph_etl import __main__ as etl
from poligraph_etl import defesa_civil
from poligraph_etl.contratos import entrada
from poligraph_etl.contratos.banco import GastoDaDefesaCivil
from poligraph_etl.contratos.portal import LinhaDoCartaoDaDefesaCivil
from poligraph_etl.fontes import portal

CABECALHO = [
    "CÓDIGO ÓRGÃO SUPERIOR", "NOME ÓRGÃO SUPERIOR", "ANO EXTRATO", "MÊS EXTRATO", "CPF PORTADOR", "NOME PORTADOR",
    "CNPJ OU CPF FAVORECIDO", "NOME FAVORECIDO", "EXECUTOR DESPESA", "NÚMERO CONVÊNIO", "CÓDIGO CONVENENTE",
    "NOME CONVENENTE", "DATA TRANSAÇÃO", "VALOR TRANSAÇÃO",
]


def transacao(**campos) -> dict:
    """DECISÃO: valores copiados de uma linha REAL de `202405_CPDC.csv`."""
    base = {
        "CÓDIGO ÓRGÃO SUPERIOR": "53000", "NOME ÓRGÃO SUPERIOR": "Ministério da Integração e do Desenvolvime",
        "ANO EXTRATO": "2024", "MÊS EXTRATO": "05", "CPF PORTADOR": "***.648.472-**", "NOME PORTADOR": "PORTADOR",
        "CNPJ OU CPF FAVORECIDO": "08758770000100", "NOME FAVORECIDO": "AGRO CHAMI IMP E EXP LTDA",
        "EXECUTOR DESPESA": "ASSIS BRASIL / AC", "NÚMERO CONVÊNIO": "1AARAW", "CÓDIGO CONVENENTE": "04045993000179",
        "NOME CONVENENTE": "MUNICIPIO DE ASSIS BRASIL", "DATA TRANSAÇÃO": "05/04/2024", "VALOR TRANSAÇÃO": "136576,00",
    }
    return {**base, **campos}


def test_soma_o_mes_por_executor_e_mantem_o_estorno():
    linhas = entrada.ler(LinhaDoCartaoDaDefesaCivil, [
        transacao(),
        transacao(**{"VALOR TRANSAÇÃO": "295559,00"}),
        transacao(**{"VALOR TRANSAÇÃO": "-1000,00"}),
        transacao(**{"EXECUTOR DESPESA": "GOVERNO DO ESTADO / RS", "CÓDIGO CONVENENTE": "92958800000138",
                     "VALOR TRANSAÇÃO": "50,50"}),
    ])

    gastos = defesa_civil.transformar(linhas)

    assert gastos == [
        GastoDaDefesaCivil(ano=2024, mes=5, executor="ASSIS BRASIL", uf="AC", esfera="MUNICIPAL",
                           cnpj_convenente="04045993000179", valor=431135.0, transacoes=3),
        GastoDaDefesaCivil(ano=2024, mes=5, executor="GOVERNO DO ESTADO", uf="RS", esfera="ESTADUAL",
                           cnpj_convenente="92958800000138", valor=50.5, transacoes=1),
    ]


def test_o_contrato_nao_le_o_cpf_de_ninguem():
    """RISCO: RNF-13. O arquivo traz o CPF do portador e o documento do favorecido; nenhum dos dois é coluna lida."""
    lidas = set(entrada.colunas_da_fonte(LinhaDoCartaoDaDefesaCivil).values())

    assert lidas.isdisjoint({"CPF PORTADOR", "NOME PORTADOR", "CNPJ OU CPF FAVORECIDO", "NOME FAVORECIDO"})


def test_executor_sem_informacao_entra_sem_uf_e_fica_no_total():
    """O Portal publica 'Sem informação / -1' em convênio do próprio Ministério: o real não pode sumir."""
    [gasto] = defesa_civil.transformar(entrada.ler(LinhaDoCartaoDaDefesaCivil, [
        transacao(**{"EXECUTOR DESPESA": "Sem informação / -1", "CÓDIGO CONVENENTE": "03353358000439"}),
    ]))

    assert (gasto.executor, gasto.uf, gasto.esfera, gasto.valor) == ("Sem informação", None, "NAO_INFORMADA", 136576.0)


@pytest.mark.parametrize("bruto", ["ASSIS BRASIL", "ASSIS BRASIL / ACRE", " / AC", "Outra coisa / -1", None])
def test_executor_fora_do_formato_derruba_a_carga(bruto):
    with pytest.raises(entrada.LayoutMudou):
        defesa_civil.separar_executor(bruto)


def _zip_do_mes(destino, ano: int, mes: int, linhas: list[dict]):
    texto = io.StringIO()
    escritor = csv.DictWriter(texto, fieldnames=CABECALHO, delimiter=";", quoting=csv.QUOTE_ALL)
    escritor.writeheader()
    escritor.writerows(linhas)
    with zipfile.ZipFile(destino, "w") as arquivo:
        arquivo.writestr(defesa_civil.arquivo_do_mes(ano, mes), texto.getvalue().encode("latin-1"))
    return destino


@pytest.mark.integracao
def test_comando_grava_os_meses_publicados_e_pula_o_que_falta(conexao, tmp_path, monkeypatch):
    """O Portal não publicou jan/2023 e nov/2025: o mês que falta não pode encerrar o ano."""
    conexao.execute("TRUNCATE cargas, gastos_da_defesa_civil" " CASCADE")

    def baixar(recurso, destino, **_):
        ano, mes = int(recurso[-6:-2]), int(recurso[-2:])
        if mes == 1:
            resposta = requests.Response()
            resposta.status_code = 403
            raise requests.HTTPError(response=resposta)
        if mes > 3:
            resposta = requests.Response()
            resposta.status_code = 404
            raise requests.HTTPError(response=resposta)
        return _zip_do_mes(destino, ano, mes, [transacao(**{"ANO EXTRATO": str(ano), "MÊS EXTRATO": f"{mes:02d}"})])

    monkeypatch.setattr(etl, "CACHE", tmp_path)
    monkeypatch.setattr(portal, "baixar", baixar)
    monkeypatch.setattr(portal, "ESPERA_DO_403", 0)

    etl._defesa_civil(conexao, [2024])

    meses = conexao.execute(
        "SELECT mes, valor::float, transacoes, carga_id IS NOT NULL FROM gastos_da_defesa_civil ORDER BY mes"
    ).fetchall()
    assert meses == [(2, 136576.0, 1, True), (3, 136576.0, 1, True)]
