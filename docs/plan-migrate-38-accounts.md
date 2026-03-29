# Plan: Migrate 38 Additional Accounts from Exchange/Access

**Date:** 2026-03-28
**Status:** Steps 7-8 complete — QA pending (Step 9)

## Background

Users requested 38 accounts that were not included in the original 82-account bulk migration. After deduplication, account number corrections, and removing 2 accounts that already exist in the CRM, there are **34 unique accounts** to import.

## Account List

| # | Name | Account # | Notes |
|---|------|-----------|-------|
| 1 | Edgar Arreola | 24100102 | |
| ~~2~~ | ~~Maria De La Paz Rosa~~ | ~~22121601~~ | **skipped — already in CRM** |
| 3 | Lorena Rodriguez | 19092701 | |
| 4 | Salomon Cruz | 25092801 | |
| 5 | Julio Benitez & Kimberly Manriquez | 21072401 | |
| 6 | Eliobeth Prado | 13033001 | |
| 7 | Marco Gomez | 18110101 | |
| 8 | Gustavo Gonzalez | 21073102 | |
| 9 | Rosario Aguilar & Francisco Villalba Bautista | 21100101 | |
| 10 | Reina Lemus | 21032501 | |
| 11 | Feliciano Flores | 22102001 | |
| 12 | Wilfredo Carhuas | 21100102 | |
| 13 | Arcida Menjivar | 20082801 | duplicate removed |
| 14 | Jose Coreas | 19062001 | |
| 15 | Maria Silva | 22110801 | |
| 16 | Emanuel & Maria Zeferino | 21032702 | |
| 17 | Jesus Arredondo & Jessica Hernandez | 23042101 | |
| 18 | Bernie Xutuc Herrera & Jazmin | 21110301 | |
| 19 | Oscar Basico & Julianny Tavarez | 24032701 | |
| 20 | Graciela Hernandez | 20090301 | |
| 21 | Estela Sanchez | 25101401 | |
| 22 | Celerino Amaral | 22042501 | |
| 23 | Jose Rodriguez Calderon | 24101501 | |
| 24 | Jose Manuel Fernandez | 21050603 | |
| 25 | Josue Ortiz Delgado | 24041101 | |
| 26 | Guillermo Orellana | 23031601 | corrected from 2303601 |
| 27 | Jose Luis Enriquez | 21011101 | |
| 28 | Ismael Lizama | 21121401 | |
| 29 | Rosa Robles | 23060702 | duplicate removed |
| 30 | Quirino Perez | 23122601 | corrected from 232260 |
| 31 | Luis Sebastian Cano | 21072801 | corrected from 207280 |
| 32 | Brayand Nisthal | 23072901 | |
| ~~33~~ | ~~Katherine Molina Rivera~~ | ~~22021401~~ | **skipped — already in CRM** (corrected from 2202140) |
| 34 | Concepcion Flores | 16030501 | |
| 35 | Daniel Parada | 24121901 | |
| 36 | Lorena Mancia & Rigoberto Cedillo Paredes | 24022601 | |

### Corrections Applied

| Name | Original (malformed) | Corrected | Verified in Exchange |
|------|---------------------|-----------|---------------------|
| Guillermo Orellana | 2303601 (7 digits) | 23031601 | Yes — GUILLERMO ORELLANA |
| Quirino Perez | 232260 (6 digits) | 23122601 | Yes — QUIRINO PEREZ |
| Luis Sebastian Cano | 207280 (6 digits) | 21072801 | Yes — LUIS ROBERTO SEBASTIAN CANO |
| Katherine Molina Rivera | 2202140 (7 digits) | 22021401 | Yes — KATHERINE MOLINA RIVERA |

### Duplicates Removed

- Arcida Menjivar (20082801) — listed twice
- Rosa Robles (23060702) — listed twice

### Skipped — Already in CRM

- Maria De La Paz Rosa (22121601)
- Katherine Molina Rivera (22021401)

## Environment

- **Dev LXC:** `10.0.10.229` (crm-dev) — repo at `/home/f4rrest/Documents/clarklaw-domain/atomic-crm`
- **Prod LXC:** `10.0.10.228` (crm) — Supabase Docker stack
- **SSH to dev:** `ssh -i ~/.ssh/claude_code root@10.0.10.229`
- All `docker exec`, `scripts/`, and `migration/` commands run on the dev LXC (10.0.10.229)

## Execution Steps

### Step 1: Sync prod to dev

Ensure dev (10.0.10.229) is an exact copy of production before making any changes. Run on the dev LXC:

```bash
# On 10.0.10.229
bash scripts/db-sync-prod-to-local.sh
```

The sync script already verifies row counts at the end. Additionally, run the compare script to confirm they match:

```bash
# On 10.0.10.229
bash scripts/db-compare.sh
```

**Gate:** All table row counts must match between dev and prod before proceeding.

### Step 2: Record baseline counts

Before importing, capture row counts for all affected tables on dev. These will be used to calculate expected deltas after import.

