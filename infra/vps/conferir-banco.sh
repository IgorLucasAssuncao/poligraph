#!/usr/bin/env bash
# Confere o banco de produção e refaz as estatísticas do planejador.
#
# Roda no VPS, como root:
#   bash conferir-banco.sh             ANALYZE, migration, restrições, contagens e o conferir da ETL
#   bash conferir-banco.sh --indices   o mesmo, e procura corrupção nos índices (amcheck, alguns minutos)
#
# Só lê, fora o ANALYZE e a extensão amcheck, que o --indices cria se faltar. As contagens são
# para comparar com as do banco local; o conferir da ETL é o mesmo do fim da rotina: ERRO quer
# dizer que um total não fecha com a fonte.

set -euo pipefail

INDICES="${1:-}"

# Para tudo com uma mensagem.
falhar() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

# Roda uma consulta no banco de produção.
consulta() { docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -q -U "$USUARIO" -d "$BANCO" "$@"; }

case "$INDICES" in
    ""|--indices) ;;
    *) falhar "opção desconhecida: $INDICES (use --indices ou nada)" ;;
esac

echo "== Achando o banco do Coolify"
CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^postgres/ && $1 != "coolify-db" {print $1}' | head -1)
[ -n "$CONTAINER" ] || falhar "nenhum container Postgres de aplicação rodando (o coolify-db é do painel e fica de fora)"
USUARIO=$(docker exec "$CONTAINER" printenv POSTGRES_USER)
BANCO=$(docker exec "$CONTAINER" printenv POSTGRES_DB)
echo "container $CONTAINER, usuário $USUARIO, banco $BANCO"

echo "== Refazendo as estatísticas (ANALYZE)"
INICIO=$(date +%s)
consulta -c "analyze;"
echo "feito em $(( $(date +%s) - INICIO )) s"

echo "== Última migration aplicada"
consulta -tAc "select migration_id from \"__EFMigrationsHistory\" order by migration_id desc limit 1"

echo "== Restrições que o banco ainda não validou (tem de vir vazio)"
consulta -tAc "select conrelid::regclass || ': ' || conname from pg_constraint where not convalidated and connamespace = 'public'::regnamespace"

echo "== Tabelas sem estatística depois do ANALYZE (tem de vir vazio)"
consulta -tAc "select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.reltuples < 0"

echo "== Contagens, para comparar com o banco local"
consulta -c "
select * from (
select 'pessoas' tabela, count(*) linhas from pessoas
union all select 'mandatos', count(*) from mandatos
union all select 'votacoes', count(*) from votacoes
union all select 'votos', count(*) from votos
union all select 'similaridades', count(*) from similaridades
union all select 'arestas_grafo', count(*) from arestas_grafo
union all select 'despesas', count(*) from despesas
union all select 'emendas', count(*) from emendas
union all select 'emendas_favorecidos', count(*) from emendas_favorecidos
union all select 'receitas_de_campanha', count(*) from receitas_de_campanha
union all select 'patrimonios', count(*) from patrimonios
union all select 'municipios', count(*) from municipios
union all select 'contas_dos_municipios', count(*) from contas_dos_municipios
union all select 'divida_federal', count(*) from divida_federal
union all select 'selic_por_ano', count(*) from selic_por_ano
union all select 'reconciliacoes', count(*) from reconciliacoes
union all select 'usuarios', count(*) from usuarios
union all select 'segue', count(*) from segue
) contagens order by tabela"

if [ "$INDICES" = "--indices" ]; then
    echo "== Procurando corrupção nos índices (amcheck)"
    consulta -c "create extension if not exists amcheck;"
    consulta -tAc "
select count(*) || ' índices conferidos' from (
    select bt_index_check(c.oid, false)
    from pg_index i join pg_class c on c.oid = i.indexrelid join pg_am a on a.oid = c.relam
    where a.amname = 'btree' and c.relnamespace = 'public'::regnamespace and c.relpersistence <> 't'
) feitos"
fi

echo "== O conferir da ETL"
ETL=$(docker ps --format '{{.Names}}' | grep '^etl-' | head -1 || true)
if [ -z "$ETL" ]; then
    echo "ATENÇÃO: o container da ETL não está rodando; o conferir ficou de fora."
else
    docker exec "$ETL" python -m poligraph_etl conferir
fi

echo "== Pronto"
