---
name: db-compare
description: Compare local dev database with production (703 VM) database. Use when the user wants to check if databases are in sync, compare row counts, or verify migration status between local and prod.
---

# Database Comparison: Local Dev vs Production (703 VM)

## Environment Details

- **Local dev DB**: Runs in Docker container `supabase_db_atomic-crm-demo`, accessible at `127.0.0.1:54322`
- **Prod DB (703 VM)**: Runs on `10.0.10.228:5433`, requires `PGSSLMODE=disable`
- **Prod Postgres password**: Stored in user's Bitwarden under "supabase crm". Ask the user for it if needed — do NOT guess or hardcode it.

## Scripts

Three shell scripts in `scripts/` automate the most common database operations. All scripts prompt for the prod password at runtime (never hardcoded). Prefer using these scripts over running the commands manually.

| Script | Purpose | Destructive? |
|---|---|---|
| `scripts/db-compare.sh` | Compare row counts + migration status | No |
| `scripts/db-sync-prod-to-local.sh` | Replace local data with prod data | Local only |
| `scripts/db-sync-local-to-prod.sh` | Replace prod data with local data | **Prod** (requires typing "yes") |

### Usage

```bash
# Quick health check — are databases in sync?
./scripts/db-compare.sh

# Pull production data down to local dev
./scripts/db-sync-prod-to-local.sh

# Push local data up to production
./scripts/db-sync-local-to-prod.sh
```

### Pushing schema changes to prod

If `db-compare.sh` shows migrations missing on prod, push them:

```bash
PGSSLMODE=disable npx supabase db push --db-url "postgresql://supabase_admin:<PASSWORD>@10.0.10.228:5433/postgres"
```

## Manual Reference

The sections below document the underlying commands for reference, or for cases where the scripts need to be adapted.

### Querying Each Database

**Local** (via docker exec — no password needed):
```bash
docker exec supabase_db_atomic-crm-demo psql -U postgres -d postgres -c "YOUR SQL HERE"
```

**Prod** (via dockerized psql client — password via env var):
```bash
docker run --rm -e PGPASSWORD=<PASSWORD> postgres:15 psql -h 10.0.10.228 -p 5433 -U supabase_admin -d postgres -c "YOUR SQL HERE"
```

### Key Details

- Use `supabase_admin` (not `postgres`) for dump/load operations — it has ownership of auth.* and storage.* tables
- Local `supabase_admin` password is `postgres`
- Prod `supabase_admin` password is in Bitwarden under "supabase crm" — ask the user if needed, do NOT guess or hardcode
- `--disable-triggers` is required on pg_dump to avoid FK ordering issues during load
- Expected benign errors during load:
  - `duplicate key value violates unique constraint "audit_log_entries_pkey"` — pre-existing audit logs
  - `duplicate key value violates unique constraint "buckets_pkey"` — storage bucket already exists from seed

## Known Issue: User ID Mismatch After Sync

**Problem:** When syncing data between environments, the `users` table uses auto-increment IDs. If the target database is reset (`npx supabase db reset`) before loading, the seed runs first and creates users with IDs starting at 1. When the dump is then loaded, auth.users/identities are restored (which triggers user creation via the `on_auth_user_created` trigger), but the `users` table's auto-increment counter has advanced — so users get new IDs (e.g. 5–8 instead of 1–4). Meanwhile, all FK references in the data (tasks, accounts, account_contacts, account_contracts, account_activities, account_payments) still point to the old IDs.

**Symptoms:** Filters like "Assigned To" on tasks return no results. Activities don't display. Account team fields (attorney_id, law_clerk_id, legal_assistant_id) point to nonexistent users.

**Detection:** After a sync, verify that user_ids in data tables match actual user IDs:

```sql
-- Should return 0 rows if everything is correct
SELECT 'tasks' as tbl, user_id FROM tasks WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL SELECT 'accounts', user_id FROM accounts WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL SELECT 'account_activities', user_id FROM account_activities WHERE user_id NOT IN (SELECT id FROM users);
```

**Fix:** Remap old IDs to new IDs. Determine the mapping by comparing user emails, then run (as `supabase_admin`):

```sql
BEGIN;
SET session_replication_role = 'replica';  -- disable FK checks

-- Example mapping: old 1->8, 2->7, 3->5, 4->6
UPDATE tasks SET user_id = CASE user_id WHEN 1 THEN 8 WHEN 2 THEN 7 WHEN 3 THEN 5 WHEN 4 THEN 6 END WHERE user_id IN (1,2,3,4);
UPDATE accounts SET user_id = CASE user_id WHEN 1 THEN 8 WHEN 2 THEN 7 END WHERE user_id IN (1,2);
UPDATE accounts SET attorney_id = CASE attorney_id WHEN 1 THEN 8 WHEN 2 THEN 7 WHEN 3 THEN 5 WHEN 4 THEN 6 END WHERE attorney_id IN (1,2,3,4);
UPDATE accounts SET law_clerk_id = CASE law_clerk_id WHEN 1 THEN 8 WHEN 2 THEN 7 WHEN 3 THEN 5 WHEN 4 THEN 6 END WHERE law_clerk_id IN (1,2,3,4);
UPDATE accounts SET legal_assistant_id = CASE legal_assistant_id WHEN 1 THEN 8 WHEN 2 THEN 7 WHEN 3 THEN 5 WHEN 4 THEN 6 END WHERE legal_assistant_id IN (1,2,3,4);
UPDATE account_contacts SET user_id = CASE user_id WHEN 1 THEN 8 WHEN 2 THEN 7 END WHERE user_id IN (1,2);
UPDATE account_contracts SET user_id = CASE user_id WHEN 1 THEN 8 WHEN 2 THEN 7 END WHERE user_id IN (1,2);
UPDATE account_activities SET user_id = CASE user_id WHEN 1 THEN 8 WHEN 2 THEN 7 END WHERE user_id IN (1,2);
UPDATE account_payments SET user_id = CASE user_id WHEN 1 THEN 8 WHEN 2 THEN 7 END WHERE user_id IN (1,2);

SET session_replication_role = 'origin';

-- Also re-apply roles if they were lost
UPDATE users SET role = 'attorney' WHERE email = 'lmc@tanoclark.com';
UPDATE users SET role = 'law_clerk' WHERE email = 'clerk@tanoclark.com';
UPDATE users SET role = 'legal_assistant' WHERE email = 'assistant@tanoclark.com';

COMMIT;
```

**Note:** The exact ID mapping will vary. Always check `SELECT id, email FROM users ORDER BY id` on the target to determine the correct new IDs before running the remap.
