---
name: migration
description: Migrating accounts from the legacy OutlookForms/Access CRM into Atomic CRM. Use when importing accounts, associating payments, linking payment schedules, or deploying migration SQL to production.
---

# Migration: OutlookForms/Access → Atomic CRM

## Overview

The legacy CRM uses Exchange 2003 public folders (WebDAV) + Access DB (`billing_be.mdb`). Migration is handled by Python scripts in `migration/`.

## Prerequisites

- `sudo apt-get install mdbtools`
- `pip install requests`
- Credentials in `migration/.env` (gitignored) — Exchange URL/user/pass, Supabase REST URL/service key, MDB path

## Key Scripts

| Script | Purpose |
|---|---|
| `migration/fetch_sample.py` | Phase 1: Extract accounts from Exchange+Access, generate SQL |
| `migration/associate_payments.py` | Phase 2: Link payments to contracts (capacity-aware algorithm) |
| `migration/link_payment_schedule.py` | Phase 3: Link payments to schedule rows |

## Full Migration Workflow

### Phase 1: Bulk Import

```bash
python3 migration/fetch_sample.py --account <account_numbers...>
```

**Where to run:** Run `fetch_sample.py` **locally on the workstation**, NOT on the dev LXC. The Access DB (`billing_be.mdb`) lives on the workstation at the path in `migration/.env` (`MDB_PATH`). The dev LXC does not have the legacy `outlookforms` repo — only the `atomic-crm` repo is mounted there. The script only generates a SQL file; it doesn't need Supabase running locally.

**Before running:**
- Sync prod → dev LXC first (see "Syncing Prod → Dev" below) so dev matches prod.
- Verify target accounts don't already exist: `SELECT account_number FROM accounts WHERE account_number IN (...)` (see "Re-import duplicates" in Gotchas)

**After running:**
- Review `migration/output/sample_import.sql`
- Apply to dev LXC:
  ```bash
  export $(grep SUPABASE_DEV_PW .env.development.local) && docker run --rm -i -e PGPASSWORD=$SUPABASE_DEV_PW postgres:15 psql \
    -h 10.0.10.229 -p 54322 -U postgres -d postgres < migration/output/sample_import.sql
  ```
