---
name: Import SQL lacks ON CONFLICT on child tables — delete order matters
description: fetch_sample.py only puts ON CONFLICT on accounts table; child tables will duplicate if re-imported. Delete order must respect FK constraints.
type: feedback
---

`migration/fetch_sample.py` generates `sample_import.sql` where only the `INSERT INTO accounts` statements have `ON CONFLICT (account_number) DO NOTHING`. All other tables (account_activities, tasks, account_payments, account_contracts, account_contacts) do NOT have conflict protection.

**Consequence:** If you re-run fetch_sample.py and re-apply the SQL for accounts that were already imported, the accounts row is skipped (ON CONFLICT) but all child rows are duplicated.

**How to handle re-imports safely:**
1. Delete existing data for those accounts BEFORE re-applying the SQL.
2. Delete order must respect FK constraints:
   - `contract_payment_schedule` (FK → account_contracts)
   - `account_activities`
   - `tasks`
   - `account_payments`
   - `account_contracts`
   - `account_contacts`
   - `accounts`

Deleting `account_contracts` before `contract_payment_schedule` will fail with:
`ERROR: update or delete on table "account_contracts" violates foreign key constraint "cps_contract_id_fkey" on table "contract_payment_schedule"`

**Why:** Learned the hard way — re-ran fetch_sample.py for 34 accounts when 3 were already imported. Had to clean up duplicates, and the first delete attempt failed on FK ordering.

**How to apply:** Whenever re-importing accounts that may already exist in the DB, always delete in the correct FK order first. Or better: verify the accounts don't exist before importing.
