"""Pendência 90: os eleitos do TSE viram mandatos, e os valores fechados da fonte viram enum."""

import pytest

from poligraph_etl import mandatos
from poligraph_etl.contratos.tse import LinhaDeCandidatura
from poligraph_etl.normalizacao import hash_de_cpf, hash_de_titulo
from poligraph_etl.tipos import (
    TipoCargo, TipoSituacaoNoTurno, ValorDesconhecido, anos_do_mandato, cargo_do_tse, sexo_do_tse, situacao_do_tse,
)

TITULO = "012345678901"


def _linha(**campos) -> LinhaDeCandidatura:
    padrao = dict(ano_eleicao="2024", sq_candidato="1", cargo="11", situacao="ELEITO", uf="SP", codigo_ue="71072",
                  nome_ue="SÃO PAULO", nome="FULANO", nome_de_urna="FULANO", cpf="-4", titulo=TITULO,
                  nascimento="01/02/1970", genero="2", partido="XYZ", numero="10", coligacao="XYZ / ABC", sq_coligacao="-1")
    return LinhaDeCandidatura(**(padrao | campos))


def test_sentinela_do_tse_nao_vira_cpf():
    """RISCO: `-4` virava `00000000004` e juntava os 11.126 eleitos de 2024 numa pessoa só."""
    assert hash_de_cpf("-4") is None
    assert hash_de_cpf("-1") is None


def test_titulo_so_com_doze_digitos_e_em_hash_diferente_do_cpf():
    assert hash_de_titulo("123") is None
    assert hash_de_titulo(TITULO) not in (None, hash_de_cpf("01234567890"))


def test_situacao_por_igualdade_exata():
    """ATENÇÃO: "contém ELEITO" pegaria NÃO ELEITO."""
    assert situacao_do_tse("NÃO ELEITO") is TipoSituacaoNoTurno.NAO_ELEITO
    assert situacao_do_tse("MÉDIA") is TipoSituacaoNoTurno.ELEITO_POR_MEDIA


@pytest.mark.parametrize("funcao, valor", [(cargo_do_tse, "99"), (situacao_do_tse, "ELEITO?"), (sexo_do_tse, "9")])
def test_valor_novo_da_fonte_derruba_a_carga(funcao, valor):
    with pytest.raises(ValorDesconhecido):
        funcao(valor)


def test_vereador_e_suplente_ficam_fora_do_escopo():
    assert cargo_do_tse("13") is None
    assert cargo_do_tse("9") is None


def test_senador_tem_oito_anos_e_o_resto_quatro():
    assert anos_do_mandato(TipoCargo.SENADOR, 2022) == (2023, 2030)
    assert anos_do_mandato(TipoCargo.PREFEITO, 2024) == (2025, 2028)


def test_mesmo_numero_em_municipios_diferentes_sao_dois_eleitos():
    """RISCO: até 2008 o `SQ_CANDIDATO` só é único dentro do município."""
    eleitos = mandatos.eleitos([
        _linha(ano_eleicao="2000", sq_candidato="93", codigo_ue="71072", titulo="111111111111"),
        _linha(ano_eleicao="2000", sq_candidato="93", codigo_ue="60011", titulo="222222222222"),
    ])
    assert len(eleitos) == 2


def test_so_eleito_entra_e_o_segundo_turno_fica_com_a_linha_de_eleito():
    eleitos = mandatos.eleitos([
        _linha(sq_candidato="1", situacao="2º TURNO"),
        _linha(sq_candidato="1", situacao="ELEITO"),
        _linha(sq_candidato="2", situacao="NÃO ELEITO"),
        _linha(sq_candidato="3", cargo="13"),
    ])
    assert [e.sq_candidato for e in eleitos] == ["1"]


def test_titulo_liga_a_mesma_pessoa_entre_eleicoes_e_o_congresso_nao_cria_pessoa():
    eleitos = mandatos.eleitos([
        _linha(ano_eleicao="2020", sq_candidato="10", cpf="52998224725"),
        _linha(ano_eleicao="2024", sq_candidato="20"),
        _linha(ano_eleicao="2022", sq_candidato="30", cargo="6", titulo="999999999999", codigo_ue="SP"),
    ])
    identidades = mandatos.Identidades({}, {}, {}, {})

    grupos = mandatos.pessoas_novas(eleitos, identidades, 2026)

    assert [sorted(e.ano_eleicao for e in g) for g in grupos] == [[2020, 2024]]


def test_eleito_para_o_congresso_ganha_pessoa_antes_da_posse_e_so_entao():
    eleitos = mandatos.eleitos([
        _linha(ano_eleicao="2026", sq_candidato="40", cargo="6", titulo="888888888888", codigo_ue="SP"),
    ])
    identidades = mandatos.Identidades({}, {}, {}, {})

    assert len(mandatos.pessoas_novas(eleitos, identidades, 2026)) == 1
    assert mandatos.pessoas_novas(eleitos, identidades, 2027) == []


