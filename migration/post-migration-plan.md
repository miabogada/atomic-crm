# Post-Migration Issues & Plan (2026-03-10)

Identified after Day 1 of production use. Users worked in both the legacy
OutlookForms CRM and the new Atomic CRM simultaneously.

---

## Issue 1 — Task due dates are wrong

**Symptom:** Imported task due dates match the task *creation* date in Exchange,
not the actual due date visible in Outlook.

**Root cause:** The migration script used
`http://schemas.microsoft.com/exchange/tasks/duedate` which returns empty for
public folder items. The VBScript form uses `Item.DueDate` — the standard
Outlook MAPI property — which is stored as `PidLidTaskDueDate` (0x8105) in
the `PSETID_Task` property set.

**Solution (2026-03-12):** The correct WebDAV property URI is:
```
http://schemas.microsoft.com/mapi/id/{00062003-0000-0000-C000-000000000046}/0x00008105
```
Confirmed working via WebDAV SEARCH with SQL alias (the `{GUID}` namespace
breaks expat; use `AS "TaskDueDate"` alias). See `exchange-gotchas.md`.

`fetch_sample.py` has been updated to use this property. The `{GUID}` namespace
is handled by adding the property to the SEARCH SELECT with a SQL alias,
bypassing the expat parser issue.

**Steps taken:**
1. Re-run `fetch_sample.py --use-cache` to re-import tasks with correct due dates.
2. Apply a targeted UPDATE to prod DB to correct imported task due dates, OR
   re-run the full import and diff against existing data.
3. Verify a sample of tasks against Outlook to confirm due dates match.

**Issue 1 Status:** Done.

---

## Issue 2 — Payments not connected to their parent contract

**Symptom:** Many imported `account_payments` rows have `contract_id = NULL`.
The legacy system (`tblPaymentsReceived`) does not associate payments with
specific contracts, so they were all imported unlinked.

**Plan — with sub-tasks:**

### 2a. Audit unlinked payments
Query prod DB (after syncing to local):
```sql
SELECT
  a.name,
  a.account_number,
  COUNT(*) FILTER (WHERE ap.contract_id IS NULL) AS unlinked,
  COUNT(*) AS total
FROM account_payments ap
JOIN accounts a ON a.id = ap.account_id
WHERE ap.type = 'payment'
GROUP BY a.name, a.account_number
HAVING COUNT(*) FILTER (WHERE ap.contract_id IS NULL) > 0
ORDER BY a.account_number;
```

### 2b. Compare Exchange payment items vs imported records (Phase 3)
Create `migration/reconcile_exchange.py` to:
- Fetch `IPM.Post.Account payment` items from Exchange for each account
- Extract UserProperties: `curPayment`, `txtDatePayment`, `txtPmtMethod`, `txtCheckNumber`
- Compare count and total against `account_payments` in the DB
- Produce `migration/output/reconciliation_report.csv` and
  `migration/output/reconciliation_corrections.sql`

See `migration-workflow.md` Phase 3 for full spec.

### 2c. Auto-associate payments to contracts (Phase 2)
Create `migration/associate_payments.py` implementing the three rules from
`migration-workflow.md` Phase 2:
1. Single-contract accounts → assign all payments to that contract
2. Date-range matching for sequential multi-contract accounts
3. Amount matching against payment schedule for concurrent contracts

**Issue 2 Status:** Incomplete. I found example of payments appearing to be unlinked in UI:
http://localhost:5173/#/account_contracts/262/show
All 12 payments have contract_id = 262 in the database. The data is correct — all payments are attached to the contract. This might be a UI display issue.
You're right. Looking at the schedule dates:

  - Row 10: due 2025-12-15, payment #P7mQ was received 2025-12-15 — exact match
  - Row 11: due 2026-01-15, payment #LLg7 was received 2026-01-16 — off by 1 day

Both should have been linked. The association script missed them. This is a pre-existing bug in associate_payments.py, not caused by today's changes.

