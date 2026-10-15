#!/usr/bin/env bash
# Restaura no banco de produção um dump do banco local (Pendência 87).
#
# Roda no VPS, como root, com o dump já enviado (scp poligraph.dump igor@<IP>:/tmp/):
#   bash restaurar-banco.sh /tmp/poligraph.dump <sha256 do dump>
#
# O container, o usuário e o banco saem do próprio container do Postgres do Coolify, sem senha
# no comando. O sha256 é conferido antes, se for passado, e o dump é apagado no fim.
#
# RISCO: restaurar sobre um banco que a migration já criou dá conflito de tabelas. Rode com o
#   banco vazio, antes do primeiro deploy da aplicação.
#
# ATENÇÃO: os cpf_hash vêm prontos no dump. A POLIGRAPH_CHAVE_CPF de produção tem de ser a mesma
#   do local, ou a ETL deixa de reconhecer os parlamentares já gravados.

set -euo pipefail

DUMP="${1:?informe o caminho do dump, por exemplo /tmp/poligraph.dump}"
SHA_ESPERADO="${2:-}"

# Para tudo com uma mensagem.
falhar() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

[ -f "$DUMP" ] || falhar "dump não encontrado: $DUMP"

if [ -n "$SHA_ESPERADO" ]; then
    echo "== Conferindo o sha256"
    [ "$(sha256sum "$DUMP" | cut -d' ' -f1)" = "$SHA_ESPERADO" ] || falhar "o dump chegou diferente; envie de novo"
    echo "igual"
fi

echo "== Achando o banco do Coolify"
CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^postgres/ && $1 != "coolify-db" {print $1}' | head -1)
[ -n "$CONTAINER" ] || falhar "nenhum container Postgres de aplicação rodando (o coolify-db é do painel e fica de fora)"
USUARIO=$(docker exec "$CONTAINER" printenv POSTGRES_USER)
BANCO=$(docker exec "$CONTAINER" printenv POSTGRES_DB)
echo "container $CONTAINER, usuário $USUARIO, banco $BANCO"

TABELAS=$(docker exec "$CONTAINER" psql -U "$USUARIO" -d "$BANCO" -tAc "select count(*) from information_schema.tables where table_schema = 'public'")
[ "$TABELAS" -eq 0 ] || falhar "o banco já tem $TABELAS tabelas; restaure só com ele vazio"

echo "== Restaurando"
docker cp "$DUMP" "$CONTAINER:/tmp/restaurar.dump"
docker exec "$CONTAINER" pg_restore --no-owner --no-acl -U "$USUARIO" -d "$BANCO" /tmp/restaurar.dump || true
docker exec "$CONTAINER" rm -f /tmp/restaurar.dump
rm -f "$DUMP"

echo "== Conferindo"
docker exec "$CONTAINER" psql -U "$USUARIO" -d "$BANCO" -tAc \
    "select 'parlamentares: ' || count(*) from pessoas union all select 'votos: ' || count(*) from votos"
echo "Os números têm de bater com os do banco local. O dump foi apagado; apague também a cópia do seu computador."
