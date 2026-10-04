"""Fixtures compartilhadas pelos testes do ETL.

RISCO: UM container Postgres para a sessão inteira.

A fixture morava dentro de `test_persistencia.py` com `scope="module"`. Passou para cá
com `scope="session"` para valer para qualquer módulo que venha a precisar de banco —
e para ficar igual ao lado .NET, onde `FixturePostgres` faz o mesmo papel.

ATENÇÃO: O isolamento entre testes continua sendo do `limpar`, que trunca tudo antes de cada
um. A fixture é global; o estado, não.

DECISÃO (2026-10-04): o banco dos testes é criado com `schema_do_ef.sql`, o script que o EF gera
das migrations, e não mais com DDL escrito à mão aqui. O de antes tinha 8 das 34 tabelas,
com colunas a menos: `despesas` nunca tinha sido gravada num teste, e `perguntas` aceitava linha
sem texto. O CI do back confere que o script está em dia com as migrations.
"""

import os
from pathlib import Path

import pytest

os.environ.setdefault("POLIGRAPH_CHAVE_CPF", "chave-de-teste-com-mais-de-32-caracteres!")

psycopg = pytest.importorskip("psycopg")
PostgresContainer = pytest.importorskip("testcontainers.postgres").PostgresContainer


@pytest.fixture(scope="session")
def conexao():
    try:
        container = PostgresContainer("postgres:17-alpine")
        container.start()
    except Exception as erro:                      # pragma: no cover
        pytest.skip(f"Docker indisponível: {erro}")

    url = container.get_connection_url().replace("postgresql+psycopg2", "postgresql")
    conn = psycopg.connect(url, autocommit=True)
    conn.execute((Path(__file__).parent / 'schema_do_ef.sql').read_text(encoding='utf-8-sig'))

    yield conn

    conn.close()
    container.stop()
