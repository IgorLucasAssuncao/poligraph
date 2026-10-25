"""RISCO: A tradução da connection string do Aspire.

ATENÇÃO: Este arquivo existe porque o ETL rodou pela primeira vez contra o banco de verdade e
morreu antes de abrir conexão: `invalid connection option "Host"`. Os 114 testes
anteriores não pegariam nada disso — recebiam a conexão pronta do Testcontainers, já em
formato libpq.
"""

import psycopg
import pytest

from poligraph_etl.nucleo.conexao import normalizar

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
    """RISCO: os dois que mudam de nome — é onde o erro se esconde
    """
    resultado = como_dicionario(normalizar(DO_ASPIRE))

    assert resultado["host"] == "localhost"
    assert resultado["port"] == "5432"
    assert resultado["dbname"] == "poligraph"
    assert resultado["user"] == "postgres"
    assert resultado["password"] == "segredo"


def test_uri_passa_intacta():
    """DECISÃO: Em produção a variável pode vir em qualquer um dos três formatos. Converter o
    que já está certo só criaria chance de errar.
    """
    uri = "postgresql://usuario:senha@servidor:5432/poligraph"

    assert normalizar(uri) == uri


def test_libpq_passa_intacta():
    libpq = "host=servidor port=5432 dbname=poligraph user=postgres"

    assert normalizar(libpq) == libpq


def test_descarta_o_que_so_existe_no_dotnet():
    """ATENÇÃO: `pooling` é detalhe do pool do .NET; repassá-lo ao libpq quebra a conexão.
    """
    resultado = como_dicionario(normalizar(DO_ASPIRE + ";Pooling=true;Maximum Pool Size=20"))

    assert "pooling" not in resultado
    assert resultado["dbname"] == "poligraph"


def test_preserva_o_modo_de_ssl():
    """RISCO: Descartar isto em silêncio faria a conexão ir em claro sem ninguém notar.
    """
    resultado = como_dicionario(normalizar(DO_ASPIRE + ";SSL Mode=Require"))

    assert resultado["sslmode"] == "require"


def test_traduz_o_modo_de_gss_da_producao():
    """A produção desliga o GSS, que a imagem do .NET não tem; o libpq recebe o modo em minúscula."""
    resultado = como_dicionario(normalizar(DO_ASPIRE + ";GSS Encryption Mode=Disable"))

    assert resultado["gssencmode"] == "disable"
    psycopg.conninfo.make_conninfo(**resultado)


@pytest.mark.parametrize("senha", ["com espaço", "com'aspa", "com\\barra"])
def test_senha_com_caractere_especial_sobrevive(senha: str):
    """ATENÇÃO: Sem citar, o parser do libpq corta a senha no primeiro espaço — e o erro que
    aparece é "autenticação falhou", que manda você procurar no lugar errado.
    """
    conexao = f"Host=h;Port=5432;Database=d;Username=u;Password={senha}"

    assert como_dicionario(normalizar(conexao))["password"] == senha


def test_o_resultado_e_aceito_pelo_psycopg():
    """DECISÃO: O teste que importa: não é sobre o formato, é sobre o psycopg aceitar.
    Não conecta — só monta os parâmetros, que é onde estourava.
    """
    psycopg.conninfo.make_conninfo(**como_dicionario(normalizar(DO_ASPIRE)))
