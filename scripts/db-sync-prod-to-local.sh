#!/usr/bin/env bash
# Sync production database data to local dev (destructive to local).
set -euo pipefail

LOCAL_CONTAINER="supabase_db_atomic-crm-demo"
PROD_HOST="10.0.10.228"
PROD_PORT="5433"
PROD_USER="supabase_admin"
DUMP_FILE="/tmp/prod_data.sql"

read -rsp "Prod DB password (supabase crm): " PROD_PW
echo

echo "This will RESET your local database and replace all data with production."
read -rp "Continue? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

echo "Step 1/5: Dumping prod data..."
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 pg_dump \
  -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" \
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

echo "Step 2/5: Resetting local database..."
npx supabase db reset

echo "Step 3/5: Clearing seeded data and resetting sequences..."
docker exec -e PGPASSWORD=postgres "$LOCAL_CONTAINER" psql -U supabase_admin -d postgres -c "
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
-- Reset sequences so dump's explicit IDs don't collide with seed-consumed values
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE accounts_id_seq RESTART WITH 1;
ALTER SEQUENCE account_contacts_id_seq RESTART WITH 1;
ALTER SEQUENCE account_contracts_id_seq RESTART WITH 1;
ALTER SEQUENCE account_activities_id_seq RESTART WITH 1;
ALTER SEQUENCE account_payments_id_seq RESTART WITH 1;
ALTER SEQUENCE contact_types_id_seq RESTART WITH 1;
ALTER SEQUENCE contract_payment_schedule_id_seq RESTART WITH 1;
"

echo "Step 4/5: Loading prod data into local (as supabase_admin to ensure triggers are disabled)..."
docker exec -i -e PGPASSWORD=postgres "$LOCAL_CONTAINER" \
  psql -U supabase_admin -d postgres < "$DUMP_FILE"

echo "Step 5/5: Verifying..."
COUNT_SQL="SELECT 'accounts' as tbl, count(*) FROM accounts UNION ALL SELECT 'users', count(*) FROM users UNION ALL SELECT 'tasks', count(*) FROM tasks ORDER BY tbl;"
echo "--- Local ---"
docker exec "$LOCAL_CONTAINER" psql -U postgres -d postgres -c "$COUNT_SQL"
echo "--- Prod ---"
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 \
  psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "$COUNT_SQL"

# Check for orphaned user_id references
echo "Checking for user ID mismatches..."
ORPHAN_COUNT=$(docker exec "$LOCAL_CONTAINER" psql -U postgres -d postgres -tAc "
SELECT count(*) FROM (
  SELECT user_id FROM tasks WHERE user_id NOT IN (SELECT id FROM users)
  UNION ALL SELECT user_id FROM accounts WHERE user_id NOT IN (SELECT id FROM users)
  UNION ALL SELECT user_id FROM account_activities WHERE user_id NOT IN (SELECT id FROM users)
) x;
")
if [ "$ORPHAN_COUNT" -gt 0 ]; then
  echo "WARNING: $ORPHAN_COUNT rows have user_id references to nonexistent users!"
  echo "Run the remap procedure in .claude/skills/db-compare/SKILL.md"
else
  echo "All user_id references are valid."
fi

echo ""
echo "Done. Local database is now a copy of production."
