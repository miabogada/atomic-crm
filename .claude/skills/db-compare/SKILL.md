---
name: db-compare
description: Compare local dev database with production (703 VM) database. Use when the user wants to check if databases are in sync, compare row counts, or verify migration status between local and prod.
---

# Database Comparison: Local Dev vs Production (703 VM)

## Environment Details

- **Dev DB (primary)**: Dev LXC at `10.0.10.229:54322`. Uses Supabase default credentials.
- **Dev DB (fallback)**: If the dev LXC is offline, set `DEV_MODE=local` to use a local Docker container `supabase_db_atomic-crm-demo` at `127.0.0.1:54322`. Also uses Supabase defaults.
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

**Dev LXC** (primary — requires `SUPABASE_DEV_PW` env var set to Supabase default db password):
```bash
docker run --rm -e PGPASSWORD="$SUPABASE_DEV_PW" postgres:15 psql -h 10.0.10.229 -p 54322 -U postgres -d postgres -c "YOUR SQL HERE"
```

**Local Docker** (fallback — no password needed):
```bash
docker exec supabase_db_atomic-crm-demo psql -U postgres -d postgres -c "YOUR SQL HERE"
```

**Prod** (via dockerized psql client — password via env var):
```bash
docker run --rm -e PGPASSWORD=<PASSWORD> postgres:15 psql -h 10.0.10.228 -p 5433 -U supabase_admin -d postgres -c "YOUR SQL HERE"
```

### Key Details

- Use `supabase_admin` (not `postgres`) for prod dump/load operations — it has ownership of auth.* and storage.* tables
- Dev databases use Supabase default credentials (set via `SUPABASE_DEV_PW` env var)
- Prod `supabase_admin` password is in Bitwarden under "supabase crm" — ask the user if needed, do NOT guess or hardcode
- `--disable-triggers` is required on pg_dump to avoid FK ordering issues during load
- Expected benign errors during load:
  - `duplicate key value violates unique constraint "audit_log_entries_pkey"` — pre-existing audit logs
  - `duplicate key value violates unique constraint "buckets_pkey"` — storage bucket already exists from seed

## User ID Mismatch — Root Cause and Fix

**Root cause:** The `on_auth_user_created` trigger on `auth.users` calls `handle_new_user()`, which auto-creates a row in `public.users` with an auto-increment ID. When loading a data dump that includes both `auth.users` and `public.users` with matching IDs, the trigger fires during the `auth.users` COPY and creates **duplicate** `public.users` rows with **wrong** IDs. All FK references in the dumped data still point to the original IDs, causing orphaned references.

**Fix (implemented in sync scripts):** The sync scripts now disable the trigger before loading and re-enable it after:

```sql
-- Before loading dump
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- ... load dump ...

-- After loading dump
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

The scripts also use `npx supabase migration up` (incremental) instead of `npx supabase db reset` (destructive), eliminating the seed-data ID collision.

**Detection (still runs automatically after sync):**

```sql
-- Should return 0 rows if everything is correct
SELECT 'tasks' as tbl, user_id FROM tasks WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL SELECT 'accounts', user_id FROM accounts WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL SELECT 'account_activities', user_id FROM account_activities WHERE user_id NOT IN (SELECT id FROM users);
```

If the detection still finds mismatches (should not happen with the trigger-disable approach), see git history for the manual remap procedure that was previously used.
