# Changelog

## 2026-03-29 — Data: Import 34 additional accounts from Exchange/Access

Imported 34 accounts requested by users that were not included in the original
82-account bulk migration. Original list had 38 entries; after deduplication
(Arcida Menjivar, Rosa Robles listed twice) and removing 2 already in the CRM
(Maria De La Paz Rosa 22121601, Katherine Molina Rivera 22021401), 34 unique
accounts were imported.

**Import summary:**
- 34 accounts, 34 contacts, 59 contracts, 455 payments, 5217 activities, 1124 tasks, 523 schedule rows
- 396 payments linked to contracts via `associate_payments.py`
- 2374 payment-to-schedule allocations via `link_payment_schedule.py`

**Manual corrections (5 overpaid contracts resolved):**
- 18110101 (Gomez, Marco): Contract A5 monthly_payment fixed $240→$250 (typo in Exchange); $100 payment moved from A5 to A6
- 21072401 (Benitez, Julio): $350 LMC discount moved from A3 to A2; $250 payment moved from A2 to A3
- 21100101 (Villalba Bautista): Contract AB2 date_opened fixed to 2023-07-14; payments reassigned between AB1 and AB2 based on contract dates
- 23042101 (Hernandez, Jessica): $2,200 LMC CLOSE payment reclassified as write_off (ref: "lack of cooperation on I131")
- 24121901 (Parada, Daniel): $750 payment moved from A2 to A1; three $150 payments moved from A1 to A2

**Other fixes:**
- 25092801 (Cruz, Salomon): Billing contact phone added manually — `(626) 341-4894`

**Flagged for review:**
- 25101401 (Sanchez, Estela): 0 contracts, 0 payments in Access/Exchange. Flagged for attorney review.

**Corrections SQL:** `migration/output/overpayment_corrections_2026-03-28.sql`
**Plan:** `docs/plan-migrate-38-accounts.md`

## 2026-03-26 — Infrastructure: Dev environment migrated to Proxmox LXC

Dev environment moved from the workstation to a dedicated Proxmox LXC container
(`crm-dev`, 10.0.10.229) using an sshfs hybrid setup. Claude Code and the editor
run on the workstation; all files, runtime, Docker, and Supabase live on the LXC.

**What changed:**
- LXC provisioned (4 cores, 8GB RAM, 30GB disk) cloned from container 301
- Repo, node_modules, and Supabase all run on the LXC
- Workstation mounts the LXC project dir via sshfs — file edits go directly to LXC
- Vite serves on `0.0.0.0` so the workstation browser can access the app
- `.env.development` updated: `VITE_SUPABASE_URL` points to `10.0.10.229:54321`
- Prod data synced to dev via `scripts/db-sync-prod-to-local.sh`

**Why:** Isolates the workstation from supply chain attacks via npm/pip packages.
All untrusted code execution happens inside the LXC.

**Plan:** `docs/dev-lxc-migration.md`

## 2026-03-24 — Data fix: Contract 25020401A1 schedule correction ($400→$300/mo)

Contract 25020401A1 was originally created with $400/mo payments in the legacy
Access/Exchange CRM. The correct amount is $300/mo. The $400 schedule caused
confusing split allocations (e.g., a $300 payment split across two $400 rows).

**Changes applied (dev + prod):**
- Updated contract terms: monthly_payment $400→$300, num_payments 17→23, final_payment $200→$100
- Deleted old 19-row schedule ($400/mo) and all split allocations
- Regenerated 25-row schedule: retainer ($1,000) + 23×$300 + final ($100) = $8,000
- Re-allocated 12 existing payments ($4,300 total) with clean 1:1 mappings

**Result:** $4,300 paid (rows 0–11 fully paid), $3,700 remaining (rows 12–24)

## 2026-03-24 — Data fix: Import 3 missing February 2026 payments

Three additional payments from late February were entered in the legacy system
after the previous sync and never imported.

**Payments imported:**

| Account | Name | Date | Amount | Contract |
|---------|------|------|--------|----------|
| 25071501 | Garcia, Jenny | 2026-02-18 | $400.00 | 25071501A1 |
| 24100801 | Cortez Valle, Jovanna | 2026-02-24 | $300.00 | 24100801A1 |
| 22021601 | De La Pena, Oscar Sanchez | 2026-02-23 | $400.00 | 22021601A3 |

All classified as CREDIT CARD (non-numeric reference numbers). Each payment
allocated to its corresponding schedule row.

**SQL:** `migration/output/import_mar_missing_payments.sql`

## 2026-03-24 — Feature: PDF invoice generation (Phase 1 — CLI batch)

Batch PDF invoice generator using `@react-pdf/renderer`. Replicates the legacy
invoice layout: tear-off payment stub, contract summary, interleaved account
history (payments due + received), and account balance.

**Usage:**
```
npx tsx scripts/generate-invoices.ts [--account <number>] [--output <dir>]
```

**Files:**
- `src/components/atomic-crm/invoices/` — types, styles, InvoiceDocument component, fetchInvoiceData query
- `scripts/generate-invoices.ts` — CLI batch script
- `docs/plan-pdf-invoices.md` — design plan

**Phase 2 (CRM UI button):** not yet implemented.

## 2026-03-22 — Data fix: Import 7 missing February 2026 payments

Users reported 7 payments from mid-February 2026 missing from the CRM. These
were entered in the legacy system (Access/Exchange) after the last migration
batch and never imported.

**Payments imported:**

| Account | Name | Date | Amount |
|---------|------|------|--------|
| 24091001 | MEDINA, EDGAR | 2026-02-16 | $350.00 |
| 25090501 | MARTINEZ, CALIXTO | 2026-02-16 | $500.00 |
| 25091101 | SERNA, JORGE | 2026-02-16 | $400.00 |
| 07022201 | CRUZ, SANTOS | 2026-02-16 | $400.00 |
| 15030101 | LOPEZ, EDGAR & ANA SORIANO | 2026-02-16 | $400.00 |
| 14041501 | AVILA, ANA | 2026-02-18 | $150.00 |
| 24031501 | OLIVERA, EDUARDA & FELIPE ZUNIGA | 2026-02-18 | $500.00 |

All reclassified as CREDIT CARD (non-numeric reference numbers per existing
import logic). Linked to active contracts, allocated to schedule rows.

**SQL:** `migration/output/import_feb_payments.sql`
**Plan:** `docs/plan-import-missing-feb-payments.md`
**Comparison tool:** `migration/compare_payments.py` (cross-references Access DB,
Exchange WebDAV, and CRM for a set of accounts)

## 2026-03-15 — Schema: Payment allocations (many-to-many)

Replaced the 1:1 `payment_id` FK on `contract_payment_schedule` with a
many-to-many `payment_allocations` junction table. This supports:
- **Partial payments** — $300 on a $400 schedule row shows "partial" status
- **Lump sums** — one payment allocated across multiple schedule rows
- **Split payments** — multiple payments on one schedule row, shown as sub-rows

