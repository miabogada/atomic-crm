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

## Syncing Data: Prod -> Local

This replaces all local data with production data. Confirm with the user first.

### Step 1: Dump prod data

Exclude Supabase internals, realtime, and migration tracking. Include auth.users/identities (needed for FK constraints) and all public tables. Use `--disable-triggers` to avoid FK ordering issues during load.

```bash
docker run --rm -e PGPASSWORD=<PASSWORD> postgres:15 pg_dump \
  -h 10.0.10.228 -p 5433 -U postgres \
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
  postgres > /tmp/prod_data.sql
```

### Step 2: Reset local database

```bash
npx supabase db reset
```

This drops and recreates the local DB, re-runs all migrations, and seeds from `supabase/seed.sql`.

### Step 3: Clear seeded data that would conflict

The seed creates default rows in `users`, `contact_types`, `favicons_excluded_domains`, and `contract_payment_schedule`. These must be cleared before loading the prod dump.

```bash
docker exec supabase_db_atomic-crm-demo psql -U postgres -d postgres -c "
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
"
```

### Step 4: Load prod data

Must use `supabase_admin` role (not `postgres`) to have ownership of auth.* and storage.* tables. Password is `postgres`.

```bash
docker exec -i -e PGPASSWORD=postgres supabase_db_atomic-crm-demo \
  psql -U supabase_admin -d postgres < /tmp/prod_data.sql
```

**Expected benign errors** (safe to ignore):
- `duplicate key value violates unique constraint "audit_log_entries_pkey"` — pre-existing audit logs
- `duplicate key value violates unique constraint "buckets_pkey"` — storage bucket already exists from seed

### Step 5: Verify

Run the row count comparison query (Step 2 above) on both local and prod to confirm they match.

## Syncing Data: Local -> Prod

This is destructive to production data. Always confirm with the user before proceeding.