- Spot-check 2-3 accounts in the dev CRM UI (http://10.0.10.229:5173)

**Flags:**
- `--account <num> [<num>...]` — specific accounts (skips auto-selection)
- `--use-cache` — reuse cached Exchange/Access JSON (only re-fetches Supabase IDs). Use when re-generating SQL without re-fetching. Do NOT use after refreshing the Access DB or if Exchange data may have changed.

**Task due dates:** The script already uses the correct MAPI named property `PidLidTaskDueDate` (LID 0x8105, namespace `PSETID_Task`). No post-import fix needed — this was fixed in the script after the original 82-account import.

### Phase 2: Associate Payments to Contracts

```bash
# Dry run — generates CSVs + SQL, no DB changes
python3 migration/associate_payments.py

# Apply to dev LXC (SUPABASE_REST_URL in migration/.env)
python3 migration/associate_payments.py --apply
```

**Validation (mandatory before applying):**
1. Review `migration/output/associate_payments_report.csv` — per-payment rule/reason assignments
2. Review `migration/output/associate_payments_contract_summary.csv` — check for overpaid contracts (balance < 0)
3. Confirm no exact-offset overpaid/underpaid pairs (which indicate mis-links)
4. Spot-check specific accounts in the payment report

**Note:** This script is idempotent — only touches payments with `contract_id IS NULL`. Safe to re-run after new payments are added.

### Phase 3: Link Payments to Payment Schedule

```bash
# Incremental (default) — only allocates payments not yet linked
python3 migration/link_payment_schedule.py                    # dry run
python3 migration/link_payment_schedule.py --apply            # apply

# Full rebuild — deletes ALL allocations and rebuilds from scratch
python3 migration/link_payment_schedule.py --full-rebuild             # dry run
python3 migration/link_payment_schedule.py --full-rebuild --apply     # apply
```

**Validation:** Review `migration/output/link_payment_schedule.sql`

**Note:** Default mode is incremental — fetches existing allocations and only inserts new ones. Use `--full-rebuild` only when you need a clean slate (e.g., after a full prod-to-dev sync). For prod, always use incremental (the default) to avoid disrupting existing allocations.

### Phase 4: Production Deployment

**All three phases must be validated on the dev LXC before applying to prod.**

1. **Backup prod:**
   - **Skip if a prod → dev sync already ran this session** — the sync already saved `migration/backups/prod_data_YYYY-MM-DD.sql`.
   - **Drift check instead of regenerating SQL:** compare `MAX(id)` + `COUNT(*)` on `account_payments`, `account_contracts`, and `contract_payment_schedule` between prod and dev. If prod still matches the pre-migration state (no one added data since the sync), the dev-generated SQL is safe to apply as-is. Only re-run the scripts against prod if sequences have diverged.
   - Otherwise, back up manually:
   ```bash
   docker run --rm -e PGPASSWORD=<PASSWORD> postgres:15 pg_dump \
     -h 10.0.10.228 -p 5433 -U supabase_admin -d postgres --data-only \
     > migration/backups/prod_data_YYYY-MM-DD.sql
   ```

2. **Apply SQL files to prod** (in order):
   ```bash
   docker run --rm -i -e PGPASSWORD=<PASSWORD> postgres:15 psql \
     -h 10.0.10.228 -p 5433 -U supabase_admin -d postgres \
     < migration/output/sample_import.sql

   # Repeat for associate_payments.sql and link_payment_schedule.sql
   ```

3. **Validate prod:**
   - Compare row counts between dev and prod (`scripts/db-compare.sh`)
   - Small deltas in payments/tasks/activities are expected (user activity on prod between syncs)
   - Spot-check accounts in prod CRM UI

**Prod password:** Stored in user's Bitwarden under "supabase crm". Ask the user to paste it in chat — do NOT try interactive scripts or suggest running in a separate terminal.

### Syncing Prod → Dev

Use the `db-sync-prod-to-dev` skill (`.claude/skills/db-sync-prod-to-dev/SKILL.md`). It has the working command, which needs both the prod password and `SUPABASE_DEV_PW` from `.env.development.local`. Don't duplicate the command here.

### Phase 5: Documentation

1. Update `CHANGELOG.md` with import summary, payment association results, and deployment details
2. Update `.claude/memory/` if anything non-obvious was learned (muninndb too, if connected)

## Gotchas

- **Access DB is frozen on purpose:** `billing_be.mdb` (last modified 2026-04-30) is a historical copy — billing has been fully in Atomic CRM since 2026-05-18. `fetch_sample.py` still reads it for older accounts' payment history, but don't refresh it unless the user asks (see "Updating the Access DB" below). Accounts or payments created after 2026-05-18 exist only in Atomic CRM, not in the `.mdb`.
- **Re-import duplicates:** `fetch_sample.py` puts `ON CONFLICT (account_number) DO NOTHING` only on `accounts`. Every child table duplicates if the SQL is re-applied for an account that already exists. Check first (Phase 1 "Before running"). If you must re-import, delete the account's existing rows first in FK-safe order: `contract_payment_schedule` → `account_activities` → `tasks` → `account_payments` → `account_contracts` → `account_contacts` → `accounts`.
- **Exchange timeouts:** WebDAV fetches can time out for individual accounts. Re-run with `--account <failed_account>` to retry, then re-run all accounts together for the final SQL.
- **Prod drift:** If users enter data on prod between dev validation and prod deployment, the prod apply will show slightly different counts. This is normal. Payments entered by users on prod with `contract_id = NULL` won't be linked by the SQL scripts (which were generated from dev data). To fix: sync prod → dev, re-run Phase 2 (`associate_payments.py`), then for Phase 3 do NOT re-run `link_payment_schedule.py` against all data — query just the affected payment IDs to see which ones need schedule linking, and apply targeted UPDATEs only.
- **Account number formats:** Most are 8 digits (YYMMDDRR), but some are 9 digits (e.g., `220122801`). Don't assume a length.
- **Exchange MAPI properties:** Task due dates use `PidLidTaskDueDate` in the `PSETID_Task` property set, NOT `exchange/tasks/duedate`. The `{GUID}` namespace breaks Python's expat parser — the script uses a SQL alias workaround. See `migration/exchange-gotchas.md`.

## Updating the Access DB (manual only — not part of normal migrations)

Only refresh if the user explicitly asks. Billing has been in Atomic CRM since 2026-05-18 (see `.claude/memory/project_access_db_retired.md`).

The Access backend database is on the `EXC1DC1` server (10.0.0.10) in an SMB share. To fetch a fresh copy:

```bash
# Pipe the SMB password (ask user for it — do NOT store it)
echo '<PASSWORD>' | smbclient //EXC1DC1/File_Server -U CLARKLAW/Administrator \
  --ip-address=10.0.0.10 \
  -c 'get "Access Data/Online/billing_be.mdb" /tmp/billing_be.mdb'

# Copy to the expected location
cp /tmp/billing_be.mdb /home/f4rrest/Documents/clarklaw-domain/outlookforms/accessdb/billing_be.mdb
```

**Important:**
- The SMB password is the domain admin password. Ask the user to provide it each time — do NOT store or hardcode it.
- `fetch_sample.py` reads the MDB path from `migration/.env` (`MDB_PATH`), which points to the outlookforms copy.
- After refreshing, re-run `fetch_sample.py` without `--use-cache` — the cache contains stale Access data.

## Documentation

| File | Content |
|---|---|
| `migration/migration-workflow.md` | 3-phase plan overview |
| `migration/associate-payments-algorithm.md` | Capacity-aware algorithm details |
| `migration/remaining-accounts-migration-plan.md` | Plan for the Mar 14 batch of 25 accounts |
| `migration/exchange-gotchas.md` | Exchange WebDAV quirks |
| `migration/README.md` | General migration notes |
