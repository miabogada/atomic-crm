#!/usr/bin/env bash
# Sync production database data to local dev (destructive to local data only).
#
# How it works:
#   1. Dump prod data (--data-only --disable-triggers)
#   2. Apply any pending migrations (schema only, no data reset)
#   3. Disable the on_auth_user_created trigger to prevent ID mismatch
#   4. Truncate all local data tables + reset sequences
#   5. Load the prod dump
#   6. Re-enable the trigger
#   7. Verify row counts and user ID integrity
#
# Why we disable the trigger:
#   The dump includes both auth.users and public.users with matching IDs.
#   If the on_auth_user_created trigger fires during auth.users COPY, it
#   creates DUPLICATE public.users rows with NEW auto-increment IDs,
#   breaking all FK references. Disabling the trigger lets the dump load
#   both tables with their original IDs intact.
set -euo pipefail

# Dev LXC (primary) — set DEV_MODE=local to fall back to local Docker container
DEV_MODE="${DEV_MODE:-lxc}"
DEV_LXC_HOST="${DEV_LXC_HOST:-10.0.10.229}"
DEV_LXC_PORT="${DEV_LXC_PORT:-54322}"
DEV_LXC_USER="${DEV_LXC_USER:-supabase_admin}"
DEV_LXC_PW="${SUPABASE_DEV_PW:-}"

# Local Docker fallback
LOCAL_CONTAINER="supabase_db_atomic-crm-demo"

PROD_HOST="10.0.10.228"
PROD_PORT="5433"
PROD_USER="supabase_admin"
DUMP_FILE="/tmp/prod_data.sql"
BACKUP_DIR="migration/backups"

read -rsp "Prod DB password (supabase crm): " PROD_PW
echo

if [ "$DEV_MODE" = "lxc" ]; then
  if [ -z "$DEV_LXC_PW" ]; then
    echo "Error: SUPABASE_DEV_PW env var required for LXC mode." >&2
    exit 1
  fi
  DEV_LABEL="Dev LXC ($DEV_LXC_HOST)"
else
  DEV_LABEL="Local Docker ($LOCAL_CONTAINER)"
fi

echo "This will replace all $DEV_LABEL data with production data."
read -rp "Continue? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

echo "Step 1/7: Dumping prod data..."
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

# Save a timestamped backup
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/prod_data_$(date +%Y-%m-%d).sql"
cp "$DUMP_FILE" "$BACKUP_FILE"
echo "  Backup saved to $BACKUP_FILE"

# Helper: run psql on the dev target (LXC or local Docker)
dev_psql() {
  if [ "$DEV_MODE" = "lxc" ]; then
    docker run --rm -i -e PGPASSWORD="$DEV_LXC_PW" postgres:15 \
      psql -h "$DEV_LXC_HOST" -p "$DEV_LXC_PORT" -U "$DEV_LXC_USER" -d postgres "$@"
  else
    docker exec -i -e PGPASSWORD=postgres "$LOCAL_CONTAINER" \
      psql -U supabase_admin -d postgres "$@"
  fi
}

echo "Step 2/7: Applying any pending migrations (schema only)..."
if [ "$DEV_MODE" = "lxc" ]; then
  PGSSLMODE=disable npx supabase migration up \
    --db-url "postgresql://${DEV_LXC_USER}:${DEV_LXC_PW}@${DEV_LXC_HOST}:${DEV_LXC_PORT}/postgres"
else
  npx supabase migration up
fi

echo "Step 3/7: Disabling on_auth_user_created trigger..."
dev_psql -c "
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
"

echo "Step 4/7: Truncating dev data and resetting sequences..."
dev_psql -c "
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

echo "Step 5/7: Loading prod data..."
dev_psql < "$DUMP_FILE"

echo "Step 6/7: Re-enabling on_auth_user_created trigger..."
dev_psql -c "
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
"

echo "Step 7/7: Verifying..."
COUNT_SQL="SELECT 'accounts' as tbl, count(*) FROM accounts UNION ALL SELECT 'account_contacts', count(*) FROM account_contacts UNION ALL SELECT 'account_contracts', count(*) FROM account_contracts UNION ALL SELECT 'account_payments', count(*) FROM account_payments UNION ALL SELECT 'account_activities', count(*) FROM account_activities UNION ALL SELECT 'tasks', count(*) FROM tasks UNION ALL SELECT 'users', count(*) FROM users ORDER BY tbl;"
echo "--- Row counts ---"
echo "--- Dev ($DEV_MODE) ---"
dev_psql -c "$COUNT_SQL"
echo "--- Prod ---"
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 \
  psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "$COUNT_SQL"

MAX_DATE_SQL="SELECT 'accounts' as tbl, max(created_at)::text as max_created FROM accounts UNION ALL SELECT 'account_activities', max(created_at)::text FROM account_activities UNION ALL SELECT 'account_contacts', max(created_at)::text FROM account_contacts UNION ALL SELECT 'account_contracts', max(created_at)::text FROM account_contracts UNION ALL SELECT 'account_payments', max(created_at)::text FROM account_payments UNION ALL SELECT 'payment_allocations', max(created_at)::text FROM payment_allocations ORDER BY 1;"
echo "--- Max created_at (dev) ---"
dev_psql -c "$MAX_DATE_SQL"
echo "--- Max created_at (prod) ---"
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 \
  psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "$MAX_DATE_SQL"

# Verify no orphaned user_id references
echo "Checking for user ID mismatches..."
ORPHAN_COUNT=$(dev_psql -tAc "
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

SYNC_LOG="$BACKUP_DIR/sync.log"
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') prod→local sync completed (backup: $BACKUP_FILE)" >> "$SYNC_LOG"

echo ""
echo "Done. $DEV_LABEL database is now a copy of production."
echo "Logged to $SYNC_LOG"
