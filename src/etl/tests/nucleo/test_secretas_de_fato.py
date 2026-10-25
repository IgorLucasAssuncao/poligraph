"""Pendência 69 — a votação da Câmara com presença e nenhuma posição é secreta de fato."""

import pytest

from poligraph_etl.nucleo import persistencia


@pytest.fixture
def limpo(conexao):
    conexao.execute(
        "TRUNCATE votos, votacoes, pessoa_fonte_ids, pessoas "
        "RESTART IDENTITY CASCADE"
    )
    conexao.execute("INSERT INTO pessoas (nome_civil, nome_exibicao) VALUES ('A', 'A'), ('B', 'B')")
    return conexao


def _votacao(conexao, id_votacao, casa="CAMARA"):
    conexao.execute(
        "INSERT INTO votacoes (id, casa, legislatura, data, categoria, secreta, plenario) "
        "VALUES (%s, %s, 57, '2025-03-10', 'AUTORIDADE', false, true)",
        (id_votacao, casa),
    )


def _voto(conexao, id_votacao, pessoa, valor):
    conexao.execute(
        "INSERT INTO votos (votacao_id, pessoa_id, valor, partido_no_voto, uf_no_voto) VALUES (%s, %s, %s, 'X', 'SP')",
        (id_votacao, pessoa, valor),
    )


def test_so_presenca_vira_secreta_e_a_com_posicao_nao(limpo):
    _votacao(limpo, "eleicao-1")
    _voto(limpo, "eleicao-1", 1, None)
    _voto(limpo, "eleicao-1", 2, None)
    _votacao(limpo, "aberta-1")
    _voto(limpo, "aberta-1", 1, None)
    _voto(limpo, "aberta-1", 2, 1)
    _votacao(limpo, "sem-voto")

    assert persistencia.marcar_secretas_de_fato(limpo, "CAMARA") == 1

    marcadas = dict(limpo.execute("SELECT id, secreta FROM votacoes").fetchall())
    assert marcadas == {"eleicao-1": True, "aberta-1": False, "sem-voto": False}


def test_so_a_casa_pedida_e_idempotente(limpo):
    _votacao(limpo, "senado-1", casa="SENADO")
    _voto(limpo, "senado-1", 1, None)

    assert persistencia.marcar_secretas_de_fato(limpo, "CAMARA") == 0
    assert persistencia.marcar_secretas_de_fato(limpo, "SENADO") == 1
    assert persistencia.marcar_secretas_de_fato(limpo, "SENADO") == 0