---

## Issue 3 — Activities disappear after creation; combine Tasks + Activities tabs

**Symptom:** When a new activity is created from the Task view (linked to a task
via `parent_type='tasks'`), it only appears in the Activities tab — not in the
Tasks tab where the user is. This looks like the activity disappeared.

**Root cause:** `AccountShow.tsx` has 5 separate tabs: Contacts, Contracts,
Tasks, Activities, Payments. Task-linked activities only appear in Activities.

**Plan:** Merge the Tasks and Activities tabs into a single "Tasks" tab:
- In `AccountTasksTab`, also fetch `account_activities` filtered by
  `parent_type='tasks'` for this account.
- Group activities by `parent_id` (task ID).
- Render each task row, then render its linked activities indented beneath it.
- Remove the standalone Activities tab.
- Standalone activities (no task parent) remain visible in the
  `AccountActivityLogWidget` already shown below the main card.

**No DB sync needed** — pure frontend change.
**Issue 3 Status:** Done.

---

## Issue 4 — Account roles all set to same user

**Symptom:** All imported accounts show Linnette as attorney, law clerk, AND legal assistant.

**Root cause:** Import script (`fetch_sample.py` line 739) uses a single admin user ID (`{uid}`) for all three role columns.

**Solution:** Update all accounts to use role-based defaults from the `users` table:
```sql
UPDATE accounts SET
  attorney_id        = (SELECT id FROM users WHERE role = 'attorney' LIMIT 1),
  law_clerk_id       = (SELECT id FROM users WHERE role = 'law_clerk' LIMIT 1),
  legal_assistant_id = (SELECT id FROM users WHERE role = 'legal_assistant' LIMIT 1)
WHERE deleted_at IS NULL;
```

**Script fix:** `fetch_sample.py` `transform_accounts()` now uses role-based user lookup
from `fetch_users_map()` instead of single admin ID. Done.

**Data correction:** Run the UPDATE as ad-hoc SQL on dev (after sync), then on prod (after approval).
Not a migration — this is a one-time correction of existing data, and the script fix
prevents the problem on future imports.

**Issue 4 Status:** Done. Script fix and data correction applied to dev and prod (2026-03-15).


---

## Issue 5 — Credit card payments classified as CHECK

**Symptom:** ~990 payments show as CHECK but have non-numeric reference numbers (credit card transaction IDs).

**Root cause:** Import defaulted empty `PaymentMethod` to "CHECK". Records with non-numeric `reference_number` are actually credit card payments.

**Solution:**
```sql
UPDATE account_payments
SET payment_method = 'CREDIT CARD'
WHERE payment_method = 'CHECK'
  AND reference_number IS NOT NULL
  AND reference_number !~ '^[0-9]+$'
  AND deleted_at IS NULL;
```

`CREDIT CARD` is already a valid value in `defaultPaymentMethods` config. Reference numbers preserved as-is.

User was suspicious of logic when reference_number has leading 0 char, but upon reviewing can see regex would correctly classify as check and leave untouched. 

**Script fix needed:** `fetch_sample.py` payment transform should detect non-numeric
`reference_number` and set `payment_method` to `CREDIT CARD` instead of defaulting to
`CHECK`. Not yet done.

**Data correction:** Run the UPDATE as ad-hoc SQL on dev (after sync), then on prod (after approval).
Not a migration — this is a one-time correction of existing data, and the script fix
prevents the problem on future imports.

**Issue 5 Status:** Done. Script fix and data correction applied to dev and prod (2026-03-15).
990 payments reclassified. Before/after CSVs in `migration/output/fix5_*.csv`.

---

## Issue 6 — Account opened date is NULL

**Symptom:** All 107 accounts have NULL `date_opened` in the right aside on accounts/show.

**Root cause:** Import script used `client.get("DateOpen")` but the Access field is `DateOpened` — and it's empty anyway. Access is incorrect source.

