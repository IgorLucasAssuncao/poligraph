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
                  nascimento="01/02/1970", genero="2", partido="XYZ")
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

    grupos = mandatos.pessoas_novas(eleitos, identidades)

    assert [sorted(e.ano_eleicao for e in g) for g in grupos] == [[2020, 2024]]


def test_ponte_casa_pelo_nome_e_pela_grafia_mais_parecida_da_uf():
    eleitos = mandatos.eleitos([
        _linha(sq_candidato="1", codigo_ue="1", nome_ue="SÃO PAULO", titulo="111111111111"),
        _linha(sq_candidato="2", codigo_ue="2", nome_ue="GRACHO CARDOSO", uf="SE", titulo="222222222222"),
        _linha(sq_candidato="3", codigo_ue="3", nome_ue="LUGAR NENHUM", titulo="333333333333"),
    ])
    municipios = [("3550308", "São Paulo", "SP"), ("2802502", "Graccho Cardoso", "SE")]

    assert mandatos.ponte_de_municipios(eleitos, municipios) == {"1": "3550308", "2": "2802502", "3": None}
