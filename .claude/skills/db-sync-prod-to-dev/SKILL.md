---
name: db-sync-prod-to-dev
description: Sync production database to dev LXC. Use when the user wants to pull prod data down to dev, refresh dev from prod, or reset dev to match production.
---

# Sync Production Database to Dev

## What this does

Replaces all dev LXC data with a copy of production. Dev schema is updated first (migrations applied), then all data is swapped. **Destructive to dev data only** — prod is read-only.

## Script

```bash
scripts/db-sync-prod-to-local.sh
```

## Prerequisites

- **Prod DB password** (`supabase_admin`) — in user's Bitwarden under "supabase crm". Ask the user to paste it in chat.
- **Dev LXC DB password** — stored in `.env.development.local` as `SUPABASE_DEV_PW`. Source this file before running.
- Docker must be running (the script uses dockerized `psql` and `pg_dump`).

## How to run

1. Ask the user for the prod password.
2. Source the dev password and pipe the prod password + confirmation non-interactively:

```bash
export $(grep SUPABASE_DEV_PW .env.development.local) && printf '<prod_pw>\ny\n' | bash scripts/db-sync-prod-to-local.sh
```

**Never tell the user to run the script themselves.** Always run it via Bash tool with the password piped in.

## What the script does (7 steps)

1. **Dump prod data** — `pg_dump --data-only` from `10.0.10.228:5433`, excluding Supabase internals
2. **Save a backup** — `migration/backups/prod_data_YYYY-MM-DD.sql`
3. **Apply pending migrations** — `npx supabase migration up` against dev LXC (schema only, no data reset)
4. **Disable `on_auth_user_created` trigger** — prevents duplicate `public.users` rows during load
5. **Truncate all dev tables + reset sequences** — clears dev data in FK-safe order
6. **Load prod dump** into dev
7. **Re-enable trigger + verify** — compares row counts and max `created_at` between prod and dev, checks for orphaned `user_id` references

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SUPABASE_DEV_PW` | (required) | Dev LXC database password |
| `DEV_MODE` | `lxc` | Set to `local` to target local Docker instead of LXC |
| `DEV_LXC_HOST` | `10.0.10.229` | Dev LXC IP |
| `DEV_LXC_PORT` | `54322` | Dev LXC Postgres port |

## Pre-sync check (optional)

Run `scripts/db-compare.sh` first to see current drift between prod and dev.

## Expected benign errors during load

- `duplicate key value violates unique constraint "audit_log_entries_pkey"` — pre-existing audit logs
- `duplicate key value violates unique constraint "buckets_pkey"` — storage bucket already exists from seed

## Post-sync

The script logs each sync to `migration/backups/sync.log`. Verify the final output shows matching row counts and "All user_id references are valid."

After the sync script completes successfully, run `db-compare.sh` and save the output as a `LAST_SYNC` file on the dev LXC. This provides a record of what data is currently on dev:

```bash
export $(grep SUPABASE_DEV_PW .env.development.local) && echo '<prod_pw>' | bash scripts/db-compare.sh 2>&1 | \
  ssh -i ~/.ssh/claude_code root@10.0.10.229 "cat > /home/f4rrest/Documents/clarklaw-domain/atomic-crm/LAST_SYNC"
```

Prepend a header with the sync timestamp:

```bash
ssh -i ~/.ssh/claude_code root@10.0.10.229 \
  "sed -i '1i# Synced from prod on $(date -u +%Y-%m-%dT%H:%M:%SZ)' /home/f4rrest/Documents/clarklaw-domain/atomic-crm/LAST_SYNC"
```

The `LAST_SYNC` file should be gitignored since it's instance-specific.