```sql
-- Run on dev (10.0.10.229) via docker exec
SELECT 'accounts' as tbl, count(*) FROM accounts
UNION ALL SELECT 'account_contacts', count(*) FROM account_contacts
UNION ALL SELECT 'account_contracts', count(*) FROM account_contracts
UNION ALL SELECT 'account_payments', count(*) FROM account_payments
UNION ALL SELECT 'account_activities', count(*) FROM account_activities
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'contract_payment_schedule', count(*) FROM contract_payment_schedule
ORDER BY tbl;
```

Save this output as the **pre-import baseline**.

### Step 3: Generate import SQL

```bash
python3 migration/fetch_sample.py --account \
  24100102 19092701 25092801 21072401 13033001 18110101 21073102 \
  21100101 21032501 22102001 21100102 20082801 19062001 22110801 21032702 \
  23042101 21110301 24032701 20090301 25101401 22042501 24101501 21050603 \
  24041101 23031601 21011101 21121401 23060702 23122601 21072801 23072901 \
  16030501 24121901 24022601
```

This fetches from Access DB + Exchange WebDAV and generates `migration/output/sample_import.sql`.

Review the script's summary table for:
- Accounts with 0 Exchange items (may indicate bad account number)
- Duplicate contacts (check against existing accounts in prod)
- Payment counts that look reasonable

### Step 4: Import to dev

Run on the dev LXC (10.0.10.229):

```bash
docker exec -i supabase_db_atomic-crm-demo psql -U postgres -d postgres \
  < migration/output/sample_import.sql
```

### Step 5: Validate dev import

Run the same count query from Step 2 and compute deltas against the baseline.

Additionally, run a per-account breakdown to confirm every account got data:

```sql
-- Per-account item counts for the 36 imported accounts
SELECT a.account_number,
       (SELECT count(*) FROM account_contacts ac WHERE ac.account_id = a.id) AS contacts,
       (SELECT count(*) FROM account_contracts ac WHERE ac.account_id = a.id) AS contracts,
       (SELECT count(*) FROM account_payments ap WHERE ap.account_id = a.id) AS payments,
       (SELECT count(*) FROM account_activities aa WHERE aa.account_id = a.id) AS activities,
       (SELECT count(*) FROM tasks t WHERE t.account_id = a.id) AS tasks
FROM accounts a
WHERE a.account_number IN (
  '24100102','19092701','25092801','21072401','13033001','18110101','21073102',
  '21100101','21032501','22102001','21100102','20082801','19062001','22110801','21032702',
  '23042101','21110301','24032701','20090301','25101401','22042501','24101501','21050603',
  '24041101','23031601','21011101','21121401','23060702','23122601','21072801','23072901',
  '16030501','24121901','24022601'
)
ORDER BY a.account_number;
```

**Gate:** All 34 accounts must exist, and item counts should match the `fetch_sample.py` summary table (Contr/Pmts/Exch columns). Flag any account with 0 contacts or 0 activities for investigation.

### Step 6: Run post-import scripts on dev

Run on the dev LXC (10.0.10.229):

```bash
python3 migration/associate_payments.py
python3 migration/link_payment_schedule.py
```

Re-run the per-account breakdown from Step 5 to confirm payment schedule rows were added.

### Step 7: Deploy to prod

Apply the same import SQL to production:

```bash
PGSSLMODE=disable docker run --rm -e PGPASSWORD="<password>" postgres:15 \
  psql -h 10.0.10.228 -p 5433 -U supabase_admin -d postgres \
  < migration/output/sample_import.sql
```

Then run the post-import scripts against prod as well:

```bash
python3 migration/associate_payments.py   # (configured for prod)
python3 migration/link_payment_schedule.py
```

### Step 8: Validate prod matches dev

Run `db-compare.sh` on the dev LXC to confirm all row counts match between dev (10.0.10.229) and prod (10.0.10.228):

```bash
# On 10.0.10.229
bash scripts/db-compare.sh
```

Then run the same per-account breakdown query (Step 5) on prod and diff against the dev results:

```sql
-- Same query as Step 5, run on prod
-- Every account's contacts/contracts/payments/activities/tasks count
-- must match the dev numbers exactly.
```

**Gate:** All table-level and per-account counts must match between dev and prod. Any mismatch must be investigated before signing off.

### Step 9: QA

- Open prod CRM and spot-check 3-5 accounts in the UI
- Verify contacts, tasks, activities, contracts, and payments are visible
- Check balances against Exchange records for a couple accounts

## Progress Log

### Step 1: Sync prod to dev — DONE
Dev and prod row counts match exactly (109 accounts, 110 contacts, 180 contracts, 1661 payments, 17064 activities, 3814 tasks, 2553 schedules). All migrations aligned.

### Step 2: Record baseline — DONE
Baseline captured (see Step 1 counts).

### Step 3: Generate import SQL — DONE (re-run required)
- First run on dev LXC failed — Access DB not available on dev LXC (only `atomic-crm` repo is mounted, not `outlookforms`)
- **Fix:** Run `fetch_sample.py` locally on workstation where Access DB lives
- Refreshed Access DB from live server via SMB (`EXC1DC1/File_Server`) before running
- Pointed `SUPABASE_REST_URL` in `.env` at dev LXC (`http://10.0.10.229:54321`) so user_ids resolve correctly
- Re-ran with `--use-cache` after fixing Supabase URL (Exchange/Access data already cached from fresh fetch)
- Output: `migration/output/sample_import.sql` — 34 accounts, all with user_ids populated

