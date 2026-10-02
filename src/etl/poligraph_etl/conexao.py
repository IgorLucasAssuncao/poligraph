"""Tradução da connection string do .NET para o que o psycopg entende.

RISCO: O Aspire injeta `ConnectionStrings__poligraph` no formato do Npgsql:

    Host=localhost;Port=5432;Database=poligraph;Username=postgres;Password=...

Não E o `psycopg` não fala esse dialeto. Ele espera o formato do libpq (`host=... dbname=...`)
ou uma URI `postgresql://`. Entregar o primeiro ao segundo dá
`ProgrammingError: invalid connection option "Host"` — o ETL nem chega a abrir conexão.

ATENÇÃO: Descoberto rodando o container contra o banco de verdade, depois de os nomes de
tabela já estarem certos. Nenhum teste pegaria: os testes recebiam a conexão pronta do
Testcontainers, que já vem em libpq.
"""

import logging

log = logging.getLogger("poligraph")

# ATENÇÃO: Só o que muda de nome. `port` e `password` são iguais nos dois lados.
EQUIVALENTES = {
    "host": "host",
    "port": "port",
    "database": "dbname",
    "username": "user",
    "user id": "user",
    "userid": "user",
    "password": "password",
    "ssl mode": "sslmode",
    "sslmode": "sslmode",
}

# ATENÇÃO: Existem só no ADO.NET — o libpq não tem equivalente e passá-las adiante quebraria
#    a conexão. Descartadas em silêncio de propósito: são detalhe do pool do .NET, não
#    dizem nada sobre COMO conectar.
SO_DO_DOTNET = {
    "pooling",
    "minimum pool size",
    "maximum pool size",
    "connection idle lifetime",
    "include error detail",
    "no reset on close",
}


def normalizar(conexao: str) -> str:
    """Devolve algo que o `psycopg.connect` aceita.

    DECISÃO: URI e libpq passam intactos: em produção a variável pode vir de qualquer um dos
    três formatos, e converter o que já está certo só criaria uma chance de errar.
    """
    texto = conexao.strip()

    if texto.startswith(("postgresql://", "postgres://")):
        return texto

    if not _parece_dotnet(texto):
        return texto

    partes = []
    for item in texto.split(";"):
        if not item.strip():
            continue

        chave, _, valor = item.partition("=")
        chave = chave.strip().lower()
        valor = valor.strip()

        if chave in SO_DO_DOTNET:
            continue

        equivalente = EQUIVALENTES.get(chave)
        if equivalente is None:
            # RISCO: Ruidoso de propósito. Descartar em silêncio uma opção desconhecida
            #    poderia derrubar `sslmode` — e aí a conexão passa a ir em claro sem
            #    ninguém notar.
            log.warning(
                "Opção de conexão sem equivalente no psycopg, ignorada: %r", chave
            )
            continue

        partes.append(f"{equivalente}={_escapar(valor)}")

    return " ".join(partes)


# ═══════════════════════════════════════════════════════════════════
# PRIVADOS — na ordem de uso
# ═══════════════════════════════════════════════════════════════════


def _parece_dotnet(texto: str) -> bool:
    """Distingue `Host=x;Port=y` de `host=x port=y`.

    ATENÇÃO: "Separa por espaço" não serve como regra: `Host=localhost` sozinho não tem
    separador nenhum. O que separa os dois dialetos de verdade é a CAIXA — o libpq só
    aceita chave minúscula, então maiúscula antes do primeiro `=` só pode ser .NET.
    """
    if ";" in texto:
        return True

    chave, sep, _ = texto.partition("=")
    return bool(sep) and chave != chave.lower()


def _escapar(valor: str) -> str:
    """ATENÇÃO: Senha com espaço ou aspa quebra o parser do libpq se não for citada."""
    if valor and not any(caractere in valor for caractere in " '\\"):
        return valor

    return "'" + valor.replace("\\", "\\\\").replace("'", "\\'") + "'"
