# Task Due Date Timezone Bug — RCA & Fix

**Reported by:** Victor Garcia, 2026-03-11
**Symptom:** Rescheduling a task to a specific date saves it one day earlier than selected. E.g. selecting Friday April 17 results in April 16 being displayed after save. Workaround in use: enter one day later than intended.

---

## Root Cause

`tasks.due_date` was stored as `timestamptz`. Two separate code paths both produced the same off-by-one display bug for Pacific Time (PDT = UTC−7) users.

### Create path (`AddTask.tsx`, `TaskCreateSheet.tsx`, `AccountShow.tsx`)

The `transform` prop on `CreateBase` did:

```js
const dueDate = new Date(data.due_date);   // "2026-04-17" → 2026-04-17T00:00:00Z (UTC midnight)
dueDate.setHours(0, 0, 0, 0);             // in PDT: April 16 5PM → setHours → April 16 midnight PDT
return { ...data, due_date: dueDate.toISOString() }; // → "2026-04-16T07:00:00Z"
```

Stored: `2026-04-16T07:00:00Z`. Displayed: April 16. User intended: April 17.

### Edit path (`TaskEdit.tsx`, `TaskEditSheet.tsx`)

No transform touched `due_date`. `DateInput` produces a `YYYY-MM-DD` string which PostgREST cast to `timestamptz` using the Postgres session timezone (UTC):

```
"2026-04-17" → 2026-04-17T00:00:00Z (UTC midnight)
```

`DateInput`'s `convertDateToString` then formats the stored value using **local time**:

```
new Date("2026-04-17T00:00:00Z") in PDT = April 16, 5PM → "2026-04-16"
```

Stored: `2026-04-17T00:00:00Z`. Displayed: April 16. User intended: April 17.

### Postpone buttons (`Task.tsx`)

```js
new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
```

This produced a UTC date string. With the `timestamptz` column this had a compensating error that made it work accidentally. With a `date` column it would give the wrong result (UTC tomorrow ≠ local tomorrow for PDT users after 5 PM).

---

## Fix

### 1. Database migration (`20260311000000_tasks_due_date_to_date_type.sql`)

Change `tasks.due_date` from `timestamptz` to `date`. This eliminates timezone handling entirely for date-only values.

The `USING` clause recovers the correct local date from existing stored UTC timestamps:

```sql
ALTER TABLE tasks
  ALTER COLUMN due_date TYPE date
  USING (due_date AT TIME ZONE 'America/Los_Angeles')::date;
```

**Effect on existing data:** the stored date after migration will match whatever was being *displayed* in the UI before migration — including tasks where Victor's workaround was applied (those already display the correct date and continue to do so).

### 2. Remove buggy transforms (3 files)

Removed the `transform` prop from `CreateBase` in:
- `src/components/atomic-crm/tasks/AddTask.tsx`
- `src/components/atomic-crm/tasks/TaskCreateSheet.tsx`
- `src/components/atomic-crm/accounts/AccountShow.tsx`

`DateInput` already produces `YYYY-MM-DD`. With a `date` column, PostgREST stores it directly with no timezone conversion.

### 3. Postpone buttons use local date arithmetic (`Task.tsx`)

```js
const localDatePlusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
```

Replaces UTC-based arithmetic so "postpone to tomorrow" always means the user's local calendar tomorrow.

---

## Production deployment sequence

1. **`git push origin dev`** — push code changes to remote.
2. ~~**Review** `migration/output/tasks_due_date_review.csv` with staff~~ — skipped. The list goes stale as staff continue creating and editing tasks. Instead, after deployment staff should spot-check their own recent tasks and correct any dates that look off via the CRM Edit function.
3. **Dry-run test on task 4106** (Victor's reported task — RAMOS, PETRONA, "Task 0: DID CLIENT MAKE PAYMENT / Autopay below: $350") — apply the same conversion expression the migration uses in a plain SELECT, no schema change or table lock:
   ```sql
   SELECT id,
          (due_date AT TIME ZONE 'America/Los_Angeles')::date AS due_date_after_migration,
          due_date AS due_date_current,
          text,
          status
   FROM tasks
   WHERE id = 4106;
   ```
   Confirm with Victor that `due_date_after_migration` matches what he expects before proceeding.

   **Summary query** — run before applying to get a full picture of what will change:
   ```sql
   SELECT
     count(*)                                                                 AS total_tasks,
     count(*) FILTER (WHERE due_date IS NOT NULL)                            AS with_due_date,
     count(*) FILTER (WHERE
       due_date IS NOT NULL AND
       (due_date AT TIME ZONE 'America/Los_Angeles')::date != due_date::date) AS dates_that_will_change,
     count(*) FILTER (WHERE
       due_date IS NOT NULL AND
       (due_date AT TIME ZONE 'America/Los_Angeles')::date = due_date::date)  AS dates_unchanged
   FROM tasks
   WHERE deleted_at IS NULL;
   ```
4. **Apply migration to prod** (after dry-run confirmed):
   ```bash
   docker exec supabase_db_atomic-crm-demo psql \
     "postgresql://postgres:<pw>@10.0.10.228:5433/postgres?sslmode=disable" \
     -c "ALTER TABLE tasks ALTER COLUMN due_date TYPE date USING (due_date AT TIME ZONE 'America/Los_Angeles')::date;"
   ```
5. **Deploy frontend** — code changes take effect; new tasks will save and display correctly.
6. **Correct any flagged tasks** via the CRM Edit function. No SQL needed.

---

## Notes

- The `tasks_due_date_review.csv` does **not** include a "intended date" column because it cannot be determined automatically — tasks where Victor's workaround was applied already show the correct date; tasks by other staff who were unaware of the bug show a date 1 day early. Staff review is required to distinguish them.
- Imported tasks (from Exchange) are excluded from the review — they already had wrong due dates from a separate issue (Exchange WebDAV fallback to creation date; see Issue 1 in `post-migration-plan.md`).