### Step 4: Import to dev — DONE
All 34 accounts imported. Post-import counts: 143 accounts, 143 contacts, 239 contracts, 2116 payments, 22281 activities, 4938 tasks.

### Step 5: Validate dev import — DONE
All 34 accounts verified with per-account breakdown. Issues noted:
- **25092801 (Salomon Cruz):** Billing contact not found by Exchange search (data quirk — conversation topic may not be set). Contact data was present from Account Tracking folder. Phone number `(626) 341-4894` added manually via UPDATE.
- **25101401 (Estela Sanchez):** 0 contracts, 0 payments in both Access and Exchange. Only 24 Exchange items (activities/tasks). Flagged for attorney review — contract may not have been created yet.

### Step 6: Post-import scripts — BLOCKED
`associate_payments.py` dry run completed. 396 payments linked, 0 unresolved. However, **5 contracts from this batch show overpayment** (clients never overpay — these are algorithm mis-associations):

| Contract | Account | Fee | Linked | Over | Likely issue |
|----------|---------|-----|--------|------|-------------|
| 18110101A5 | GOMEZ, MARCO | $3,500 | $3,600 | $100 | **RESOLVED:** contract monthly is $250 not $240 (typo in Exchange). Payment 3075 ($100, 2025-09-25) → assign to A6. Also fix contract monthly_payment to 250. |
| 21072401A3 | BENITEZ, JULIO | $2,750 | $2,850 | $100 | **RESOLVED:** Payment 3026 ($350 LMC discount, 2025-01-20) → assign to A2 (matches A2's $350 monthly) |
| 21100101AB2 | VILLALBA BAUTISTA | $1,750 | $1,900 | $150 | **RESOLVED:** Contract date_opened wrong — should be 2023-07-14 not 2023-04-10. Payment 3101 ($350, 2023-04-19) predates contract by 3 months → assign to AB1. Fix date_opened too. |
| 23042101A2 | HERNANDEZ, JESSICA | $2,500 | $3,100 | $600 | **RESOLVED:** Payment 3232 ($2,200, ref "lack of cooperation on I131", LMC CLOSE) is a write-off, not a payment → set type='write_off' |
| 24121901A2 | PARADA, DANIEL | $750 | $1,050 | $300 | **RESOLVED:** Payment 3397 ($750, 2025-01-30) → assign to A1 (matches A1's $750 monthly) |

Detailed payment-by-payment data saved in `migration/output/overpaid_contracts_2026-03-28.csv`.

**All 5 overpayments resolved.** `associate_payments.py --apply` run, then manual corrections applied.
Corrections saved in `migration/output/overpayment_corrections_2026-03-28.sql` for prod replay.

Remaining balances after corrections:
- 18110101A6: -$100 (active contract, $100 applied so far)
- 24121901A1: -$450 (active contract, payments ongoing)
- All other corrected contracts: $0 balance

### Step 6b: link_payment_schedule.py — DONE
2374 allocations, 11 negative payments skipped, 15 payments with no remaining schedule row.

### Step 7: Deploy to prod — DONE
Applied to prod in order:
1. `sample_import.sql` — 34 accounts imported (applied before sync)
2. Synced prod→dev to realign auto-increment sequences (dev had +3 offset from 3 accounts imported then deleted during earlier troubleshooting)
3. Re-ran `associate_payments.py --apply` on dev (396 payments linked, 0 unresolved)
4. Applied `overpayment_corrections_2026-03-28.sql` on dev (16 corrections)
5. Applied Salomon Cruz phone fix on dev
6. Re-ran `link_payment_schedule.py --apply` on dev (2374 allocations)
7. Applied `associate_payments.sql`, `overpayment_corrections_2026-03-28.sql`, `link_payment_schedule.sql`, and phone fix to prod

### Step 8: Validate prod matches dev — DONE
`db-compare.sh` confirms all row counts match: 143 accounts, 144 contacts, 239 contracts, 2116 payments, 22281 activities, 4938 tasks, 3076 schedules. All 39 migrations aligned. Corrected contract balances verified identical on both environments.

### Step 9: QA — pending user spot-check

## Risks

- **Exchange server availability** — required for the fetch step; if down, use `--use-cache` after a successful fetch
- **Duplicate accounts** — 22121601 and 22021401 were already in the CRM and have been excluded. The prod sync in Step 1 ensures dev matches prod, so any remaining conflicts will be caught on dev first.
- **Account 25092801 (Salomon Cruz)** — date prefix `2509` suggests Sept 2025; verify this is a real account and not a typo
- **Prod changes between Steps 1-7** — if users modify data in prod between the sync and the prod import, row counts will diverge. Minimize the time between steps, or schedule during off-hours.
- **fetch_sample.py runs from dev LXC** — the dev LXC needs network access to the Exchange server (10.0.10.x network) and the Access DB file must be available at the configured `MDB_PATH`.
