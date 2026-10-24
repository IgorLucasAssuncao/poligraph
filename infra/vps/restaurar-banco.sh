#!/usr/bin/env bash
# Restaura no banco de produção um dump do banco local (Pendência 87).
#
# O dump sai de infra/vps/gerar-dump.ps1, que mostra os comandos prontos. Roda no VPS, como root,
# com o dump já enviado:
#   bash restaurar-banco.sh /tmp/poligraph.dump <sha256> [--substituir | --preservar-usuarios]
#
#   sem modo              só restaura em banco vazio, antes do primeiro deploy
#   --substituir          apaga tudo o que o banco tem, contas inclusive, e restaura
#   --preservar-usuarios  guarda as contas, os consentimentos, as inscrições, os avisos, as avaliações
#                         e quem cada conta segue; restaura; devolve tudo
#
# O container, o usuário e o banco saem do próprio container do Postgres do Coolify, sem senha
# no comando. O sha256 é conferido antes, o dump é apagado no fim, e o ANALYZE roda depois do
# restore: o dump não leva as estatísticas, e sem elas a consulta do grafo levou 173 s em vez de
# 0,4 (2026-10-24).
#
# DECISÃO (2026-10-24): quem a conta segue volta pelo id da pessoa na fonte (pessoa_fonte_ids),
#   não pelo id do banco: as fusões de deputado com senador mudam o id. Seguido que não se acha
#   pela fonte, nem pelo mesmo id, fica no schema guardado e o script diz quantos; nada some calado.
#
# ATENÇÃO: os cpf_hash vêm prontos no dump. A POLIGRAPH_CHAVE_CPF de produção tem de ser a mesma
#   do local, ou a ETL deixa de reconhecer os parlamentares já gravados.
#
# RISCO: com --substituir e --preservar-usuarios, a aplicação fica sem banco durante o restore.
#   Pare a aplicação no Coolify antes, ou ela responde erro nesses minutos.

set -euo pipefail

DUMP="${1:?informe o caminho do dump, por exemplo /tmp/poligraph.dump}"
SHA_ESPERADO="${2:?informe o sha256 que o gerar-dump.ps1 mostrou}"
MODO="${3:-}"

TABELAS_DE_USUARIO="usuarios consentimentos inscricoes_no_navegador avisos_enviados avaliacoes segue seguidos_encerrados"

# Para tudo com uma mensagem.
falhar() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

# Roda SQL no banco de produção, lido da entrada.
sql() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -q -U "$USUARIO" -d "$BANCO"; }

# Roda uma consulta e devolve só o valor. Sem -i: não consome a entrada que o read espera.
consulta() { docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -q -U "$USUARIO" -d "$BANCO" -tAc "$1"; }

case "$MODO" in
    ""|--substituir|--preservar-usuarios) ;;
    *) falhar "modo desconhecido: $MODO (use --substituir ou --preservar-usuarios)" ;;
esac

[ -f "$DUMP" ] || falhar "dump não encontrado: $DUMP"

echo "== Conferindo o sha256"
[ "$(sha256sum "$DUMP" | cut -d' ' -f1)" = "$SHA_ESPERADO" ] || falhar "o dump chegou diferente; envie de novo"
echo "igual"

echo "== Achando o banco do Coolify"
CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^postgres/ && $1 != "coolify-db" {print $1}' | head -1)
[ -n "$CONTAINER" ] || falhar "nenhum container Postgres de aplicação rodando (o coolify-db é do painel e fica de fora)"
USUARIO=$(docker exec "$CONTAINER" printenv POSTGRES_USER)
BANCO=$(docker exec "$CONTAINER" printenv POSTGRES_DB)
echo "container $CONTAINER, usuário $USUARIO, banco $BANCO"

TABELAS=$(consulta "select count(*) from information_schema.tables where table_schema = 'public'")
if [ -z "$MODO" ]; then
    [ "$TABELAS" -eq 0 ] || falhar "o banco já tem $TABELAS tabelas; use --substituir ou --preservar-usuarios"
elif [ "$TABELAS" -gt 0 ]; then
    echo "O banco tem $TABELAS tabelas, e tudo nelas vai ser apagado ($MODO)."
    consulta "select 'contas: ' || count(*) from usuarios" 2>/dev/null || true
    consulta "select 'seguindo: ' || count(*) from segue" 2>/dev/null || true
    read -r -p "Para seguir, digite o nome do banco ($BANCO): " CONFIRMACAO || true
    [ "${CONFIRMACAO:-}" = "$BANCO" ] || falhar "não confirmado; nada foi mudado"
fi

echo "== Copiando o dump para o container, antes de apagar qualquer coisa"
docker cp "$DUMP" "$CONTAINER:/tmp/restaurar.dump"