def test_ponte_casa_pelo_nome_e_pela_grafia_mais_parecida_da_uf():
    eleitos = mandatos.eleitos([
        _linha(sq_candidato="1", codigo_ue="1", nome_ue="SÃO PAULO", titulo="111111111111"),
        _linha(sq_candidato="2", codigo_ue="2", nome_ue="GRACHO CARDOSO", uf="SE", titulo="222222222222"),
        _linha(sq_candidato="3", codigo_ue="3", nome_ue="LUGAR NENHUM", titulo="333333333333"),
    ])
    municipios = [("3550308", "São Paulo", "SP"), ("2802502", "Graccho Cardoso", "SE")]

    assert mandatos.ponte_de_municipios(eleitos, municipios) == {"1": "3550308", "2": "2802502", "3": None}


def test_quem_ja_tem_pessoa_empresta_o_titulo_ao_eleito_sem_cpf():
    """O de 2020 é achado pelo CPF; o de 2024, só com título, tem de cair na mesma pessoa."""
    eleitos = mandatos.eleitos([
        _linha(ano_eleicao="2020", sq_candidato="10", cpf="52998224725"),
        _linha(ano_eleicao="2024", sq_candidato="20"),
    ])
    identidades = mandatos.Identidades({hash_de_cpf("52998224725"): 7}, {}, {}, {})

    identidades.propagar(eleitos)

    assert [identidades.pessoa(e) for e in eleitos] == [7, 7]
    assert mandatos.pessoas_novas(eleitos, identidades, 2026) == []


def test_campanha_de_governador_liga_pela_candidatura_eleita_sem_filtro_de_cargo():
    """Pendência 90: governador não é cargo do Congresso, e entra pela candidatura do mandato."""
    from poligraph_etl import receitas

    registros = [
        {"SG_UE": "SP", "SQ_CANDIDATO": "250001", "DS_CARGO": "GOVERNADOR", "NR_CPF_CANDIDATO": "-4",
         "VR_RECEITA": "1000,00", "DS_FONTE_RECEITA": "FUNDO ESPECIAL", "NR_CPF_CNPJ_DOADOR": "", "NM_DOADOR": "Partido"},
        {"SG_UE": "SP", "SQ_CANDIDATO": "999", "DS_CARGO": "GOVERNADOR", "NR_CPF_CANDIDATO": "-4",
         "VR_RECEITA": "5,00", "DS_FONTE_RECEITA": "OUTROS", "NR_CPF_CNPJ_DOADOR": "", "NM_DOADOR": "X"},
    ]

    linhas = receitas.para_linhas(registros, {}, 2022, por_candidatura={("SP", "250001"): 7})

    assert [(l["pessoa_id"], l["valor"]) for l in linhas] == [(7, 1000.0)]


def test_vice_com_situacao_nula_entra_pela_chapa_do_titular_eleito():
    """RISCO: até 2010 o vice vem `#NULO#`; o da chapa eleita divide o número com o titular eleito."""
    eleitos = mandatos.eleitos([
        _linha(ano_eleicao="2008", sq_candidato="1", cargo="11", numero="15", titulo="111111111111"),
        _linha(ano_eleicao="2008", sq_candidato="2", cargo="12", situacao="#NULO#", numero="15", titulo="222222222222"),
        _linha(ano_eleicao="2008", sq_candidato="3", cargo="12", situacao="#NULO#", numero="45", titulo="333333333333"),
        _linha(ano_eleicao="2008", sq_candidato="4", cargo="11", situacao="NÃO ELEITO", numero="45", titulo="444444444444"),
    ])

    assert sorted((e.cargo.value, e.sq_candidato) for e in eleitos) == [("PREFEITO", "1"), ("VICE_PREFEITO", "2")]
    assert eleitos[0].coligacao == "XYZ / ABC"


def test_vice_de_2000_entra_pela_coligacao_quando_o_numero_e_outro():
    """MEDIDO em 2026-10-22: em 1998 e 2000 o vice tem outro número e a mesma coligação do titular."""
    eleitos = mandatos.eleitos([
        _linha(ano_eleicao="2000", sq_candidato="93", cargo="11", numero="11", sq_coligacao="1", titulo="111111111111"),
        _linha(ano_eleicao="2000", sq_candidato="94", cargo="12", situacao="#NULO#", numero="251", sq_coligacao="1", titulo="222222222222"),
        _linha(ano_eleicao="2000", sq_candidato="92", cargo="12", situacao="#NULO#", numero="151", sq_coligacao="2", titulo="333333333333"),
    ])

    assert sorted(e.sq_candidato for e in eleitos) == ["93", "94"]
