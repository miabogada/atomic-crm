# Task Due Date Timezone Fix — Independent Review

**Reviewed by:** Claude Opus 4.6, 2026-03-11
**Reviewed against:** `migration/task-due-date-tz-bug.md` (RCA & fix plan by Sonnet)

---

## RCA Verification

Traced every code path from scratch. The RCA is **correct** in its core diagnosis — two paths, same symptom:

**Edit path:** `DateInput` receives `"2026-04-17T00:00:00+00:00"` from PostgREST → `defaultFormat` → doesn't match `dateRegex` (length > 10) → `convertDateToString(new Date(...))` → uses **local** `.getDate()` → in PDT, UTC midnight = previous day 5 PM → displays `"2026-04-16"`. Stored correctly in UTC, displayed wrong.

**Old create path (before fix):** transform did `setHours(0,0,0,0)` on a UTC-parsed Date, shifting the actual stored timestamp back a day. Both stored wrong AND displayed wrong.

**Postpone buttons (before fix):** UTC-based `toISOString().slice(0,10)` gave the wrong local date after 5 PM PDT.

---

## Code Fixes Verification

| Fix | File(s) | Status |
|-----|---------|--------|
| Buggy transforms removed | `AddTask.tsx`, `TaskCreateSheet.tsx`, `AccountShow.tsx` | ✓ Confirmed — no transform touches `due_date` |
| `localDatePlusDays` for postpone buttons | `Task.tsx:32-37` | ✓ Correct local date arithmetic |
| Edit path `transformTask` | `TaskEdit.tsx`, `TaskEditSheet.tsx` | ✓ Only touches `done_date`/`status`, not `due_date` |
| `DateField` UTC safeguard | `date-field.tsx:57-59` | ✓ When value string ≤ 10 chars (bare `YYYY-MM-DD` from `date` column), forces `{ timeZone: "UTC" }` for display |

---

## Migration SQL Verification

```sql
ALTER TABLE tasks
  ALTER COLUMN due_date TYPE date
  USING (due_date AT TIME ZONE 'America/Los_Angeles')::date;
```

For `'2026-04-17T00:00:00Z'`: `AT TIME ZONE 'America/Los_Angeles'` → `'2026-04-16 17:00:00'` → `::date` → `2026-04-16`.

This preserves **what was displayed**, not what was intended. That's the right call — you can't automatically distinguish Victor's workaround tasks from non-workaround tasks. Staff review is needed post-migration. ✓

---

## Issues Found

### 1. Stale comment in migration file (minor)

`supabase/migrations/20260311000000_tasks_due_date_to_date_type.sql` line 11 says:

> using the America/Chicago timezone

But the actual SQL on line 15 uses `America/Los_Angeles`. The comment was never updated when the timezone was corrected.

**Fix:** Update the comment.

### 2. Default due date on new tasks has the SAME UTC bug (not yet fixed)

Three files still use `new Date().toISOString().slice(0, 10)` for the default `due_date`:

- `src/components/atomic-crm/tasks/AddTask.tsx:115`
- `src/components/atomic-crm/tasks/TaskCreateSheet.tsx:66`
- `src/components/atomic-crm/accounts/AccountShow.tsx:509`

After 5 PM PDT, `.toISOString()` gives the next UTC day. So the default due date in a new task form shows **tomorrow** instead of today. With the `date` column, this bare string gets stored and displayed as-is — meaning a task created at 6 PM on March 11 defaults to March 12.

**Fix:** Use local date arithmetic (same pattern as `localDatePlusDays(0)` in `Task.tsx`):

```ts
const today = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const due_date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
```

### 3. Deployment plan step 4 — docker command note

The plan uses `docker exec supabase_db_atomic-crm-demo psql "postgresql://...@10.0.10.228:5433/..."`. This runs psql inside the local Supabase container connecting to prod via TCP. Should work, but earlier in the session `docker run --rm -e PGPASSWORD postgres:15 psql` was used for prod queries. Either approach is valid as long as the container can reach the prod host.

---

### 4. Imported task due dates — wrong Exchange property URI (separate issue, fixed)

The original migration script used `http://schemas.microsoft.com/exchange/tasks/duedate`
which returns empty for public folder `IPM.Task` items. The correct URI is the
MAPI named property `PidLidTaskDueDate` (0x8105 in `PSETID_Task`):

```
http://schemas.microsoft.com/mapi/id/{00062003-0000-0000-C000-000000000046}/0x00008105
```

Confirmed working via WebDAV SEARCH with SQL alias on 2026-03-12.
`fetch_sample.py` updated. See `exchange-gotchas.md` and `post-migration-plan.md` Issue 1.

---

## Conclusion

The RCA and migration are correct. Issues #1 and #2 were fixed before deploying to prod. Issue #4 (imported due dates) is a separate data correction requiring re-import.