**Discovery:** The VBScript (`Account info.vbs` lines 561-565) shows account numbers encode the date opened: format `YYMMDDNN` where NN is a same-day sequence number. Example: `06090901` → opened 2006-09-09. This works for account numbers but may not be reliable for contract numbers, which is out of scope.

**Solution:**
```sql
UPDATE accounts
SET date_opened = make_date(
  2000 + CAST(substring(account_number, 1, 2) AS integer),
  CAST(substring(account_number, 3, 2) AS integer),
  CAST(substring(account_number, 5, 2) AS integer)
)
WHERE date_opened IS NULL
  AND deleted_at IS NULL
  AND length(account_number) >= 6;
```

**Script fixes:**
- `fetch_sample.py` `DateOpen` → `DateOpened` typo (lines 285, 727). Done.
- `fetch_sample.py` `transform_accounts()` should derive `date_opened` from account
  number prefix (`YYMMDD`) when the Access field is empty. Not yet done.

**Data correction:** Run the UPDATE as ad-hoc SQL on dev (after sync), then on prod (after approval).
Not a migration — this is a one-time correction of existing data, and the script fix
prevents the problem on future imports.

**Issue 6 Status:** Done. Script fixes and data correction applied to dev and prod (2026-03-15).
Note: account `220122801` has 9 digits (likely typo) but derivation happened to produce
the correct date `2022-01-22` from the first 6 chars.

---

## Workflow (Issues 4–6)

These are one-time data corrections, not schema changes. The SQL lives in this
plan document and is run as ad-hoc statements — not as Supabase migration files.
The migration files created earlier (`20260315002537` through `20260315002539`)
should be deleted. The import script (`fetch_sample.py`) is fixed so future
imports produce correct data without needing post-hoc corrections.

