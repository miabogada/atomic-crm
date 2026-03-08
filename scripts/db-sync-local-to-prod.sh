#!/usr/bin/env bash
# Sync local dev database data to production (destructive to prod data).
#
# Same trigger-disable approach as db-sync-prod-to-local.sh — see that
# script's header comments for why the on_auth_user_created trigger
# must be disabled during load.
set -euo pipefail

LOCAL_CONTAINER="supabase_db_atomic-crm-demo"
PROD_HOST="10.0.10.228"
PROD_PORT="5433"
PROD_USER="supabase_admin"
DUMP_FILE="/tmp/local_data.sql"

read -rsp "Prod DB password (supabase crm): " PROD_PW
echo

echo "WARNING: This will DELETE all PRODUCTION data and replace it with local data."
read -rp "Type 'yes' to confirm: " confirm
[[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }

echo "Step 1/6: Dumping local data..."
docker exec -e PGPASSWORD=postgres "$LOCAL_CONTAINER" pg_dump \
  -U supabase_admin \
  --data-only --disable-triggers \
  --exclude-schema='extensions' \
  --exclude-schema='_analytics' \
  --exclude-schema='vault' \
  --exclude-schema='pgsodium' \
  --exclude-schema='_realtime' \
  --exclude-schema='realtime' \
  --exclude-schema='supabase_migrations' \
  --exclude-schema='supabase_functions' \
  --exclude-table='auth.schema_migrations' \
  --exclude-table='auth.flow_state' \
  --exclude-table='auth.refresh_tokens' \
  --exclude-table='auth.sessions' \
  --exclude-table='auth.mfa_*' \
  --exclude-table='auth.saml_*' \
  --exclude-table='auth.sso_*' \
  --exclude-table='auth.one_time_tokens' \
  --exclude-table='storage.s3_multipart*' \
  --exclude-table='storage.migrations' \
  postgres > "$DUMP_FILE"
echo "  Dumped to $DUMP_FILE ($(wc -l < "$DUMP_FILE") lines)"

echo "Step 2/6: Pushing any pending migrations to prod..."
PGSSLMODE=disable npx supabase db push --db-url "postgresql://$PROD_USER:$PROD_PW@$PROD_HOST:$PROD_PORT/postgres"

echo "Step 3/6: Disabling on_auth_user_created trigger on prod..."
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 psql \
  -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
"

echo "Step 4/6: Truncating prod data and resetting sequences..."
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 psql \
  -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "
TRUNCATE public.contract_payment_schedule CASCADE;
TRUNCATE public.account_payments CASCADE;
TRUNCATE public.account_contracts CASCADE;
TRUNCATE public.account_contacts CASCADE;
TRUNCATE public.account_activities CASCADE;
TRUNCATE public.tasks CASCADE;
TRUNCATE public.accounts CASCADE;
TRUNCATE public.users CASCADE;
TRUNCATE public.contact_types CASCADE;
TRUNCATE public.favicons_excluded_domains CASCADE;
DELETE FROM auth.identities;
DELETE FROM auth.users;
SELECT setval(c.oid, 1, false)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'S' AND n.nspname = 'public';
"

echo "Step 5/6: Loading local data into prod..."
docker run --rm -i -e PGPASSWORD="$PROD_PW" postgres:15 psql \
  -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres < "$DUMP_FILE"

echo "Step 6/6: Re-enabling trigger and verifying..."
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 psql \
  -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
"

COUNT_SQL="SELECT 'accounts' as tbl, count(*) FROM accounts UNION ALL SELECT 'users', count(*) FROM users UNION ALL SELECT 'tasks', count(*) FROM tasks ORDER BY tbl;"
echo "--- Local ---"
docker exec "$LOCAL_CONTAINER" psql -U postgres -d postgres -c "$COUNT_SQL"
echo "--- Prod ---"
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 \
  psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "$COUNT_SQL"

# Verify no orphaned user_id references
echo "Checking for user ID mismatches..."
ORPHAN_COUNT=$(docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 psql \
  -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -tAc "
SELECT count(*) FROM (
  SELECT user_id FROM tasks WHERE user_id NOT IN (SELECT id FROM users)
  UNION ALL SELECT user_id FROM accounts WHERE user_id NOT IN (SELECT id FROM users)
  UNION ALL SELECT user_id FROM account_activities WHERE user_id NOT IN (SELECT id FROM users)
) x;
")
if [ "$ORPHAN_COUNT" -gt 0 ]; then
  echo "ERROR: $ORPHAN_COUNT rows have user_id references to nonexistent users!"
  echo "This should not happen with trigger-disable approach. Investigate manually."
  exit 1
else
  echo "All user_id references are valid."
fi

echo ""
echo "Done. Production database is now a copy of local."