if [ "$MODO" = "--preservar-usuarios" ]; then
    echo "== Guardando as contas no schema guardado"
    {
        echo "set client_min_messages = warning; drop schema if exists guardado cascade; create schema guardado;"
        for TABELA in $TABELAS_DE_USUARIO; do
            echo "do \$\$ begin if to_regclass('public.$TABELA') is not null then"
            echo "  create table guardado.$TABELA as table public.$TABELA; end if; end \$\$;"
        done
        cat <<'SQL'
do $$ begin
    execute 'create table guardado.fontes as select f.pessoa_id, f.fonte, f.id_externo from public.pessoa_fonte_ids f'
         || ' where f.pessoa_id in (select pessoa_id from guardado.segue'
         || case when to_regclass('guardado.seguidos_encerrados') is not null
                 then ' union select pessoa_id from guardado.seguidos_encerrados' else '' end
         || ')';
end $$;
SQL
    } | sql
    consulta "select 'guardadas: ' || (select count(*) from guardado.usuarios) || ' contas, ' || (select count(*) from guardado.segue) || ' seguindo'"
fi

if [ -n "$MODO" ]; then
    echo "== Esvaziando o schema public"
    echo "set client_min_messages = warning; drop schema public cascade; create schema public authorization \"$USUARIO\";" | sql
fi

echo "== Restaurando"
docker exec "$CONTAINER" pg_restore --no-owner --no-acl -U "$USUARIO" -d "$BANCO" /tmp/restaurar.dump || true
docker exec "$CONTAINER" rm -f /tmp/restaurar.dump
rm -f "$DUMP"

if [ "$MODO" = "--preservar-usuarios" ]; then
    echo "== Devolvendo as contas"
    cat <<'SQL' | sql
create table guardado.novo_id as
select distinct on (g.pessoa_id) g.pessoa_id as antigo, n.pessoa_id as novo
from guardado.fontes g join public.pessoa_fonte_ids n using (fonte, id_externo)
order by g.pessoa_id, n.pessoa_id;

do $$
declare
    tabela text;
    colunas text;
begin
    foreach tabela in array array['usuarios', 'consentimentos', 'inscricoes_no_navegador', 'avisos_enviados',
                                  'avaliacoes', 'segue', 'seguidos_encerrados'] loop
        if to_regclass('guardado.' || tabela) is null then
            continue;
        end if;
        if tabela in ('segue', 'seguidos_encerrados') then
            execute format('update guardado.%I s set pessoa_id = m.novo from guardado.novo_id m where s.pessoa_id = m.antigo', tabela);
        end if;
        select string_agg(quote_ident(c.column_name), ', ') into colunas
        from information_schema.columns c
        where c.table_schema = 'guardado' and c.table_name = tabela
          and exists (select 1 from information_schema.columns p
                      where p.table_schema = 'public' and p.table_name = tabela and p.column_name = c.column_name);
        execute format('insert into public.%I (%s) select %s from guardado.%I g %s on conflict do nothing',
                       tabela, colunas, colunas, tabela,
                       case when tabela in ('segue', 'seguidos_encerrados')
                            then 'where exists (select 1 from public.pessoas p where p.id = g.pessoa_id)' else '' end);
    end loop;
end $$;

do $$
declare
    tabela text;
    maior bigint;
begin
    foreach tabela in array array['usuarios', 'consentimentos', 'inscricoes_no_navegador', 'avaliacoes'] loop
        execute format('select max(id) from public.%I', tabela) into maior;
        perform setval(pg_get_serial_sequence('public.' || tabela, 'id'), coalesce(maior, 0) + 1, false);
    end loop;
end $$;
SQL
    PERDIDOS=$(consulta "select count(*) from guardado.segue g where not exists (select 1 from public.segue s where s.usuario_id = g.usuario_id and s.pessoa_id = g.pessoa_id)")
    consulta "select 'devolvidas: ' || (select count(*) from public.usuarios) || ' contas, ' || (select count(*) from public.segue) || ' seguindo'"
    if [ "$PERDIDOS" -eq 0 ]; then
        echo "set client_min_messages = warning; drop schema guardado cascade;" | sql
    else
        echo "ATENÇÃO: $PERDIDOS seguidos não acharam a pessoa no banco novo. Ficaram em guardado.segue para conferir."
    fi
fi

echo "== Refazendo as estatísticas"
echo "analyze;" | sql

echo "== Conferindo"
consulta "select 'pessoas: ' || count(*) from pessoas union all select 'votos: ' || count(*) from votos union all select 'contas: ' || count(*) from usuarios"
echo "Os números de pessoas e votos têm de bater com os do banco local. O dump foi apagado; apague também a cópia do seu computador."
