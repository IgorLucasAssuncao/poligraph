"""Deputado que virou senador: a Câmara e o Senado criam uma pessoa cada, e o CPF as junta numa só."""

import pytest

from poligraph_etl import persistencia


@pytest.fixture
def duas_casas(conexao):
    conexao.execute(
        "TRUNCATE votos, votacoes, patrimonios, pessoa_fonte_ids, pessoas "
        "RESTART IDENTITY CASCADE"
    )
    conexao.execute(
        "INSERT INTO pessoas (nome_civil, nome_exibicao, cpf_hash) VALUES "
        "('Fulano', 'Fulano', 'h1'), ('Fulano', 'FULANO', 'h1'), ('Outro', 'Outro', 'h2')")
    conexao.execute("INSERT INTO pessoa_fonte_ids (pessoa_id, fonte, id_externo, metodo) VALUES (1, 'CAMARA', '10', 'MANUAL'), (2, 'SENADO', '20', 'MANUAL'), (3, 'CAMARA', '30', 'MANUAL')")
    for id_votacao, casa in (("c-1", "CAMARA"), ("s-1", "SENADO")):
        conexao.execute(
            "INSERT INTO votacoes (id, casa, legislatura, data, categoria, secreta, plenario) "
            "VALUES (%s, %s, 57, '2025-03-10', 'AUTORIDADE', false, true)", (id_votacao, casa))
    conexao.execute(
        "INSERT INTO votos (votacao_id, pessoa_id, valor, partido_no_voto, uf_no_voto) VALUES "
        "('c-1', 1, 1, 'X', 'SP'), ('s-1', 2, -1, 'X', 'SP')")
    conexao.execute(
        "INSERT INTO patrimonios (pessoa_id, ano_eleicao, tipo_bem, valor, quantidade) VALUES "
        "(1, 2018, 'Casa', 10, 1), (2, 2018, 'Casa', 10, 1), (2, 2022, 'Casa', 20, 1)")
    return conexao


def test_fica_o_id_menor_com_os_votos_das_duas_casas_e_o_bem_repetido_sai(duas_casas):
    pares = persistencia.pares_do_mesmo_cpf(duas_casas)

    assert pares == [(1, 2)]
    assert persistencia.fundir_pessoas(duas_casas, pares) == 1

    assert [r[0] for r in duas_casas.execute("SELECT id FROM pessoas ORDER BY 1").fetchall()] == [1, 3]
    assert duas_casas.execute("SELECT count(*) FROM votos WHERE pessoa_id = 1").fetchone()[0] == 2
    assert sorted(duas_casas.execute("SELECT fonte FROM pessoa_fonte_ids WHERE pessoa_id = 1").fetchall()) == [("CAMARA",), ("SENADO",)]
    assert duas_casas.execute("SELECT ano_eleicao, valor FROM patrimonios ORDER BY 1").fetchall() == [(2018, 10), (2022, 20)]
    assert persistencia.pares_do_mesmo_cpf(duas_casas) == []


def test_pessoa_sem_vinculo_e_apagada_e_a_com_dado_fica(duas_casas):
    """A órfã de uma recarga de `mandatos` sai; quem tem voto, bem ou id de casa fica."""
    duas_casas.execute("INSERT INTO pessoas (nome_civil, nome_exibicao) VALUES ('Órfã', 'Órfã')")

    assert persistencia.apagar_pessoas_sem_vinculo(duas_casas) == 1
    assert duas_casas.execute("SELECT count(*) FROM pessoas").fetchone()[0] == 3


def test_mesmo_titulo_tambem_junta(duas_casas):
    duas_casas.execute("UPDATE pessoas SET titulo_hash = 't1' WHERE id IN (2, 3)")
    duas_casas.execute("UPDATE pessoas SET cpf_hash = NULL WHERE id = 2")

    assert persistencia.pares_do_mesmo_cpf(duas_casas) == [(2, 3)]


def test_a_que_fica_sem_foto_herda_a_da_que_sai(duas_casas):
    """O eleito de 2026 criado pelo TSE antes da posse fica, e a foto é a da Câmara."""
    duas_casas.execute("UPDATE pessoas SET url_foto = 'https://www.camara.leg.br/foto.jpg' WHERE id = 2")

    persistencia.fundir_pessoas(duas_casas, [(1, 2)])

    assert duas_casas.execute("SELECT url_foto FROM pessoas WHERE id = 1").fetchone()[0] == "https://www.camara.leg.br/foto.jpg"
