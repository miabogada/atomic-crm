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

**Before running:**
- Verify the Access DB (`billing_be.mdb`) is current — check `stat` modification date. If stale, copy a fresh version from the Access server. Newer accounts won't appear in a stale copy.
- Verify target accounts don't already exist: `SELECT account_number FROM accounts WHERE account_number IN (...)`

**After running:**
- Review `migration/output/sample_import.sql`
- Apply to local: `docker exec -i supabase_db_atomic-crm-demo psql -U postgres < migration/output/sample_import.sql`
- Spot-check 2-3 accounts in the CRM UI (http://localhost:5173)

**Flags:**
- `--account <num> [<num>...]` — specific accounts (skips auto-selection)
- `--use-cache` — reuse cached Exchange/Access JSON (only re-fetches Supabase IDs). Use when re-generating SQL without re-fetching. Do NOT use after changing the Access DB or if Exchange data may have changed.

**Task due dates:** The script already uses the correct MAPI named property `PidLidTaskDueDate` (LID 0x8105, namespace `PSETID_Task`). No post-import fix needed — this was fixed in the script after the original 82-account import.

### Phase 2: Associate Payments to Contracts

```bash
# Dry run — generates CSVs + SQL, no DB changes
python3 migration/associate_payments.py

# Apply to local DB
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
# Dry run — generates SQL
python3 migration/link_payment_schedule.py

# Apply to local DB
python3 migration/link_payment_schedule.py --apply
```

**Validation:** Review `migration/output/link_payment_schedule.sql`

**Note:** Also idempotent — only links schedule rows with `payment_id IS NULL`.

### Phase 4: Production Deployment

**All three phases must be validated on local before applying to prod.**

1. **Backup prod:**
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
   - Compare row counts between local and prod
   - Small deltas in payments/tasks/activities are expected (user activity on prod between syncs)
   - Spot-check accounts in prod CRM UI

**Prod password:** Stored in user's Bitwarden under "supabase crm". Ask the user — do NOT guess or hardcode.

### Phase 5: Documentation

1. Update `CHANGELOG.md` with import summary, payment association results, and deployment details
2. Save to muninndb

## Gotchas

- **Stale Access DB:** The `billing_be.mdb` on this workstation is a copy. Check its modification date before importing — newer accounts won't exist in a stale copy. Ask the user to copy a fresh version if needed.
- **Exchange timeouts:** WebDAV fetches can time out for individual accounts. Re-run with `--account <failed_account>` to retry, then re-run all accounts together for the final SQL.
- **Prod drift:** If users enter data on prod between local validation and prod deployment, the prod apply will show slightly different counts. This is normal. Payments entered by users on prod with `contract_id = NULL` won't be linked by the SQL scripts (which were generated from local data). Re-run Phase 2 and 3 against prod to catch these.
- **Account number formats:** Most are 8 digits (YYMMDDRR), but some are 9 digits (e.g., `220122801`). Don't assume a length.
- **Exchange MAPI properties:** Task due dates use `PidLidTaskDueDate` in the `PSETID_Task` property set, NOT `exchange/tasks/duedate`. The `{GUID}` namespace breaks Python's expat parser — the script uses a SQL alias workaround. See `migration/exchange-gotchas.md`.

## Documentation

| File | Content |
|---|---|
| `migration/migration-workflow.md` | 3-phase plan overview |
| `migration/associate-payments-algorithm.md` | Capacity-aware algorithm details |
| `migration/remaining-accounts-migration-plan.md` | Plan for the Mar 14 batch of 25 accounts |
| `migration/exchange-gotchas.md` | Exchange WebDAV quirks |
| `migration/README.md` | General migration notes |
