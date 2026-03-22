# Plan: Tasks Summary View — Search Tasks by Account

## Context

Users expect to search for tasks by account number or account name on the `/tasks` main page. Currently the `tasks` table has only `account_id` (a foreign key), so search only works on `text` and `type` columns. This follows the same pattern used for `accounts_summary`, `contacts_summary`, etc.

## Steps

### Step 1: Sync prod data to local
- Run `scripts/db-sync-prod-to-local.sh` to get current prod data locally for testing

### Step 2: Create migration — `tasks_summary` view
- `npx supabase migration new tasks_summary_view`
- SQL: `CREATE VIEW tasks_summary` joining `tasks` with `accounts` (for `account_number`, `account_name`) and `users` (for assignee name)
- Pattern: `SELECT t.*, a.account_number, a.name AS account_name, u.first_name || ' ' || u.last_name AS user_name FROM tasks t LEFT JOIN accounts a ... LEFT JOIN users u ...`
- Filter: `WHERE t.deleted_at IS NULL` (and `a.deleted_at IS NULL` on the accounts join)
- Use `security_invoker=on` per existing pattern
- No GROUP BY needed — this is a 1:1 join (each task has one account, one user), not an aggregation
- Apply with `npx supabase migration up`

### Step 3: Update data provider
- **File:** `src/components/atomic-crm/providers/supabase/dataProvider.ts`
- Add `"tasks_summary"` to `SOFT_DELETE_RESOURCES` set
- Add routing in `getList()`: `if (resource === "tasks") return baseDataProvider.getList("tasks_summary", params);`
- Add routing in `getOne()`: `if (resource === "tasks") return baseDataProvider.getOne("tasks_summary", params);`
- Update `beforeGetList` for `"tasks"` to add `"account_number"` and `"account_name"` to full-text search columns

### Step 4: Verify locally
- `make typecheck && make test`
- Open the CRM, go to Tasks page, search by account number "25091801" and by name "LOPEZ" — confirm results appear
- Verify the account detail page Tasks tab still works (it also calls `getList("tasks", ...)`)

### Step 5: Verify with db-compare
- Run `scripts/db-compare.sh` to confirm local vs prod schema alignment (expect only the new view as a difference)

### Step 6: Deploy to prod
- Push migration: `npx supabase db push` (schema-only, non-destructive — just adds the view)
- Deploy frontend build (standard deploy process)

## Key files
- `src/components/atomic-crm/providers/supabase/dataProvider.ts` — data provider routing + FTS config
- `supabase/migrations/` — new migration file
- `scripts/db-sync-prod-to-local.sh` — prod-to-local data sync
- `scripts/db-compare.sh` — schema comparison
