"""Fixtures compartilhadas pelos testes do ETL.

🔴 UM container Postgres para a sessão inteira.

A fixture morava dentro de `test_persistencia.py` com `scope="module"`. Passou para cá
com `scope="session"` para valer para qualquer módulo que venha a precisar de banco —
e para ficar igual ao lado .NET, onde `FixturePostgres` faz o mesmo papel.

⚠️ O isolamento entre testes continua sendo do `limpar`, que trunca tudo antes de cada
um. A fixture é global; o estado, não.
"""

import pytest

psycopg = pytest.importorskip("psycopg")
PostgresContainer = pytest.importorskip("testcontainers.postgres").PostgresContainer

SCHEMA = """
CREATE TABLE pessoas (
    id BIGSERIAL PRIMARY KEY,
    nome_civil TEXT NOT NULL,
    nome_exibicao TEXT NOT NULL,
    cpf_hash TEXT,
    url_foto TEXT,
    excluido_em TIMESTAMPTZ
);
CREATE TABLE pessoa_fonte_ids (
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id),
    fonte TEXT NOT NULL,
    id_externo TEXT NOT NULL,
    metodo TEXT NOT NULL,
    confianca REAL,
    PRIMARY KEY (fonte, id_externo)
);
CREATE TABLE votacoes (
    id TEXT PRIMARY KEY,
    casa TEXT NOT NULL,
    legislatura SMALLINT NOT NULL,
    data DATE NOT NULL,
    orgao TEXT, descricao TEXT, proposicao_id BIGINT,
    categoria TEXT NOT NULL,
    secreta BOOLEAN NOT NULL DEFAULT FALSE,
    plenario BOOLEAN NOT NULL,
    votos_sim INT, votos_nao INT
);
CREATE TABLE votos (
    votacao_id TEXT NOT NULL REFERENCES votacoes(id) ON DELETE CASCADE,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id),
    valor SMALLINT CHECK (valor IS NULL OR valor IN (-1,0,1)),
    presenca TEXT CHECK (presenca IS NULL OR presenca IN ('PRESENTE','AUSENTE_JUSTIFICADO','AUSENTE')),
    partido_no_voto TEXT NOT NULL,
    uf_no_voto CHAR(2) NOT NULL,
    PRIMARY KEY (votacao_id, pessoa_id)
);
-- Só o que `apagar_votacoes` consulta: a pergunta e a cascata, como no EF.
CREATE TABLE perguntas (
    id TEXT PRIMARY KEY,
    votacao_id TEXT NOT NULL REFERENCES votacoes(id) ON DELETE CASCADE
);
CREATE TABLE execucoes (
    id BIGSERIAL PRIMARY KEY,
    casa TEXT NOT NULL, legislatura SMALLINT NOT NULL, k SMALLINT NOT NULL,
    versao_carga TEXT NOT NULL,
    iniciada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluida_em TIMESTAMPTZ,
    status TEXT NOT NULL,
    minimo_votacoes_comuns SMALLINT, razao_recencia DOUBLE PRECISION,
    peso_destaque DOUBLE PRECISION, peso_autoridade DOUBLE PRECISION
);
CREATE TABLE similaridades (
    execucao_id BIGINT NOT NULL REFERENCES execucoes(id) ON DELETE CASCADE,
    pessoa_a BIGINT NOT NULL, pessoa_b BIGINT NOT NULL,
    metrica TEXT NOT NULL, valor REAL NOT NULL,
    n_votacoes_comuns INT NOT NULL CHECK (n_votacoes_comuns >= 20),
    PRIMARY KEY (execucao_id, pessoa_a, pessoa_b, metrica),
    CHECK (pessoa_a < pessoa_b)
);
CREATE TABLE noticias (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    veiculo TEXT NOT NULL,
    publicada_em TIMESTAMPTZ NOT NULL,
    trecho TEXT,
    hash_titulo TEXT NOT NULL,
    coletada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 🔴 RF-38 virando constraint: se alguém tentar gravar o corpo da matéria, o
    --    banco recusa. É a mesma checagem que o EF cria.
    CHECK (trecho IS NULL OR length(trecho) <= 500)
);
CREATE TABLE noticia_pessoas (
    noticia_id BIGINT NOT NULL REFERENCES noticias(id) ON DELETE CASCADE,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    confianca REAL NOT NULL CHECK (confianca BETWEEN 0 AND 1),
    metodo TEXT NOT NULL
        CHECK (metodo IN ('NOME_COMPLETO','NOME_PARLAMENTAR','SOBRENOME')),
    PRIMARY KEY (noticia_id, pessoa_id)
);
"""


@pytest.fixture(scope="session")
def conexao():
    try:
        container = PostgresContainer("postgres:17-alpine")
        container.start()
    except Exception as erro:                      # pragma: no cover
        pytest.skip(f"Docker indisponível: {erro}")

    url = container.get_connection_url().replace("postgresql+psycopg2", "postgresql")
    conn = psycopg.connect(url, autocommit=True)
    conn.execute(SCHEMA)

    yield conn

    conn.close()
    container.stop()
