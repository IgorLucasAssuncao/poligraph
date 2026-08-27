"""Testes de integração da gravação, contra Postgres real.

🔴 O que estes testes provam e nenhum unitário provaria: que a carga é IDEMPOTENTE.

O ETL roda todo dia sobre os mesmos arquivos — a Câmara os reconstrói toda madrugada,
inclusive os anos fechados (achado #19). Sem idempotência o banco dobraria de tamanho
por dia, e ninguém perceberia até o disco encher.

⚠️ Exigem Docker. Sem ele, são PULADOS — teste vermelho por falta de ambiente treina
a pessoa a ignorar vermelho.
"""

import pytest

psycopg = pytest.importorskip("psycopg")
PostgresContainer = pytest.importorskip(
    "testcontainers.postgres"
).PostgresContainer

from poligraph_etl import persistencia  # noqa: E402
from poligraph_etl.similaridade import ParSimilar  # noqa: E402

# 🔴 Schema mínimo espelhando o que o EF cria. ⛔ NÃO é a fonte da verdade.
#
# ⚠️ Escrever este DDL à mão já custou caro: durante todo o desenvolvimento ele usou os
#    nomes NO SINGULAR (`votacao`, `voto`, `pessoa`) enquanto o EF criava no plural. Os
#    testes passavam contra um banco que este arquivo inventava, e o ETL nunca havia
#    conseguido falar com o banco de verdade.
#
# ⭐ `test_contrato_schema.py` agora lê o `PoligraphDb.cs` e trava os NOMES. O que
#    continua sem proteção aqui são as COLUNAS — ver PL37.
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
    votacao_id TEXT NOT NULL REFERENCES votacoes(id),
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id),
    valor SMALLINT CHECK (valor IS NULL OR valor IN (-1,0,1)),
    partido_no_voto TEXT NOT NULL,
    uf_no_voto CHAR(2) NOT NULL,
    PRIMARY KEY (votacao_id, pessoa_id)
);
CREATE TABLE execucoes (
    id BIGSERIAL PRIMARY KEY,
    casa TEXT NOT NULL, legislatura SMALLINT NOT NULL, k SMALLINT NOT NULL,
    versao_carga TEXT NOT NULL,
    iniciada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluida_em TIMESTAMPTZ,
    status TEXT NOT NULL
);
CREATE TABLE similaridades (
    execucao_id BIGINT NOT NULL REFERENCES execucoes(id) ON DELETE CASCADE,
    pessoa_a BIGINT NOT NULL, pessoa_b BIGINT NOT NULL,
    metrica TEXT NOT NULL, valor REAL NOT NULL,
    n_votacoes_comuns INT NOT NULL CHECK (n_votacoes_comuns >= 20),
    PRIMARY KEY (execucao_id, pessoa_a, pessoa_b, metrica),
    CHECK (pessoa_a < pessoa_b)
);
"""


@pytest.fixture(scope="module")
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


@pytest.fixture(autouse=True)
def limpar(conexao):
    conexao.execute(
        "TRUNCATE similaridades, execucoes, votos, votacoes, pessoa_fonte_ids, pessoas "
        "RESTART IDENTITY CASCADE"
    )


# ═══════════════════════════════════════════════════════════════════
# 🔴 RF-09 — idempotência
# ═══════════════════════════════════════════════════════════════════


def test_pessoa_reingerida_nao_duplica(conexao):
    pessoas = [_pessoa("204528", "Ana Ribeiro")]

    persistencia.gravar_pessoas(conexao, pessoas)
    persistencia.gravar_pessoas(conexao, pessoas)
    persistencia.gravar_pessoas(conexao, pessoas)

    total = conexao.execute("SELECT count(*) FROM pessoas").fetchone()[0]
    assert total == 1


def test_pessoa_reingerida_com_nome_novo_atualiza(conexao):
    """A Câmara corrige nome retroativamente — o ETL tem de acompanhar."""
    persistencia.gravar_pessoas(conexao, [_pessoa("204528", "Ana Ribeiro")])
    persistencia.gravar_pessoas(conexao, [_pessoa("204528", "Ana Ribeiro Sobrinho")])

    nome = conexao.execute("SELECT nome_exibicao FROM pessoas").fetchone()[0]
    assert nome == "Ana Ribeiro Sobrinho"


def test_votacao_reingerida_nao_duplica(conexao):
    votacoes = [_votacao("2358548-89")]

    persistencia.gravar_votacoes(conexao, votacoes)
    persistencia.gravar_votacoes(conexao, votacoes)

    total = conexao.execute("SELECT count(*) FROM votacoes").fetchone()[0]
    assert total == 1


def test_voto_reingerido_nao_duplica(conexao):
    pessoa_id = _preparar_pessoa_e_votacao(conexao)
    votos = [_voto("2358548-89", pessoa_id, 1)]

    persistencia.gravar_votos(conexao, votos)
    persistencia.gravar_votos(conexao, votos)

    total = conexao.execute("SELECT count(*) FROM votos").fetchone()[0]
    assert total == 1


def test_voto_corrigido_pela_camara_e_atualizado(conexao):
    """⚠️ Sem o DO UPDATE, uma correção da Câmara seria ignorada em silêncio."""
    pessoa_id = _preparar_pessoa_e_votacao(conexao)

    persistencia.gravar_votos(conexao, [_voto("2358548-89", pessoa_id, 1)])
    persistencia.gravar_votos(conexao, [_voto("2358548-89", pessoa_id, -1)])

    valor = conexao.execute("SELECT valor FROM votos").fetchone()[0]
    assert valor == -1


def test_partido_no_voto_e_historico_e_acompanha_correcao(conexao):
    """⭐ 14 deputados trocaram de partido só em 2025 — o campo é registro do momento."""
    pessoa_id = _preparar_pessoa_e_votacao(conexao)

    persistencia.gravar_votos(conexao, [_voto("2358548-89", pessoa_id, 1, partido="PARTIDO-A")])
    persistencia.gravar_votos(conexao, [_voto("2358548-89", pessoa_id, 1, partido="PARTIDO-B")])

    partido = conexao.execute("SELECT partido_no_voto FROM votos").fetchone()[0]
    assert partido == "PARTIDO-B"


# ═══════════════════════════════════════════════════════════════════
# Execução e similaridade
# ═══════════════════════════════════════════════════════════════════


def test_execucao_abre_em_andamento_e_fecha_concluida(conexao):
    execucao_id = persistencia.abrir_execucao(conexao, "CAMARA", 57, 10, "v1")

    status = conexao.execute(
        "SELECT status FROM execucoes WHERE id = %s", (execucao_id,)
    ).fetchone()[0]
    assert status == "EM_ANDAMENTO"

    persistencia.fechar_execucao(conexao, execucao_id, sucesso=True)

    status, concluida = conexao.execute(
        "SELECT status, concluida_em FROM execucoes WHERE id = %s", (execucao_id,)
    ).fetchone()
    assert status == "CONCLUIDA"
    assert concluida is not None


def test_similaridade_abaixo_do_minimo_e_rejeitada_pelo_banco(conexao):
    """🔴 RN-02 no banco. O Python pode ter bug; o CHECK não deixa passar."""
    pessoa_id = _preparar_pessoa_e_votacao(conexao)
    outro = persistencia.gravar_pessoas(conexao, [_pessoa("204529", "Bruno Tavares")])
    ids = [r[0] for r in conexao.execute("SELECT id FROM pessoas ORDER BY id").fetchall()]
    execucao_id = persistencia.abrir_execucao(conexao, "CAMARA", 57, 10, "v1")

    par = ParSimilar(min(ids), max(ids), "CONCORDANCIA", 0.9, 19)

    with pytest.raises(psycopg.errors.CheckViolation):
        persistencia.gravar_similaridades(conexao, execucao_id, [par])


def test_duas_execucoes_convivem_sem_conflito(conexao):
    """⭐ Cada execução é um retrato independente — é o que dá reprodutibilidade."""
    _preparar_pessoa_e_votacao(conexao)
    persistencia.gravar_pessoas(conexao, [_pessoa("204529", "Bruno Tavares")])
    ids = [r[0] for r in conexao.execute("SELECT id FROM pessoas ORDER BY id").fetchall()]

    par = ParSimilar(min(ids), max(ids), "CONCORDANCIA", 0.9, 30)

    primeira = persistencia.abrir_execucao(conexao, "CAMARA", 57, 10, "v1")
    segunda = persistencia.abrir_execucao(conexao, "CAMARA", 57, 10, "v2")

    persistencia.gravar_similaridades(conexao, primeira, [par])
    persistencia.gravar_similaridades(conexao, segunda, [par])

    total = conexao.execute("SELECT count(*) FROM similaridades").fetchone()[0]
    assert total == 2


# ═══════════════════════════════════════════════════════════════════


def _pessoa(id_externo: str, nome: str) -> dict:
    return {
        "nome_civil": nome, "nome_exibicao": nome, "cpf_hash": None,
        "url_foto": None,
        "fonte": "CAMARA", "id_externo": id_externo,
        "metodo": "MANUAL", "confianca": 1.0,
    }


def _votacao(id_votacao: str) -> dict:
    return {
        "id": id_votacao, "casa": "CAMARA", "legislatura": 57,
        "data": "2025-12-09", "orgao": "PLEN", "descricao": "Aprovado o Projeto",
        "proposicao_id": None, "categoria": "SUBSTANTIVA",
        "secreta": False, "plenario": True, "votos_sim": 291, "votos_nao": 148,
    }


def _voto(votacao_id: str, pessoa_id: int, valor: int, partido: str = "PARTIDO-A") -> dict:
    return {
        "votacao_id": votacao_id, "pessoa_id": pessoa_id, "valor": valor,
        "partido_no_voto": partido, "uf_no_voto": "SP",
    }


def _preparar_pessoa_e_votacao(conexao) -> int:
    persistencia.gravar_pessoas(conexao, [_pessoa("204528", "Ana Ribeiro")])
    persistencia.gravar_votacoes(conexao, [_votacao("2358548-89")])

    return conexao.execute("SELECT id FROM pessoas LIMIT 1").fetchone()[0]
