# Task Due Date Fix — Exchange MAPI Property Correction

**Date:** 2026-03-12
**Related:** `task-due-date-tz-bug.md` (TZ display bug, separate issue), `task-due-date-tz-review.md` Issue #4

---

## Problem

The original Exchange import (`fetch_sample.py`) used the WebDAV property
`http://schemas.microsoft.com/exchange/tasks/duedate` to read task due dates.
This property returns **empty** for public folder `IPM.Task` items. The script
fell back to the message creation date (`urn:schemas:httpmail:date`), which is
typically earlier than the actual due date.

As a result, **all 2,516 imported task due dates were wrong** — they showed the
date the task was created in Exchange, not the date it was actually due.

## Root Cause

Exchange 2003 stores task due dates as a MAPI named property in the
`PSETID_Task` property set, not in the `exchange/tasks/` namespace. The correct
property is:

| Property | LID | WebDAV URI |
|---|---|---|
| `PidLidTaskDueDate` | 0x8105 | `http://schemas.microsoft.com/mapi/id/{00062003-0000-0000-C000-000000000046}/0x00008105` |

The `{GUID}` in the namespace breaks Python's expat XML parser, so the property
must be fetched using a SQL alias in the WebDAV SEARCH query:

```sql
SELECT "http://schemas.microsoft.com/mapi/id/{00062003-...}/0x00008105" AS "TaskDueDate"
```

Exchange returns the aliased tag `<TaskDueDate>` without the problematic namespace.

See `exchange-gotchas.md` and `EXCHANGE_MCP_PROJECT.md` (WebDAV Property Reference)
for full details.

## Fix Procedure

### 1. Fresh Exchange export (step 1)

Ran `fetch_sample.py` with the corrected MAPI property for all 82 accounts.
The `--use-cache` flag was NOT used because the existing cache predated the fix.

Result: 2,526 out of 2,528 Exchange tasks returned a `task_due` value. The
remaining 2 tasks genuinely have no due date set in Exchange.

Cache saved to `migration/output/cache_exchange.json` (2026-03-12).

### 2. Production backup (step 2)

Backup taken before any changes: `migration/backups/prod_data_2026-03-12.sql`
(4.9 MB, 19,424 lines). This represents the **pre-fix state** — task due dates
are wrong, all other data is correct.

### 3. Matching Exchange tasks to CRM task IDs (step 4)

Tasks were matched by `(account_number, task_text)` join between Exchange
subject lines and CRM task text. Three tasks required special handling:

- **Task 2826** (acct 14041501): Text matched but Exchange has no due date → skipped
- **Task 4534** (acct 24103102): Text matched but Exchange has no due date → skipped
- **Task 5054** (acct 26013001): CRM text was extended after import (95 chars vs
  41 in Exchange). Matched by prefix. Due date updated.

### 4. Exclusions

**30 tasks with `id >= 5088`** were excluded from the update. These are tasks
that were created or edited by users directly in Atomic CRM after the initial
import. They fall into two groups:

- **23 tasks** (id 5088–5110): Identified in `tasks_due_date_review.csv` as of
  the 2026-03-11 timezone bugfix rollout
- **7 tasks** (id 5111–5117): Created by users on 2026-03-11/12 (one working day
  after the TZ fix rollout)

These tasks' due dates already reflect user intent and should not be overwritten.

**Users should spot-check these 30 tasks** plus any older imported tasks whose
due dates they may have manually edited in Atomic CRM. A full task-by-task
listing is in `migration/output/due_date_fix_all_tasks.csv`.

## Update Script

**File:** `migration/output/fix_due_dates.sql`

| Category | Count |
|---|---|
| Tasks updated | 2,508 |
| Tasks excluded (user-created/touched, id ≥ 5088) | 30 |
| Tasks already correct | 6 |
| Tasks skipped (no Exchange due date) | 2 |
| **Total tasks in CRM** | **2,546** |

The script is a single `BEGIN/COMMIT` transaction containing 2,508 individual
`UPDATE` statements. Each line includes a `-- was YYYY-MM-DD` comment showing
the previous (incorrect) date.

## Deployment & Validation

### Applied to local dev (step 5)
Script applied via `docker exec` psql. All 2,508 UPDATE statements committed successfully.

### Local dev validation (step 6)
1. **Row counts** — identical to prod (no rows added or deleted in any table)
2. **Non-due_date columns** — CSV diff of `text`, `done_date`, `status`, `user_id`, `account_id`, `parent_type`, `parent_id`, `deleted_at`, `notes` between local and prod: zero differences
3. **Excluded tasks** (id ≥ 5088) — due dates identical to prod (untouched)
4. **Due dates vs Exchange source** — 2,513 matched tasks checked, zero mismatches

### Applied to prod (step 7)
Same script applied to `10.0.10.228:5433` via `docker run postgres:15 psql`. All 2,508 updates committed.

### Prod validation (step 8)
1. **Row counts** — unchanged from pre-fix backup
2. **Prod vs local dev** — due dates identical across all 2,546 tasks
3. **Prod vs Exchange source** — 182 tasks spot-checked across 5 accounts (07010604, 21062101, 24081201, 25071501, 26013001), zero mismatches

## Output Files

| File | Description |
|---|---|
| `migration/output/fix_due_dates.sql` | The UPDATE script (apply to local dev, then prod) |
| `migration/output/due_date_fix_all_tasks.csv` | Every task with id, account, text, old/new date, outcome |
| `migration/output/cache_exchange.json` | Fresh Exchange export with corrected due dates |
| `migration/backups/prod_data_2026-03-12.sql` | Pre-fix production backup |