**Migration:** `20260315175141_payment_allocations.sql`
- Creates `payment_allocations` table (payment_id, schedule_id, amount_applied)
- Migrates 1,694 existing `payment_id` links to allocation rows
- View adds `amount_paid`, `balance_remaining`, `partial` status
- Drops `payment_id` column from `contract_payment_schedule`

**Frontend:**
- `ScheduleTable` refactored: allocate/deallocate via junction table
- Multi-allocation rows render indented sub-rows (date, method, ref#, amount)
- Status badges: paid (green), partial (amber), late (red), due (amber), upcoming (gray)
- Dashboard Receivables uses `balance_remaining` filter instead of `payment_id`

**Linking script:** `migration/link_payment_schedule.py` rewritten to output
`INSERT INTO payment_allocations` with exact `amount_applied`. Initial migration
preserved old buggy 1:1 links; cleared and re-ran from scratch for correct
chronological allocation (1,796 allocations, 9 partial rows).

**UI polish (same day):**
- Status badges (Late/red, Due/amber, Partial/amber) now visible alongside
  Allocate dropdown — previously the dropdown replaced the badge
- Payments section sorted chronologically by `date_received` (was `id`)
- Fully-allocated payments show green checkmark in Payments list

**Plan:** `migration/payment-allocation-many-to-many-plan.md`
**Foundation for:** Apr 1 invoice generation milestone.

### Bug 7 fixes (same day)

**7a — Schedule total ≠ fee:** `generate_payment_schedule()` treated `final_payment`
as a replacement for the last installment. It's actually an additional row after
`num_payments` regular installments. Formula: `fee = retainer + num_payments ×
monthly_payment + final_payment`. Fix is in the migration file. All schedule
totals now match contract fees (0 gaps).

**7b — Misassigned payments:** 11 payments reassigned to correct contracts:
- 3 payments predating their assigned contract's start date
- 8 cross-account misassignments (payment.account_id ≠ contract.account_id)

**LMC CLOSE/REOPEN reclassification:** 8 accounting entries reclassified from
`type='payment'` to `write_off` (7) or `discount` (1). These are balance
adjustments, not real money received. 4 write-offs allocated to their
corresponding schedule rows to zero out closed matters.

**31 post-migration payments imported:** Payments entered in legacy Access CRM
since March 1 but missing from Atomic CRM. Detected by comparing Access
`tblPaymentsReceived` against `account_payments`. 2 skipped (accounts not in CRM:
18100501, 24100102).

### Balance formula fix (same day)

Contract balance now accounts for write-offs and discounts:
`balance = fee - payments - write_offs - discounts`

Previously only subtracted payments, so contracts with write-offs showed a
false outstanding balance (e.g. contract 169: $100 write-off not subtracted).

Both `ContractShow.tsx` and `ContractListContent.tsx` updated. Payment count
also filters to `type === 'payment'` only.

**Rollback note:** The type filter (`type === 'payment'` for Received) and the
write-off/discount subtraction are in the same lines of code in both files.
Rolling back the balance formula commit also removes the type filter. If rolling
back, the balance display will revert to summing all payment types (including
write-offs) as "Received" — which inflates the number but at least won't show
a false outstanding balance since the inflated amount also reduces the balance.

### Sync script logging

`scripts/db-sync-prod-to-local.sh` now appends a timestamped line to
`migration/backups/sync.log` on each successful sync.

### Link script full rebuild

`migration/link_payment_schedule.py` changed to always do a full clear + rebuild
of `payment_allocations` instead of incremental updates. The old approach left
stale allocations when payments were reassigned to different contracts.

**Status:** Deployed to production 2026-03-15 via `scripts/db-sync-local-to-prod.sh`.

---

## 2026-03-15 — Fix: Post-migration data corrections (Issues 4–6)

Three data quality fixes applied to all 107 accounts on prod:

1. **Account roles** — All accounts had Linnette (id=2) as attorney, law clerk,
   AND legal assistant. Updated to role-based defaults: attorney=2, law_clerk=4,
   legal_assistant=3. (107 rows)
2. **Credit card payments** — 990 payments reclassified from CHECK to CREDIT CARD
   where `reference_number` is non-numeric (credit card transaction IDs, not check
   numbers). Numeric-only refs (including leading zeros) correctly remain as CHECK.
3. **Account opened date** — All accounts had NULL `date_opened`. Derived from
   account number prefix (format `YYMMDDNN`). (107 rows)

Also fixed `migration/fetch_sample.py` to prevent recurrence on future imports:
- `transform_accounts()` uses role-based user lookup instead of single admin ID
- Payment transform detects non-numeric refs → sets CREDIT CARD instead of CHECK
- `date_opened` derived from account number prefix when Access field is empty
- `DateOpen` → `DateOpened` typo fix for client records

**Validation:** Before/after CSVs in `migration/output/fix{4,5,6}_*.csv`.
**Backup:** `migration/backups/prod_data_2026-03-15.sql` (taken during prod→dev sync).
**Plan:** `migration/post-migration-plan.md` Issues 4–6.

---

## 2026-03-14 — Fix: 31 unlinked prod payments resolved

- **Root cause:** Phase 2 SQL was generated from local dev (with local payment IDs). When applied to prod, 31 UPDATEs matched 0 rows because prod had different auto-increment IDs from user activity between sync and deploy.
- **Fix:** Synced prod → local, re-ran `associate_payments.py` (picked up the 31 with correct prod IDs), applied to both local and prod.
- 1 payment (id 2755, $400, account 26021701) also needed schedule linking → linked to schedule row 4418.
- **Result:** 1,587/1,587 payments linked, 0 unlinked on prod.

---

## 2026-03-14 — Migration: 25 remaining accounts imported

### Bulk import (Phase 1)
- **25 accounts** imported from Exchange/Access into Atomic CRM (total now 107).
- Accounts: 25062601, 26022701, 220122801, 20090802, 19062701, 22030701, 25121901, 21082401, 26022601, 22100401, 06090901, 16082701, 09040101, 06122701, 07042104, 23022801, 21030801, 21031701, 22021401, 26021701, 21072301, 20062301, 20072201, 22012601, 20072401.
- Data imported: 25 accounts, 25 contacts, 39 contracts, 350 payments, 1,203 tasks, 4,923 activities.
- **Note:** Original list had `22012801` (typo) — corrected to `220122801` (Heather Godfrey & Bruno Viana). Required fresh copy of `billing_be.mdb` from Access server (previous copy was from Feb 16, missing 4 newer accounts).

### Payment → contract association (Phase 2)
- **311 new payments** linked to contracts using the capacity-aware algorithm.
- Rules applied: single-contract (131), date-range (173), date-range-overflow (7). Zero unresolved.
- **2 new overpaid contracts**: 16082701A2 ($5,000 over — likely missing contract, needs manual review), 21082401AB1 ($300 over — minor irregularity).

### Payment schedule linking (Phase 3)
- **470 new schedule rows** linked (total 1,790 across all accounts; 1,695 on prod after deducting previously-linked rows that were UPDATE 0).
- 649 schedule rows remain unlinked (future installments).

### Production deployment
- **Backup:** `migration/backups/prod_data_2026-03-14.sql` (19,963 lines)
- All three SQL files applied to prod (`10.0.10.228:5433`).
- Prod vs local row counts match within expected user-activity delta (+1 payment, +3 tasks, +1 activity on prod).

### Documentation
- `migration/remaining-accounts-migration-plan.md` — migration plan with validation steps

---

## 2026-03-14 — Migration Phase 2: auto-associate payments to contracts + link payment schedule

### Payment → contract association (`migration/associate_payments.py`)
- **Problem:** 1,091 of 1,236 payments (88%) had `contract_id = NULL` after the Phase 1 bulk import because the legacy Access system doesn't associate payments with contracts. Only 145 retainer payments were linked (matched during import by `date_received = contract.date_opened`).
- **Algorithm:** Capacity-aware filling — processes payments per-account chronologically, tracking a running total per contract. Prevents overpaying a contract by spilling to adjacent contracts when one is full.
- **Rules applied:** single-contract (634), date-range (442), amount-match (8), boundary-payoff (1), capacity-spill-back (2), capacity-spill-fwd (1), concurrent-capacity (3). Zero unresolved.
- **Validation:** 56 contracts fully paid, 81 underpaid (active accounts still making payments), 2 slightly overpaid (genuine payment irregularities — a $200 lump-sum overshoot and a $25 partial payment overshoot). No exact-offset pairs confirming no mis-links.
- **Applied to:** local dev and production.

### Payment schedule linking (`migration/link_payment_schedule.py`)
- **Problem:** All 2,045 `contract_payment_schedule` rows had `payment_id = NULL`, causing every row in the UI to show "link payment" even for past-due installments that had been paid.
- **Algorithm:** For each contract, walks payments and schedule rows chronologically. Each payment consumes schedule rows in order until fully allocated, handling exact matches, lump sums (one payment covers multiple rows), and partial payments.
- **Result:** 1,320 schedule rows linked. 725 remain unlinked (future installments not yet paid). 5 negative payments (refunds) skipped. 36 payments beyond the schedule (extra lump-sum coverage).
- **Applied to:** local dev and production.

### Output files
- `migration/output/associate_payments_report.csv` — per-payment with proposed link, rule, reason, contract balance
- `migration/output/associate_payments_contract_summary.csv` — per-contract balance summary
- `migration/output/associate_payments.sql` — 1,091 UPDATE statements
- `migration/output/link_payment_schedule.sql` — 1,405 UPDATE statements

### Documentation
- `migration/associate-payments-algorithm.md` — algorithm description, rule definitions, capacity-aware design rationale, validation results

---

## 2026-03-12 — Fix: imported task due dates from Exchange

### Data fix (no code deployment needed)
- **Problem:** All 2,516 tasks imported from Exchange had wrong due dates. The import script used the `exchange/tasks/duedate` WebDAV property, which returns empty for public folder `IPM.Task` items. The script fell back to the message creation date, which is typically earlier than the actual due date.
- **Root cause:** Exchange 2003 stores task due dates as a MAPI named property (`PidLidTaskDueDate`, LID 0x8105) in the `PSETID_Task` property set — not in the `exchange/tasks/` namespace.
- **Fix:** Fresh Exchange export using the corrected MAPI property, matched to CRM task IDs by `(account_number, task_text)`. Applied a targeted SQL UPDATE script (2,508 tasks) to both local dev and production.
- **Exclusions:** 30 tasks (id ≥ 5088) excluded — these were created or edited by users directly in Atomic CRM and already have correct due dates. 2 tasks skipped (no due date set in Exchange). 6 tasks already had the correct date.
- **Validation:** Cross-checked all updated due dates against Exchange source data — zero mismatches. Verified no other columns or tables were modified.
- **Staff action:** Users should spot-check the 30 excluded tasks listed in `migration/output/due_date_fix_all_tasks.csv`, plus any older imported tasks whose due dates they may have manually edited.
- **Backup:** Pre-fix production backup at `migration/backups/prod_data_2026-03-12.sql`.
- **Details:** See `migration/task-due-date-exchange-fix.md` for full procedure and validation results.

---

## 2026-03-11 — Fix: task due date off-by-one timezone bug

### Bug fix
- **Reported symptom:** Rescheduling a task to a specific date saved it one day earlier than selected (e.g. picking April 17 displayed April 16 after save).
- **Root cause:** `tasks.due_date` was stored as `timestamptz`. Two code paths (create transform and edit display) both shifted dates back by one day for Pacific Time users.
- **Database migration:** Changed `due_date` column from `timestamptz` to `date`, converting existing values using `AT TIME ZONE 'America/Los_Angeles'` to preserve currently-displayed dates.
- **Code fixes:** Removed buggy `setHours(0,0,0,0)` transforms from task create paths. Replaced UTC-based postpone button arithmetic with local date arithmetic (`localDatePlusDays`). Fixed default due date on new tasks to use local date instead of `toISOString().slice(0,10)` (which gave tomorrow's date after 5 PM PDT).
- **Staff action:** Users should spot-check tasks created or rescheduled since March 10 and correct any that are 1 day off via Edit.

---

## 2026-03-10 — Tasks/Activities consolidation, contract-first workflow, truncation fixes

### AccountShow: Tasks + Activities merged into a single feed
- The separate Activities tab on the account show page has been removed.
- The Tasks tab now shows a combined chronological feed of tasks and account-level activities.
- Activities linked to a task (`parent_type='tasks'`) nest indented beneath their parent task in the feed.
- Standalone activities not linked to any task interleave with tasks in date order.

### Contract-first workflow enforcement (Add Task / Add Activity from account)
- **Add Task** from the account Tasks tab now opens a two-step picker: first select a contract (or "Account level"), then the task form. If a contract filter is already active in the aside, the picker is skipped and the form pre-fills the selected contract.
- **Add Activity** from the account Tasks tab opens a three-step picker: first choose what to attach to (a task, a contract, or account level); then pick the specific task or contract; then the activity form. Same shortcut applies when a contract filter is active.

### Filter by Contract in account aside
- The account detail aside (right panel on desktop) now shows a **Filter by Contract** section when the Tasks or Payments tab is active and the account has contracts.
- Clicking a contract button filters the Tasks feed and Payments list to items linked to that contract. Click again to clear.
- Placed at the bottom of the aside to minimise layout shift when switching tabs.

### Truncation and tooltip fixes
- Long task titles and activity subjects now truncate with `…` instead of causing horizontal scroll.
- Hovering over a truncated title shows the full text in a wrapping tooltip (Outlook-style).

---

## 2026-03-09 — Migration: task owner mapping + Exchange data cache

### Migration script (`fetch_sample.py`)
- **Task owner → assignee**: Fetches the `tasks:owner` property from Exchange and resolves it to a CRM `user_id` by matching against the CRM users table (full name, first name, last name). Tasks are now assigned to their original Outlook owner instead of defaulting to the admin user.
- **Post item creator → activity user**: Extracts the modifier name from the `" modified by {Name}"` suffix in post item subjects and resolves it to a CRM `user_id`.
- **`--use-cache` flag**: First run saves all fetched Exchange and Access data to `migration/output/cache_*.json`. Subsequent runs with `--use-cache` skip Exchange/Access fetches and load from cache. Supabase lookups (user IDs, contact types) are always fetched fresh.

### One-time fix (`fix_task_owners.py`)
- Standalone script to UPDATE existing local data: 1,338 tasks reassigned from admin default to correct Outlook owner (Maria Ruiz: 1,113, Victor Garcia: 225), 39 post-item activities reassigned from "modified by" name extraction.
- Supports `--use-cache` (reuse fetched Exchange data) and `--apply` (run SQL directly via docker psql).
- Synced to production via `db-sync-local-to-prod.sh` — all row counts verified, no user ID mismatches.

### User Guide
- Added `USER-GUIDE.md` with end-user instructions covering accounts, contacts, contracts, tasks, activities, payments, and common workflows.

## 2026-03-08 — Soft delete, admin-only delete with confirmation

Replaced hard deletes with soft deletes across the CRM. Records are never permanently removed from the UI — the `deleted_at` timestamp is set instead. Only a DBA can permanently purge records via SQL.

### Migration (`20260308200000_soft_delete.sql`)
- Added `deleted_at timestamptz` to 6 tables: accounts, account_contacts, account_contracts, account_payments, account_activities, tasks
- **Cascade trigger**: soft-deleting an account automatically soft-deletes all its children (contacts, contracts, payments, activities, tasks). Restoring an account restores its children.
- **FK constraints changed** from `ON DELETE CASCADE` to `ON DELETE RESTRICT` — hard deletes are blocked at the DB level
- All views (`accounts_summary`, `contract_payment_schedule_view`, `contacts_summary`, `companies_summary`) updated to filter out soft-deleted records

### DataProvider (Supabase + FakeRest)
- `delete` and `deleteMany` overridden to do `UPDATE SET deleted_at = NOW()` instead of real DELETE
- `getList` injects `deleted_at IS NULL` filter for all soft-delete resources

### Frontend
- **DeleteButton** (`admin/delete-button.tsx`): hidden for non-admin users; admin deletes now show a confirmation dialog instead of the undo toast
- **BulkDeleteButton** (`admin/bulk-delete-button.tsx`): hidden for non-admin users

### DBA script (`migration/dba_soft_delete.sql`)
- View all soft-deleted records with child counts
- Restore a specific account (cascade trigger handles children automatically)
- Hard-delete records older than 90 days (children first, parents last)

## 2026-03-08 — Dashboard: admin-only, hide Latest Activity

Dashboard is now restricted to admin users. Non-admins are redirected to `/accounts`. The "Latest Activity" panel has been removed from both desktop and mobile dashboards. The Dashboard nav tab and logo link route non-admins directly to `/accounts`.

## 2026-03-08 — Fix refund/discount balance calculation

Refunds were stored as positive amounts with a `type` column determining accounting direction. This required every consumer of payment data to check the type — and the contract detail page didn't, causing refund amounts to be *added* to "Received" instead of subtracted (e.g. $1,000 payment + $50 refund showed $1,050 received instead of $950).

### Fix: store refunds as negative amounts
Refunds are now stored as negative values in `account_payments.amount`. Discounts and write-offs remain positive (they reduce the balance, same as payments). This simplifies the balance formula to `balance = contracted - SUM(all amounts)` — no type-aware logic needed.

### Migration (`20260308100000_signed_refund_amounts.sql`)
- Replaced `amount > 0` constraint with `amount != 0`
- Negated existing refund rows (`SET amount = -abs(amount) WHERE type = 'refund'`)
- Simplified `accounts_summary` view: `balance_due = total_contracted - SUM(all amounts)`

### Frontend
- **AddPayment, AccountPaymentEditSheet, ContractShow inline create** — transform now negates amount for refund type (`-Math.abs()`)
- **PaymentRow** — display uses `Math.abs()` with sign/color based on actual amount value instead of checking type string
- **ContractShow schedule table** — available payments dropdown filtered to `type === 'payment'` only (refunds shouldn't be linkable to schedule rows)
- **ContractShow balance** — `fee - SUM(all amounts)` now works correctly with no changes needed to the formula itself

## 2026-03-08 — DB sync scripts: disable trigger to prevent user ID mismatch

Rewrote the database sync scripts (`db-sync-prod-to-local.sh`, `db-sync-local-to-prod.sh`) to disable the `on_auth_user_created` trigger before loading data dumps and re-enable it after. The trigger was firing during `auth.users` inserts and creating duplicate rows in `public.users` with wrong auto-increment IDs. Also replaced `db reset` with `migration up` in the sync flow to avoid data loss.

## 2026-03-08 — Payment adjustments: refund, discount, write-off support

Added `type` column to `account_payments` supporting four payment types: `payment` (default), `refund`, `discount`, `write_off`. UI shows colored badges for non-payment types, conditionally hides irrelevant fields (payment method, reference number) for adjustments, and requires a reason note for discounts/write-offs. Updated `accounts_summary` view with `total_refunds` and `total_adjustments` columns. Also updated migration balance scripts to use `tblPaymentsReceived` (correct source) and documented the 3-phase migration workflow.

## 2026-03-07 — LMC feedback batch

Address feedback from LMC review covering account/contact/contract creation forms and task filters.

### Database migrations

- `20260307200304_add_user_roles.sql` — Adds `role text` column to `users` table. Backfills: Linnette = `attorney`, Victor = `law_clerk`, Maria = `legal_assistant`. Used to auto-assign team fields on new account creation. When a staff member is replaced: disable the old user, assign the role to the new user. Completed tasks, activities, and closed accounts retain the original user. Only open accounts and unfinished tasks get reassigned to the new role holder.
- `20260307200326_contract_status_default.sql` — Changes `account_contracts.status` default from `'To do'` to `'In process'`. Updates all existing rows with status "To do" to "In process". Contract-only; task statuses keep "To do".
- `20260307200340_add_child_contact_type.sql` — Inserts "child" into `contact_types`.
- `20260307200900_fix_final_payment_calc.sql` — Fixes `generate_payment_schedule()`: when `final_payment` is 0 or null, uses `monthly_payment` for the last installment instead of creating a $0 row.

### Phone input (`misc/PhoneInput.tsx`, `misc/phoneUtils.ts`)
New `PhoneInput` component accepts numeric-only entry, displays formatted US phone numbers as `(555) 123-4567`, and stores in E.164 format (`+1XXXXXXXXXX`). Applied to billing phone on account create and phone on account_contacts create/edit. No DB schema change needed — existing `text` columns are sufficient.

### Team auto-assignment (`accounts/AccountInputs.tsx`)
`AccountTeamInputs` now fetches users and auto-assigns `attorney_id`, `law_clerk_id`, `legal_assistant_id` based on each user's `role` column. The three role pickers are hidden from the create form. Only the Account Manager (`user_id`) picker remains user-selectable. Team fields remain read-only on the account show page aside.

### Remove "To do" from contract statuses
- `defaultContractStatuses` in `defaultConfiguration.ts` — removed "To do"
- `contractStatusColors` in `statusColors.ts` — removed "To do" color entry
- `ContractShow.tsx` — fallback status changed from "To do" to "In process"

### Title case transforms (`misc/titleCase.ts`)
New `toTitleCase()` utility applied via `parse` prop to name, street, and city fields on both account create (billing contact) and account_contacts create/edit forms.

### Country dropdown
Replaced free-text country input with `SelectInput` dropdown defaulting to "US". Choices include common countries for an immigration law firm (US, Mexico, Canada, Guatemala, Honduras, El Salvador, Nicaragua, Colombia, Peru, Brazil, Other). Applied to both account create and account_contacts forms.

### Hide "Date first consult"
Removed `date_first_consult` from `AccountDatesInputs`. Field remains in the DB for existing data.

### Task filters (`tasks/TaskListFilter.tsx`)
- "Assigned To" category moved to first position
- Now lists all active users (not just "Me"), with "Me" still first
- Added "Not done" composite filter (`status@in: (To do,In Process,Blocked)`) at the top of the Status category

### Fix final payment calculation
- `ContractInputs.tsx` — When `fee - retainer` divides evenly by `monthly_payment`, `final_payment` is now set to `$0` instead of repeating the monthly amount. E.g. $1000 fee = $250 retainer + $150/mo × 5 + $0 final.
- DB trigger `generate_payment_schedule()` — Now treats `final_payment = 0` the same as null, using `monthly_payment` for the last installment.
- FakeRest `account_contracts.ts` — Same fix applied to demo data generator.

### Phone input bug fix
`parsePhoneDigits` now strips leading country code `1` and caps at 10 digits. Previously accepted unlimited digits, causing stored values like `+15551212111` with extra digits.

### Contract status default in form
Added `defaultValue="In process"` to the status `SelectInput` in `ContractInputs.tsx`. Previously the select appeared empty on create even though the DB default was set.

### Contract create redirect
`ContractCreate.tsx` now sets `redirect="show"` on `CreateBase`, sending the user to the contract show page after saving. This lets them immediately add the retainer payment.

### User role field
Added `role` `SelectInput` (Attorney, Law Clerk, Legal Assistant) to `UsersInputs.tsx`. Also added `role` to the `SalesFormData` type so it persists through the create/edit flow.

### Account Manager default
`AccountTeamInputs` now defaults `user_id` (Account Manager) to the user with role `attorney`, in addition to auto-assigning the three team role fields.

### Billing contact sort order
`AccountContactsList` now sorts billing contacts to the top of the list on the account show page.

### State dropdown picker (`misc/usStates.ts`)
Replaced free-text state input with `SelectInput` dropdown listing all US states and territories. Applied to both account create (billing contact) and account_contacts forms.

### New files
- `src/components/atomic-crm/misc/PhoneInput.tsx`
- `src/components/atomic-crm/misc/phoneUtils.ts`
- `src/components/atomic-crm/misc/titleCase.ts`
- `src/components/atomic-crm/misc/usStates.ts`

### Modified files
- `src/components/atomic-crm/types.ts` — Added `role` to `Sale` and `SalesFormData` types
- `src/components/atomic-crm/accounts/AccountInputs.tsx` — Team auto-assign, phone input, title case, country/state dropdowns, hide date_first_consult, Account Manager default
- `src/components/atomic-crm/accounts/AccountCreate.tsx` — Added `billing_address_country: "US"` default
- `src/components/atomic-crm/accounts/AccountContactsList.tsx` — Billing contact sort
- `src/components/atomic-crm/account-contacts/ContactInputs.tsx` — Phone input, title case, country/state dropdowns
- `src/components/atomic-crm/contracts/ContractInputs.tsx` — Final payment fix, status default
- `src/components/atomic-crm/contracts/ContractCreate.tsx` — Redirect to contract show
- `src/components/atomic-crm/contracts/ContractShow.tsx` — Status fallback "To do" → "In process"
- `src/components/atomic-crm/root/defaultConfiguration.ts` — Removed "To do" from contract statuses
- `src/components/atomic-crm/misc/statusColors.ts` — Removed "To do" contract color
- `src/components/atomic-crm/tasks/TaskListFilter.tsx` — Reordered filters, added all-users and "Not done"
- `src/components/atomic-crm/users/UsersInputs.tsx` — Added role picker
- `src/components/atomic-crm/providers/fakerest/dataGenerator/account_contracts.ts` — Final payment fix in demo data

## 2026-02-22 — Payment schedule (cashflow forecasting & AR)

Replaces the legacy Access `tblPaymentSchedule` with a native CRM feature. When a contract is created, a payment schedule is automatically generated from its terms. The schedule powers two new capabilities: cashflow forecasting and AR overdue identification.

### Database (`20260222000001_contract_payment_schedule.sql`)
- **`contract_payment_schedule` table** — one row per expected payment. `payment_number = 0` is the retainer; `1..N` are installments. `payment_id` FK to `account_payments` marks a row as paid (NULL = unpaid). Preserves paid rows when regenerating.
- **`generate_payment_schedule(p_contract_id)` function** — generates the retainer row from `date_retainer`/`retainer`, then N installment rows using `make_interval(months=>)` to keep the same calendar day as `date_first_payment`. The final installment uses `final_payment` if set.
- **`trg_generate_payment_schedule` trigger** — fires `AFTER INSERT` on `account_contracts`; auto-populates the schedule without any frontend action required.
- **`contract_payment_schedule_view`** — joins with `account_contracts` and `accounts`; computes `status` (paid / late / due / upcoming) at query time so it never goes stale. Exposed via Supabase dataProvider routing (`contract_payment_schedule` → view).

### Contract detail — Payment Schedule section
- **`ContractShow.tsx`** — New "Payment Schedule" card rendered above the Payments section. Table columns: `#` (R = retainer, 1..N = installment), Due Date, Amount, Status badge (green/red/amber/muted).
- **Regenerate schedule** link in the aside (admin-only) — calls `generate_payment_schedule` RPC; useful after editing contract terms without recreating the contract.

### Dashboard — Receivables panel (`dashboard/Receivables.tsx`)
New widget placed in the left column of the dashboard (alongside future Performance and Deadlines panels):
- **Overdue section** — all unpaid past-due schedule rows, red-themed. Shows account name, contract number, days late, and amount. "All payments current" green indicator when nothing is overdue.
- **Next 30 days section** — upcoming payments due within 30 days with per-item and total amounts. Retainer rows labeled accordingly.
- **90-day lookahead** — aggregate count and total shown below the 30-day list.
- Each row links directly to the contract show page.

### FakeRest (demo mode)
- New `dataGenerator/contract_payment_schedule.ts` — mirrors the DB function logic; includes denormalized `account_name`, `contract_number`, `account_number` fields for dashboard display.
- `dataGenerator/account_contracts.ts` — now generates `final_payment` and normalises date fields to `YYYY-MM-DD`.
- `Db` type and `index.ts` updated.

## 2026-02-21 — Mobile (phone viewport) support

Comprehensive responsive design pass to make the app fully usable on phone viewports. The app now maintains two separate React component trees: `DesktopAdmin` (≥768px) and `MobileAdmin` (<768px), each with appropriate resource registrations and layouts.

### Navigation & layout
- **`MobileNavigation`** — Replaced generic "Contacts/Contracts" tabs with **Home | Accounts | [FAB] | Tasks | More** bottom nav. "More" dropdown contains Contacts, Contracts, theme toggle, and logout. FAB is context-sensitive: creates an Account on the accounts list, Contact on the contacts list, Contract on the contracts list, Task on the tasks list, and a picker (Task / Activity / Payment) on a contract detail page.
- **`MobileNavigation`** — Nav bar hides entirely on edit and create form routes so `FormToolbar` has unobstructed access to the bottom of the screen.
- **`Header`** — Desktop nav tab padding reduced (`px-3 lg:px-6`) to prevent overflow at the 768px breakpoint.
- **`MobileLayout`** / **`MobileContent`** — No changes needed; existing `pt-18 pb-20` spacing was already correct.

### New mobile list pages
- **`MobileAccountsList`** — `InfiniteListBase` + `MobileHeader` + `AccountListContent`; replaces full desktop `AccountList` on mobile.
- **`MobileContractsList`** — Same pattern for contracts.
- **`ContactList`** — Shared between desktop and mobile; hides the `+Create` button on mobile (FAB handles creation).

### Sheet-based create & edit forms (replaces full-page routes on mobile)
All create and edit actions on mobile now use bottom-sheet modals matching the existing `TaskCreateSheet` / `TaskEditSheet` UX (title + X close, scrollable content, footer actions):
- **`AccountCreateSheet`** — Handles async `generate_account_number` RPC and secondary billing-contact creation.
- **`ContactCreateSheet`** / **`ContractCreateSheet`** — Thin wrappers around `CreateSheet`.
- **`ContactEditSheet`** — Uses `EditSheet` with `ContactInputs`; Delete redirects to contact list.
- **`ActivityCreateSheet`** — Inline form (subject, details, date, type) for creating contract activities.
- **`PaymentCreateSheet`** — Uses `AccountPaymentInputs` for recording payments from a contract detail page.

### Show page improvements
- **`AccountShow`** / **`ContactShow`** / **`ContractShow`** — Outer wrapper changed from `flex gap-8` to `flex flex-col gap-4 md:flex-row md:gap-8` so content stacks vertically on mobile.
- **`AccountAside`** / **`ContactAside`** — `hidden sm:block` → `hidden md:block` to align with the flex-row breakpoint.
- **`AccountShow`** tabs — Wrapped in `overflow-x-auto` with `flex w-max min-w-full` so tabs scroll horizontally instead of wrapping.
- **`ContactShow`** — Mobile-only action bar added: `← Contacts` back button, `Edit` button (opens `ContactEditSheet`). Desktop aside unchanged.

### Dashboard
- **`MobileDashboard`** — Removed onboarding stepper (was querying the unused `contacts` table, always showing zero). Now always renders the activity log dashboard.
- **`DealsChart`** — Height capped at `h-[220px]` on mobile, `h-[400px]` on desktop.
- **`DashboardStepper`** — Gap values reduced on mobile (`gap-6 md:gap-12`).

### Other fixes
- **`NoteAttachments`** — Attachment grid changed from fixed 4-column / `w-[200px]` to responsive `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` with `w-full`.
- **`FormToolbar`** — Restored to `sticky bottom-0`; the mobile nav hides itself on form routes so there is no overlap.
- **`CRM.tsx` `MobileAdmin`** — Registered `AccountShow`, `AccountCreate`, `ContactShow`, `ContactCreate`, `ContactEdit`, `ContractShow`, `ContractCreate` with correct resource props and nested note routes.

## 2026-02-20 — Contract number alpha suffix generation

Implements the legacy Outlook VBScript contract numbering scheme: `{account_number}{A|B|C...}` where the alpha suffix increments for each additional contract on the same account (e.g. `26022001A`, `26022001B`).

**Database**
- `20260220000001_contract_number_generation.sql` — `generate_contract_number(account_id)` function counts existing contracts for the account and appends `chr(65 + count)`; `set_contract_number()` trigger fires `BEFORE INSERT` on `account_contracts` when `contract_number` is null/empty.
- `20260220000002_backfill_contract_numbers.sql` — One-time `UPDATE` using `row_number() OVER (PARTITION BY account_id ORDER BY created_at, id)` to reformat all existing records to the new scheme.

**Frontend**
- `ContractCreate.tsx` — Removed the account fetch and `Contract ${account_number}` pre-fill; the DB trigger handles numbering server-side.
- `ContractInputs.tsx` — `contract_number` field is now disabled with helper text "Auto-generated on save"; removed `handleAccountChange` auto-fill logic and unused imports.
- `account_contracts.ts` (FakeRest) — Demo contracts now generated as `${account.account_number}${A|B}` matching the real format.

## 2026-02-20 — Payment UI polish and contract financial summaries

### Add payment dialog (replaces full-page sheet)
- Extracted `AddPayment` component using the `CreateBase + Dialog` pattern, matching `AddTask` / `AddActivity` style. Deleted `AccountPaymentCreateSheet`.
- Used in both `ContractShow` aside and `AccountPaymentList` tab.
- Renamed all "Record Payment" labels to "Add payment".

### Contract financial summary (Contracted / Received / Balance / Payments)
Displayed consistently across three surfaces, always sourced from live `account_payments` data:
- **`AccountContractsList`** (`/accounts/:id/show` → Contracts tab): single `useGetList` for all account payments; per-contract totals computed client-side. `Payments: x of n` uses `num_payments` when set.
- **`ContractListContent`** (`/account_contracts`): `ContractPaymentSummary` child component per row; each fires its own `useGetList` filtered by `contract_id` (react-query caches/deduplicates).
- **`ContractShow`** (`/account_contracts/:id/show`): single `useGetList` filtered by `contract_id`; summary bar rendered between the header and Terms / Dates grid. Balance shown in red when > 0, green otherwise.

### AccountPaymentList improvements
- Each payment row now shows the associated contract number (e.g. `Contract 26021901`) when `contract_id` is set; fetched via a single `useGetList` for the account's contracts.
- Removed the redundant "Contract:" label prefix — the word "Contract" is part of the contract number itself.
- Removed the "Total received" footer (redundant with the Balance figure in the account-level summary bar above the tabs).

### Removed redundant display elements
- `ContractShow` header: removed the "Fee: $X" badge (fee is already shown in the Terms section and in the financial summary bar).
- `ContractListContent` rows: removed the `$X/mo × N` monthly payment detail from the right column (fee detail is now in the financial summary row); status badge remains.

## 2026-02-20 — Account Payment recording

Replaces the legacy Outlook `IPM.Post.Account payment` form and Access `tblPaymentsReceived` table with a native CRM feature.

**Database (`20260220000000_account_payments.sql`)**
- New `account_payments` table: `account_id`, `contract_id` (nullable), `date_received`, `amount` (> 0 check), `payment_method`, `reference_number`, `notes`, `user_id`, `created_at`, `updated_at`. Permissive RLS matching project convention; admin enforcement is frontend-only.
- `accounts_summary` view updated with correlated-subquery aggregates: `total_received`, `total_contracted`, `balance_due`.

**Configuration**
- New `paymentMethods` prop on `<CRM>` (default: CHECK, MONEY ORDER, CASH, CREDIT CARD, WIRE TRANSFER). Threaded through `ConfigurationContext`.

**Components (`src/components/atomic-crm/payments/`)**
- `AccountPaymentInputs` — shared form fields; `reference_number` label adapts to selected payment method (Check Number, Money Order Number, Cash Receipt Number, etc.).
- `AccountPaymentCreateSheet` — any authenticated user can record a payment against an account.
- `AccountPaymentEditSheet` — admin-only edit/delete sheet using pessimistic mutation mode.
- `AccountPaymentList` — displays payments sorted by date descending with a running total; pencil edit button visible only to admins (`isAdmin = !!currentUser?.administrator`).

**Account Show page**
- Financial summary bar (Contracted / Received / Balance) above the tab strip; balance renders red when > 0.
- New **Payments** tab with count badge using `ReferenceManyField` → `AccountPaymentList`.
- `account_payments` registered as a `<Resource>` in `CRM.tsx`.

**FakeRest demo**
- `account_payments` data generator: 0–4 payments per contract with realistic reference numbers per method.
- Computes `total_contracted`, `total_received`, `balance_due` on account objects so the financial summary works in demo mode.

## 2026-02-20 — FakeRest demo data for Clark Law schema

Added data generators so that `make start-demo` works against the dev branch UI instead of failing with account_contacts errors. This enables runtime testing of upstream cherry-picks without touching the real Supabase database.

### New generator files
- `dataGenerator/contact_types.ts` — Static list of immigration-relevant contact types (Petitioner, Beneficiary, Spouse, Child, Parent, Emergency Contact)
- `dataGenerator/accounts.ts` — 20 fake law firm client accounts with account numbers, categories, attorney assignments
- `dataGenerator/account_contacts.ts` — 1–4 contacts per account, first contact marked as billing
- `dataGenerator/account_contracts.ts` — 1–2 contracts per account using real case types and contract statuses
- `dataGenerator/account_activities.ts` — 2–4 activities per account, some linked to contracts via `parent_type`/`parent_id`

### Modified generator files
- `dataGenerator/types.ts` — Extended `Db` interface with the 5 new resources
- `dataGenerator/index.ts` — Wired up new generators in dependency order
- `dataGenerator/tasks.ts` — Updated to link tasks to accounts/contracts instead of contacts; reduced count to 60
- `dataGenerator/companies.ts` — Fixed `db.sales` → `db.users` bug (latent since sales→users rename)

## 2026-02-20 — Upstream cherry-pick: improve attachment previews (f6fed7a)

Merged upstream commit `f6fed7a` ("Improve attachments previews") from marmelab/atomic-crm.

- Extracted `isImageMimeType()` helper into `notes/isImageMimeType.ts` (shared between input and display)
- Added `notes/AttachmentField.tsx` — renders image attachments as `<img>` tags instead of plain file links
- `NoteInputs.tsx` — replaced `FileField` with `AttachmentField` in the file upload section
- `NoteAttachments.tsx` — removed now-redundant inline `isImageMimeType` function
- `fakerest/dataProvider.ts` — added `beforeSave` lifecycle for `contact_notes` to convert attachments to base64; fixed TypeScript return type on `convertFileToBase64`

## 2026-02-20 — Document Clark Law data model in README

Added a "Clark Law Customizations" section to `README.md` explaining the accounts vs. companies distinction, the rationale for keeping companies in the DB but hidden, and which upstream resources are replaced or hidden in the dev branch UI.

## 2026-02-19 — Replace contacts with account_contacts in CRM UI

Replaced the upstream generic `contacts` resource with `account_contacts` throughout the UI. The old `contacts` table stays in the DB but is hidden from navigation. Also split `account_contacts.full_name` into `first_name` + `last_name` and removed `contact_id` references from tasks.

### DB migration: split full_name (`20260219000004_split_account_contact_name.sql`)
- Added `first_name` and `last_name` columns to `account_contacts`
- Migrated data from `full_name` using `split_part`
- Dropped `full_name` column
- Recreated `accounts_summary` view with `first_name || ' ' || last_name`

### New account_contacts views
- **`ContactList.tsx`** — List page with name (linked), email/phone, account reference, contact type badge, billing badge
- **`ContactShow.tsx`** — Detail page with all fields, aside with account link, edit/delete buttons
- **`ContactEdit.tsx`** — Edit page reusing `ContactInputs`

### Navigation: route to account_contacts, hide old contacts
- `CRM.tsx` — `<Resource name="contacts" />` registered without views (backward compat only); `account_contacts` gets full CRUD
- `Header.tsx` — Contacts tab points to `/account_contacts`
- `MobileNavigation.tsx` — Contacts button navigates to `/account_contacts`; Create > Contact navigates to `/account_contacts/create` instead of old `ContactCreateSheet`

### Dashboard: remove HotContacts
- Removed `HotContacts` widget and `DashboardStepper` (which depended on old contacts existing)
- Removed `contacts` and `contact_notes` count queries

### Tasks: remove contact_id references
- `TaskFormContent` — Removed `selectContact` prop and contact `ReferenceInput`
- `Task.tsx` — Removed `showContact` prop and contact `ReferenceField`; always shows account reference
- `TaskListContent.tsx` — Removed contact_id `ReferenceField`
- `TaskEditSheet.tsx` — Plain "Edit Task" title (was showing contact name)
- `AddTask.tsx` — Removed `selectContact` prop and contact `last_seen` update logic
- `TaskCreateSheet.tsx` — Removed `contact_id` prop and related fetch/display/update logic
- `TaskList.tsx` — Removed `selectContact` from `AddTask` calls
- `TasksIterator.tsx` — Removed `showContact` prop
- `TasksListFilter.tsx` — Removed `showContact` from `TasksIterator` call

### Account contacts: clickable from account show
- `AccountContactsList.tsx` — Contact names wrapped in `<Link to="/account_contacts/${id}/show">`

### Name split propagation
- `types.ts` — `AccountContact` type: `full_name` → `first_name` + `last_name`
- `ContactInputs.tsx` — Two side-by-side name inputs
- `account-contacts/index.ts` — `recordRepresentation` uses `first_name + last_name`
- `AccountInputs.tsx` — Billing fields use `billing_first_name`/`billing_last_name`; autocomplete uses function for `optionText`
- `AccountCreate.tsx` / `AccountEdit.tsx` — Contact creation/update uses `first_name`/`last_name`

## 2026-02-19 — Filter panels for Accounts, Contracts, Tasks; Contract status

### Filter panels for list pages
Added filter sidebars (search + toggle filters) to the Accounts, Contracts, and Tasks list pages, matching the existing Contacts pattern.

- **Accounts** — Category, Activity (updated today/this week/etc.), Open tasks, Team (attorney/clerk/assistant)
- **Contracts** — Status, Date Opened, Fee Range
- **Tasks** — Due Date (Overdue/Today/Tomorrow/This week/Later), Status, Type, Assigned to
- **Contacts** — Replaced the Status filter (Cold/Warm/Hot/In Contract) with a Contact Type filter fetched from the `contact_types` resource

All pages now show the filter sidebar alongside the list, with a `hasFilters` guard so the empty state still renders when filters produce no results. Mobile uses the existing `ResponsiveFilters` sheet.

### Contract status
Added a `status` field to contracts with 7 statuses: To do, In process, In process - Past due, Stopped - Past due, In process - Paid, Done - Paid, Canceled.

- Color-coded status badges on the contract list and show pages
- Instant status change via a `<Select>` dropdown in the show page aside
- Status `<SelectInput>` in the contract edit form

### Status badge color consistency
Standardized "To do" as yellow (attention) and "In process" / "In process - Paid" as blue (neutral) across both contract and task status badges. Extracted duplicated task status color map into shared `tasks/taskStatusColors.ts`.

### Bug fix: Task Due Date filters
Fixed an issue where clicking multiple Due Date filters on the Tasks page caused filters to silently accumulate and conflict (eventually showing zero results with no visual indication). Each filter now declares all due-date keys explicitly so switching between them clears stale values.

### New files
- `supabase/migrations/20260219000003_contract_status.sql` — Adds `status text not null default 'To do'` to `account_contracts`
- `accounts/AccountListFilter.tsx` — Filter sidebar for accounts list
- `contracts/ContractListFilter.tsx` — Filter sidebar for contracts list
- `tasks/TaskListFilter.tsx` — Filter sidebar for tasks list
- `tasks/taskStatusColors.ts` — Shared task status → color class map

### Modified files
- `root/defaultConfiguration.ts` — Added `defaultContractStatuses`, `defaultAccountCategories` (already existed but unused)
- `root/ConfigurationContext.tsx` — Added `accountCategories`, `caseTypes`, `contractStatuses` to context
- `root/CRM.tsx` — Wired new config props through to provider
- `accounts/AccountList.tsx` — Added filter sidebar layout
- `contracts/ContractList.tsx` — Added filter sidebar layout
- `contracts/ContractListContent.tsx` — Added contract status badge with color map
- `contracts/ContractShow.tsx` — Added status badge in header, status change dropdown in aside
- `contracts/ContractInputs.tsx` — Added status `SelectInput`
- `tasks/TaskList.tsx` — Added filter sidebar layout
- `tasks/Task.tsx` — Uses shared `taskStatusColors`
- `tasks/TaskListContent.tsx` — Uses shared `taskStatusColors`
- `contacts/ContactListFilter.tsx` — Replaced Status with Contact Type filter
- `types.ts` — Added `status` to `AccountContract` type

## 2026-02-18 — Dashboard: Completed Tasks section

Added a "Completed Tasks" section on the Dashboard, displayed underneath the existing Upcoming Tasks list in the right column. Shows tasks completed in the last 30 days, sorted by done date (newest first). Respects the same role-based filtering (admins see all, regular users see only their own) and has the same "Load more" pagination.

### New files
- `dashboard/CompletedTasksList.tsx` — Dashboard wrapper with a `CheckCheck` icon and "Completed Tasks" heading, mirrors `TasksList` layout
- `tasks/CompletedTasksListContent.tsx` — Renders a single `TasksListFilter` for tasks completed in the last 30 days, sorted by `done_date` descending

### Modified files
- `tasks/taskFilters.ts` — Added `completedTaskFilters.recentlyCompleted` filter (`done_date@not.is: null` + `done_date@gte: 30 days ago`)
- `dashboard/TasksListFilter.tsx` — Added optional `sortField`, `sortOrder`, and `showCompleted` props (defaults preserve existing behavior)
- `tasks/TasksIterator.tsx` — Added optional `showCompleted` prop to skip the 5-minute done-task filter when displaying completed tasks
- `dashboard/Dashboard.tsx` — Added `<CompletedTasksList />` below `<TasksList />` in the right column

## 2026-02-18 — Dashboard task creation: Account selector instead of Contact

Dashboard > Upcoming Tasks > "Create a new task" dialog now shows an **Account** selector instead of a Contact selector, matching the law office workflow where tasks are normally related to accounts.

### Changed
- `dashboard/TasksList.tsx` — passes `selectAccount` instead of `selectContact` to `AddTask`
- `tasks/AddTask.tsx` — added `selectAccount` prop, wired through to `TaskFormContent`, fixed dialog title and record representation logic

## 2026-02-19 — Rename `sales_id` column to `user_id` everywhere

Completes the `sales` → `users` rename. The table was renamed earlier but FK columns stayed as `sales_id`, which was confusing — `sales_id` on a task actually means "assigned user."

### Migration: `20260219000002_rename_sales_id_to_user_id.sql`
- Renamed `sales_id` → `user_id` on 10 tables: accounts, account_contacts, account_contracts, account_activities, companies, contacts, contact_notes, deals, deal_notes, tasks
- Dropped `set_sales_id_default()` (CASCADE removed 6 triggers), recreated as `set_user_id_default()`
- Recreated `merge_contacts()` function with `user_id`
- Recreated 3 views: `contacts_summary`, `companies_summary`, `accounts_summary`
- Renamed 9 FK constraints (`*_sales_id_fkey` → `*_user_id_fkey`)

### Source code (~57 files)
- Bulk `sales_id` → `user_id` across ~53 `src/` files and 4 edge function files
- **Bug fix:** `postmark/addNoteToContact.ts` still queried `.from("sales")` instead of `.from("users")` — now fixed

## 2026-02-19 — Add /tasks page with status field

### New files
- `supabase/migrations/20260219000001_task_status.sql` — Adds `status` text column (default `'To do'`), backfills `'Done'` for tasks with `done_date`
- `src/.../tasks/TaskList.tsx` — Standalone list page with `<List>`, sort button, and add task action
- `src/.../tasks/TaskListContent.tsx` — Table rows showing task text, due date, account/contact/assignee references, and color-coded status badges
- `src/.../tasks/index.ts` — Resource definition exporting `list` and `recordRepresentation`

### Modified files
- `types.ts` — Added `status?: string` to `Task` type
- `defaultConfiguration.ts` — Added `defaultTaskStatuses` array (`To do`, `In Process`, `Blocked`, `Done`)
- `ConfigurationContext.tsx` — Added `taskStatuses` to context interface, provider, and defaults
- `CRM.tsx` — Imported `taskViews`, `defaultTaskStatuses`; passed `taskStatuses` to provider; registered `<Resource name="tasks" {...taskViews} />`
- `Header.tsx` — Added `/tasks/*` path matching; reordered nav: Dashboard, Accounts, Contracts, Tasks, Contacts
- `TaskFormContent.tsx` — Added `SelectInput` for `status` using `taskStatuses` from config context
- `Task.tsx` — Checkbox toggle now syncs both `done_date` and `status` (`Done` / `To do`); added color-coded status badge inline with task text (visible in `/accounts/:id/show`, `/account_contracts/:id/show`, dashboard, and `/tasks`)
- `AddTask.tsx` — Default record includes `status: "To do"`
- `TasksListFilter.tsx` — Administrators see tasks from all users on the dashboard; non-admins still see only their own
- `TasksListEmpty.tsx` — Same admin logic for the empty-state check
