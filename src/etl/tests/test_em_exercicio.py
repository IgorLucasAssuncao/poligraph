"""Quem está em exercício, pela lista oficial de cada casa (decisão do autor, 2026-10-18)."""

import pytest

from poligraph_etl import em_exercicio, persistencia


def _deputados(quantos: int, legislatura: str = "57") -> list[dict]:
    return [{"id": str(1000 + i), "idLegislatura": legislatura, "nome": f"Deputado {i}"} for i in range(quantos)]


def _senadores(quantos: int) -> list[dict]:
    return [{"CodigoParlamentar": str(5000 + i), "NomeParlamentar": f"Senador {i}"} for i in range(quantos)]


def test_camara_liga_cada_deputado_a_pessoa_e_conta_quem_ainda_nao_existe():
    pessoas = {str(1000 + i): 10 + i for i in range(510)}

    resultado = em_exercicio.da_camara(_deputados(513), pessoas)

    assert len(resultado.linhas) == 510
    assert resultado.sem_pessoa == 3
    assert {(l.casa, l.legislatura) for l in resultado.linhas} == {("CAMARA", 57)}


def test_senado_nao_tem_legislatura_unica():
    pessoas = {str(5000 + i): 900 + i for i in range(81)}

    resultado = em_exercicio.do_senado(_senadores(81), pessoas)

    assert len(resultado.linhas) == 81
    assert {l.legislatura for l in resultado.linhas} == {None}


@pytest.mark.parametrize(("casa", "registros"), [("CAMARA", _deputados(120)), ("SENADO", _senadores(20))])
def test_lista_curta_para_a_carga_antes_de_gravar(casa, registros):
    """Uma lista cortada tiraria da lista de seguidos de todo mundo quem faltasse nela."""
    transformar = em_exercicio.da_camara if casa == "CAMARA" else em_exercicio.do_senado

    with pytest.raises(RuntimeError, match="nada foi gravado"):
        transformar(registros, {})


def test_a_mesma_pessoa_entra_uma_vez():
    """Dois ids da fonte para a mesma pessoa não podem quebrar a chave da tabela."""
    pessoas = {str(1000 + i): 10 + i for i in range(513)}
    pessoas["1001"] = 10

    resultado = em_exercicio.da_camara(_deputados(513), pessoas)

    assert len({l.pessoa_id for l in resultado.linhas}) == len(resultado.linhas) == 512


def test_gravar_troca_o_retrato_so_da_casa(conexao):
    a, b, c = (
        conexao.execute("INSERT INTO pessoas (nome_civil, nome_exibicao) VALUES (%s, %s) RETURNING id", (nome, nome)).fetchone()[0]
        for nome in ("Em exercício A", "Em exercício B", "Em exercício C")
    )
    carga = conexao.execute(
        "INSERT INTO cargas (fonte, url, sha256, bytes, comando) VALUES ('CAMARA', 'deputados', repeat('e', 64), 1, 'c') RETURNING id"
    ).fetchone()[0]
    deputados = em_exercicio.da_camara(_deputados(500), {"1000": a, "1001": b}).linhas
    senadores = em_exercicio.do_senado(_senadores(78), {"5000": c}).linhas

    persistencia.gravar_em_exercicio(conexao, "CAMARA", deputados, carga)
    persistencia.gravar_em_exercicio(conexao, "SENADO", senadores, carga)
    persistencia.gravar_em_exercicio(conexao, "CAMARA", deputados[:1], carga)

    linhas = conexao.execute("SELECT pessoa_id, casa FROM em_exercicio ORDER BY pessoa_id").fetchall()
    assert linhas == [(a, "CAMARA"), (c, "SENADO")]
    conexao.execute("DELETE FROM em_exercicio")
    conexao.execute("DELETE FROM pessoas WHERE id = ANY(%s)", ([a, b, c],))
    conexao.execute("DELETE FROM cargas WHERE id = %s", (carga,))
