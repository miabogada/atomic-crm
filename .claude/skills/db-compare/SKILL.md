---
name: db-compare
description: Compare local dev database with production (703 VM) database. Use when the user wants to check if databases are in sync, compare row counts, or verify migration status between local and prod.
---

# Database Comparison: Local Dev vs Production (703 VM)

## Environment Details

- **Local dev DB**: Runs in Docker container `supabase_db_atomic-crm-demo`, accessible at `127.0.0.1:54322`
- **Prod DB (703 VM)**: Runs on `10.0.10.228:5433`, requires `PGSSLMODE=disable`
- **Prod Postgres password**: Stored in user's Bitwarden under "supabase crm". Ask the user for it if needed — do NOT guess or hardcode it.

## How to Query Each Database

### Local (via docker exec — no password needed)

```bash
docker exec supabase_db_atomic-crm-demo psql -U postgres -d postgres -c "YOUR SQL HERE"
```

### Prod (via dockerized psql client — password via env var)

```bash
docker run --rm -e PGPASSWORD=<PASSWORD> postgres:15 psql -h 10.0.10.228 -p 5433 -U postgres -d postgres -c "YOUR SQL HERE"
```

The `postgres:15` image is already pulled locally.

## Step 1: Compare Migrations (Schema Sync)

Run this to see if both environments have the same migrations applied:

```bash
PGSSLMODE=disable npx supabase migration list --db-url "postgresql://postgres:<PASSWORD>@10.0.10.228:5433/postgres"
```

The output shows Local vs Remote columns. If all rows have both versions filled in, schemas are in sync. Missing Remote versions mean prod is behind; run `npx supabase db push --db-url "postgresql://postgres:<PASSWORD>@10.0.10.228:5433/postgres"` to push.

## Step 2: Compare Data (Row Counts)

Use this query on both local and prod to compare row counts across all CRM tables:

```sql
SELECT 'accounts' as tbl, count(*) FROM accounts
UNION ALL SELECT 'account_contacts', count(*) FROM account_contacts
UNION ALL SELECT 'account_contracts', count(*) FROM account_contracts
UNION ALL SELECT 'account_payments', count(*) FROM account_payments
UNION ALL SELECT 'companies', count(*) FROM companies
UNION ALL SELECT 'contacts', count(*) FROM contacts
UNION ALL SELECT 'contact_types', count(*) FROM contact_types
UNION ALL SELECT 'contract_payment_schedule', count(*) FROM contract_payment_schedule
UNION ALL SELECT 'deals', count(*) FROM deals
UNION ALL SELECT 'contact_notes', count(*) FROM contact_notes
UNION ALL SELECT 'deal_notes', count(*) FROM deal_notes
UNION ALL SELECT 'tags', count(*) FROM tags
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'users', count(*) FROM users
ORDER BY tbl;
```

**Important**: If new tables are added via migrations, update this query to include them.

## Step 3: Present Results

Show a comparison table like:

| Table | Local | Prod (703) | Diff |
|---|---|---|---|
| accounts | X | Y | +N on prod / in sync |

## Syncing Data (if requested)

### Prod -> Local (make local match prod)

```bash
# Dump prod data
docker run --rm -e PGPASSWORD=<PASSWORD> postgres:15 pg_dump -h 10.0.10.228 -p 5433 -U postgres --data-only postgres > prod_data.sql

# Reset local and reload
npx supabase db reset   # WARNING: destroys all local data
docker exec -i supabase_db_atomic-crm-demo psql -U postgres -d postgres < prod_data.sql
```

### Local -> Prod (make prod match local)

This is destructive to production data. Always confirm with the user before proceeding.
