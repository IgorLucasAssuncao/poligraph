"""Quem governa — presidente e vice eleitos, do TSE."""

import pandas as pd
import pytest

from poligraph_etl import gestao


def candidato(cargo: str, numero: str, nome: str, urna: str, partido: str, situacao: str) -> dict:
    return {
        "ANO_ELEICAO": "2022", "DS_CARGO": cargo, "NR_CANDIDATO": numero,
        "NM_CANDIDATO": nome, "NM_URNA_CANDIDATO": urna, "SG_PARTIDO": partido,
        "DS_SIT_TOT_TURNO": situacao, "DS_COMPOSICAO_COLIGACAO": "COLIGAÇÃO X",
    }


def cadastro() -> pd.DataFrame:
    """DECISÃO: A forma do arquivo real: o eleito aparece como `2º TURNO` na linha do 1º turno."""
    return pd.DataFrame([
        candidato("PRESIDENTE", "13", "LUIZ INÁCIO LULA DA SILVA", "LULA", "PT", "2º TURNO"),
        candidato("PRESIDENTE", "13", "LUIZ INÁCIO LULA DA SILVA", "LULA", "PT", "ELEITO"),
        candidato("PRESIDENTE", "22", "JAIR MESSIAS BOLSONARO", "JAIR BOLSONARO", "PL", "NÃO ELEITO"),
        candidato("VICE-PRESIDENTE", "13", "GERALDO JOSÉ RODRIGUES ALCKMIN FILHO", "GERALDO ALCKMIN", "PSB", "ELEITO"),
        candidato("VICE-PRESIDENTE", "22", "WALTER SOUZA BRAGA NETTO", "BRAGA NETTO", "PL", "NÃO ELEITO"),
    ], dtype=str)


def test_presidente_e_vice_eleitos():
    linha = gestao.eleitos(cadastro())

    assert (linha["presidente_nome_de_urna"], linha["presidente_partido"]) == ("LULA", "PT")
    assert (linha["vice_nome_de_urna"], linha["vice_partido"]) == ("GERALDO ALCKMIN", "PSB")
    assert (linha["primeiro_ano"], linha["ultimo_ano"]) == (2023, 2026)


def test_sem_eleito_e_erro_claro():
    """ATENÇÃO: Eleição em andamento, ou formato novo: Não adivinhar quem governa."""
    df = cadastro()
    df = df[df["DS_SIT_TOT_TURNO"] != "ELEITO"]

    with pytest.raises(ValueError, match="PRESIDENTE eleito"):
        gestao.eleitos(df)


def test_o_cpf_nao_e_lido():
    """RISCO: O arquivo traz o CPF em claro; a leitura não o pede."""
    assert not any("CPF" in coluna for coluna in gestao.COLUNAS)