**Lesson learned:** Always capture before-state in a csv file (SELECT matching
the UPDATE's WHERE clause) before applying any data correction, so you have an
audit trail and can validate the change. Local dev lost this for Issue 5 because
rows that were already `CREDIT CARD` are now indistinguishable from reclassified ones.

### Phase A — Fix and validate the import script

Complete the remaining `fetch_sample.py` fixes before touching any data:

1. **Issue 5:** Add credit card detection — when `reference_number` is non-numeric,
   set `payment_method` to `CREDIT CARD` instead of defaulting to `CHECK`.
2. **Issue 6:** Add `date_opened` derivation from account number prefix (`YYMMDD`)
   when the Access `DateOpened` field is empty.
3. **Issue 4:** Already done (role-based user lookup in `transform_accounts()`).

**Validate:** Run `fetch_sample.py --use-cache` and inspect the generated SQL in
`migration/output/sample_import.sql` to confirm:
- Roles are assigned by role (attorney, law_clerk, legal_assistant), not all the same ID
- Credit card payments have `payment_method = 'CREDIT CARD'` with non-numeric refs
- `date_opened` is populated from account number prefix when Access field is empty

This validates the same logic that the ad-hoc UPDATE statements use, without
needing a database sync.

### Phase B — Delete migration files

Remove the three migration files from `supabase/migrations/`:
- `20260315002537_fix_account_roles.sql`
- `20260315002538_fix_credit_card_payments.sql`
- `20260315002539_fix_account_opened_dates.sql`

These must be removed before syncing, otherwise `db-sync-prod-to-local.sh`
will auto-apply them during `npx supabase migration up`.

### Phase C — Sync prod to dev

Run `scripts/db-sync-prod-to-local.sh`. This backs up prod (timestamped dump
to `migration/backups/`) and restores dev to match prod's current state.

### Phase D — Capture before-state, apply, and validate on dev

1. **Capture affected rows** — run SELECT queries matching each UPDATE's WHERE
   clause. Save to `migration/output/`:
   - `fix4_roles_before.csv` — accounts with current role assignments
   - `fix5_credit_card_before.csv` — CHECK payments with non-numeric reference_number,
     include account number, contract number, payment date, amount, payment type
     (original), and reference number
   - `fix6_date_opened_before.csv` — accounts with NULL date_opened

2. **Apply corrections** — run the three UPDATE statements as ad-hoc SQL on dev.

3. **Capture after-state and validate:**
   - Compare before/after CSVs
   - Review edge cases (e.g. leading-zero reference numbers for Issue 5)
   - Spot-check derived dates for Issue 6

### Phase E — Apply to prod

WAIT! Get user's approval of the results on dev before proceeding with any
production updates.
Run the same UPDATE statements directly on prod (SQL Editor / psql).

### Phase F — Verify on prod

Re-run the SELECT queries on prod and compare against the before CSVs from Phase D.

---

## Issue 7 — Schedule total doesn't match contract fee; misassigned payments

**Discovered:** 2026-03-15 during payment_allocations validation.

### 7a. Schedule total ≠ fee (~$400 gap on most contracts)

**Symptom:** After allocating all payments to schedule rows, many contracts show
unallocated payment dollars even though the client paid exactly the fee amount.
Example: account 105, contract 20120901A1 — fee=$4,500, total paid=$4,500, but
schedule total is only $4,200, leaving $300 unallocated.

**Scope:** Affects nearly every contract. Query found 20+ contracts with gaps,
almost all exactly $400.

**Root cause:** The `generate_payment_schedule()` function (migration
`20260222000001`) computes:

```
schedule_total = retainer + (num_payments - 1) × monthly_payment + final_payment
```

But the fee is calculated as:

```
fee = retainer + num_payments × monthly_payment
```

The schedule treats `final_payment` as a replacement for the last installment
(it's the last row's amount), but the contract has `num_payments` installments
total. The final_payment is typically less than monthly_payment (e.g. $200 vs
$400), creating a ~$400 shortfall.

**Example (20120901A1):**
- fee=4500, retainer=1000, monthly=300, num_payments=11, final=200
- Schedule: 1000 + 10×300 + 200 = 4200 (should be 4500)
- Missing: $300

**To investigate:**
1. Check the original Outlook VBScript formula for payment count — does
   `num_payments` include or exclude the final payment?
2. Check `fetch_sample.py` contract transform — are `num_payments` and
   `final_payment` imported correctly from Exchange/Access?
3. Fix `generate_payment_schedule()` or the import data, whichever is wrong.
4. After fixing, regenerate schedules and re-run `link_payment_schedule.py`.

### 7b. Three payments assigned to wrong contract (predate contract start)

**Symptom:** 3 payments have `date_received` before their assigned contract's
`date_retainer` / `date_first_payment`, suggesting `associate_payments.py`
assigned them to the wrong contract.

| Payment ID | Account | Assigned To | Paid | Contract Start | Days Early |
|------------|---------|-------------|------|----------------|------------|
| 1316 | 07022201 | 07022201A4 | 2007-11-16 | 2025-09-15 | 6,513 (~18 years) |
| 2635 | 16082701 | 16082701A2 | 2017-06-28 | 2019-01-16 | 567 (~1.5 years) |
| 2812 | 20072201 | 20072201A2 | 2024-07-23 | 2025-04-22 | 273 (~9 months) |

**Detection query:**
```sql
SELECT ap.id, a.account_number, ac.contract_number, ap.date_received, ap.amount,
  COALESCE(ac.date_retainer, ac.date_first_payment, ac.date_opened) AS contract_start,
  ap.date_received - COALESCE(ac.date_retainer, ac.date_first_payment, ac.date_opened) AS days_before
FROM account_payments ap
JOIN account_contracts ac ON ac.id = ap.contract_id
JOIN accounts a ON a.id = ap.account_id
WHERE ap.type = 'payment' AND ap.amount > 0 AND ap.deleted_at IS NULL AND ac.deleted_at IS NULL
  AND ap.date_received < COALESCE(ac.date_retainer, ac.date_first_payment, ac.date_opened)
ORDER BY days_before;
```

**Fix:** For each, identify the correct earlier contract on the same account and
UPDATE `contract_id`. Then deallocate + re-run `link_payment_schedule.py` for
those contracts.

**Issue 7 Status:** Fixed on dev (2026-03-15).

**7a fix:** `generate_payment_schedule()` now treats `final_payment` as an additional
row (payment_number = num_payments + 1) instead of replacing the last installment.
Formula: `fee = retainer + num_payments × monthly_payment + final_payment`.
All schedule totals now match contract fees (0 gaps).

**7b fix:** Reassigned 11 payments total:
- 3 payments predating their assigned contract's start date:
  - Payment 1316 → 07022201A1 (was A4)
  - Payment 2635 → 16082701A1 (was A2)
  - Payment 2812 → 20072201A1 (was A2)
- 8 cross-account misassignments (payment.account_id ≠ contract.account_id):
  - Payment 2804 → 20062301A2 (was on account 20072201)
  - Payment 2658 → 09040101A1 (was on account 06122701)
  - Payment 2668 → 06122701AB1 (was on account 07042104)
  - Payment 2641 → 16082701A2 (was on account 09040101)
  - Payment 2531 → 220122801A3 (was on account 20090802)
  - Payment 2839 → 22012601A1 (was on account 20072401)
  - Payment 2779 → 21072301A3 (was on account 20062301)
  - Payment 2693 → 23022801A1 (was on account 21030801)

**Additional fixes (same session):**
- 8 LMC CLOSE/REOPEN entries reclassified: 7 → write_off, 1 → discount
- 4 write-offs manually allocated to schedule rows (contracts 151, 169, 295, 223)
- 31 post-migration payments imported from Access (entered in legacy after Mar 1)
- Balance formula updated: `balance = fee - payments - write_offs - discounts`
- `link_payment_schedule.py` changed to full clear+rebuild (was incremental)
- `db-sync-prod-to-local.sh` now logs sync timestamp to `migration/backups/sync.log`

**Prod deployment plan:**
1. Apply `20260315175141_payment_allocations.sql` migration (includes fixed
   `generate_payment_schedule()`)
2. Reclassify 8 LMC CLOSE/REOPEN entries (ad-hoc SQL)
3. Reassign 11 misassigned payments (ad-hoc SQL)
4. Import 31 missing post-migration payments (from `migration/output/import_missing_payments.sql`)
5. Run `link_payment_schedule.py --apply` against prod
6. Allocate 4 write-offs to schedule rows (ad-hoc SQL)
7. Deploy frontend (balance formula + type filter)

**Rollback note:** The balance formula commit (ContractShow.tsx, ContractListContent.tsx)
bundles two changes in the same lines: (a) filter Received to `type === 'payment'`
and (b) subtract write-offs/discounts from balance. Rolling back removes both.
The pre-fix behavior summed all types as Received — inflated but not showing false
outstanding balances since write-offs also reduce the balance in that calculation.

---

## Order of execution

| # | Issue | Blocker | Notes |
|---|-------|---------|-------|
| 3 | Tab consolidation (UI) | None | ✅ Done |
| 2a | Audit unlinked payments | Prod→local sync | ✅ Done |
| 2b | Exchange reconciliation | Exchange access + sync | ✅ Done |
| 2c | Auto-associate payments | Sync + 2b review | ✅ Done (2026-03-15) |
| 1 | Task due dates | Exchange access | ✅ Done |
| 4 | Account roles fix | None | ✅ Done (2026-03-15) |
| 5 | Credit card payments fix | None | ✅ Done (2026-03-15) |
| 6 | Account opened date fix | None | ✅ Done (2026-03-15) |
| 7 | Schedule total ≠ fee + misassigned payments | None | ✅ Fixed on dev (2026-03-15), prod deploy pending |
