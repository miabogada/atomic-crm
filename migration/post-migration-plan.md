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

**Remaining steps:**
1. Re-run `fetch_sample.py --use-cache` to re-import tasks with correct due dates.
2. Apply a targeted UPDATE to prod DB to correct imported task due dates, OR
   re-run the full import and diff against existing data.
3. Verify a sample of tasks against Outlook to confirm due dates match.

**Status:** Script updated. Awaiting re-import execution.

---

## Issue 2 — Payments not connected to their parent contract

**Symptom:** Many imported `account_payments` rows have `contract_id = NULL`.
The legacy system (`tblPaymentsReceived`) does not associate payments with
specific contracts, so they were all imported unlinked.

**Plan — two sub-tasks:**

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

**Blocker:** Sync prod DB to local before any data investigation or changes.

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
**Status:** Ready to implement.

---

## Order of execution

| # | Issue | Blocker | Notes |
|---|-------|---------|-------|
| 3 | Tab consolidation (UI) | None | Implement first |
| 2a | Audit unlinked payments | Prod→local sync | Run audit query |
| 2b | Exchange reconciliation | Exchange access + sync | Write `reconcile_exchange.py` |
| 2c | Auto-associate payments | Sync + 2b review | Write `associate_payments.py` |
| 1 | Task due dates | Exchange access | Probe PROPFIND; then re-import |
