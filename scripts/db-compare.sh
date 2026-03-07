#!/usr/bin/env bash
# Compare row counts between local dev and production databases.
set -euo pipefail

LOCAL_CONTAINER="supabase_db_atomic-crm-demo"
PROD_HOST="10.0.10.228"
PROD_PORT="5433"
PROD_USER="supabase_admin"

read -rsp "Prod DB password (supabase crm): " PROD_PW
echo

COUNT_SQL="
SELECT 'accounts' as tbl, count(*) FROM accounts
UNION ALL SELECT 'account_activities', count(*) FROM account_activities
UNION ALL SELECT 'account_contacts', count(*) FROM account_contacts
UNION ALL SELECT 'account_contracts', count(*) FROM account_contracts
UNION ALL SELECT 'account_payments', count(*) FROM account_payments
UNION ALL SELECT 'contact_types', count(*) FROM contact_types
UNION ALL SELECT 'contract_payment_schedule', count(*) FROM contract_payment_schedule
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'users', count(*) FROM users
ORDER BY tbl;
"

echo "=== Local ==="
docker exec "$LOCAL_CONTAINER" psql -U postgres -d postgres -c "$COUNT_SQL"

echo ""
echo "=== Prod (703) ==="
docker run --rm -e PGPASSWORD="$PROD_PW" postgres:15 \
  psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "$COUNT_SQL"

echo ""
echo "=== Migration status ==="
PGSSLMODE=disable npx supabase migration list \
  --db-url "postgresql://${PROD_USER}:${PROD_PW}@${PROD_HOST}:${PROD_PORT}/postgres"
