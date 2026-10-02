"""RISCO: A tradução da connection string do Aspire.

ATENÇÃO: Este arquivo existe porque o ETL rodou pela primeira vez contra o banco de verdade e
morreu antes de abrir conexão: `invalid connection option "Host"`. Os 114 testes
anteriores não pegariam nada disso — recebiam a conexão pronta do Testcontainers, já em
formato libpq.
"""

import psycopg
import pytest

from poligraph_etl.conexao import normalizar

# DECISÃO: Copiada do que o Aspire realmente injeta, não inventada.
DO_ASPIRE = (
    "Host=localhost;Port=5432;Database=poligraph;Username=postgres;Password=segredo"
)


def como_dicionario(conexao: str) -> dict[str, str]:
    """ATENÇÃO: Conferido pelo parser do próprio psycopg, não por comparação de string.

    A ordem das opções não importa e não deve fazer teste falhar.
    """
    return psycopg.conninfo.conninfo_to_dict(conexao)


def test_traduz_o_formato_do_aspire():
    resultado = como_dicionario(normalizar(DO_ASPIRE))

    assert resultado["host"] == "localhost"
    assert resultado["port"] == "5432"
    # RISCO: os dois que mudam de nome — é onde o erro se esconde
    assert resultado["dbname"] == "poligraph"
    assert resultado["user"] == "postgres"
    assert resultado["password"] == "segredo"


def test_uri_passa_intacta():
    uri = "postgresql://usuario:senha@servidor:5432/poligraph"

    # DECISÃO: Em produção a variável pode vir em qualquer um dos três formatos. Converter o
    #    que já está certo só criaria chance de errar.
    assert normalizar(uri) == uri


def test_libpq_passa_intacta():
    libpq = "host=servidor port=5432 dbname=poligraph user=postgres"

    assert normalizar(libpq) == libpq


def test_descarta_o_que_so_existe_no_dotnet():
    resultado = como_dicionario(normalizar(DO_ASPIRE + ";Pooling=true;Maximum Pool Size=20"))

    # ATENÇÃO: `pooling` é detalhe do pool do .NET; repassá-lo ao libpq quebra a conexão.
    assert "pooling" not in resultado
    assert resultado["dbname"] == "poligraph"


def test_preserva_o_modo_de_ssl():
    resultado = como_dicionario(normalizar(DO_ASPIRE + ";SSL Mode=Require"))

    # RISCO: Descartar isto em silêncio faria a conexão ir em claro sem ninguém notar.
    assert resultado["sslmode"] == "Require"


@pytest.mark.parametrize("senha", ["com espaço", "com'aspa", "com\\barra"])
def test_senha_com_caractere_especial_sobrevive(senha: str):
    conexao = f"Host=h;Port=5432;Database=d;Username=u;Password={senha}"

    # ATENÇÃO: Sem citar, o parser do libpq corta a senha no primeiro espaço — e o erro que
    #    aparece é "autenticação falhou", que manda você procurar no lugar errado.
    assert como_dicionario(normalizar(conexao))["password"] == senha


def test_o_resultado_e_aceito_pelo_psycopg():
    # DECISÃO: O teste que importa: não é sobre o formato, é sobre o psycopg aceitar.
    #    Não conecta — só monta os parâmetros, que é onde estourava.
    psycopg.conninfo.make_conninfo(**como_dicionario(normalizar(DO_ASPIRE)))
