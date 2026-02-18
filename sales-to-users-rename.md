# Sales → Users Rename (2026-02-19)

## Summary

Renamed the `sales` table/resource to `users` across the entire stack. The `sales` nomenclature was inherited from the upstream atomic-crm (a generic CRM where "sales" = salespeople). For Clarklaw it's confusing — the `/sales` route showed a "Sales" headline for what are actually system users (attorneys, law clerks, legal assistants).

## What Changed

### Database
- **Migration:** `supabase/migrations/20260219000000_rename_sales_to_users.sql`
- `ALTER TABLE "public"."sales" RENAME TO "users"` — FKs, indexes, constraints auto-update
- Recreated functions that reference the table by name string: `handle_new_user()`, `handle_update_user()`, `set_sales_id_default()`
- Recreated `init_state` view
- Added `NOTIFY pgrst, 'reload schema'` to flush PostgREST schema cache

### What was NOT renamed (deliberate scope limit)
- **`sales_id` column** — kept everywhere (accounts, contacts, companies, tasks, notes, etc.) to avoid a massive FK/index/RLS/query rewrite
- **`Sale` / `SalesFormData` TypeScript types** — internal, not user-visible
- **`salesCreate` / `salesUpdate` data provider methods** — call edge functions, not the table directly
- **`getUserSale()` function name** in edge functions — kept to avoid breaking imports

### Supabase Edge Functions
- `supabase/functions/_shared/getUserSale.ts`: `.from("sales")` → `.from("users")`
- `supabase/functions/users/index.ts`: all `.from("sales")` → `.from("users")`

### Auth Providers
- `providers/supabase/authProvider.ts`: `.from("sales")` → `.from("users")`
- `providers/fakerest/authProvider.ts`: `.getList("sales")` → `.getList("users")`

### React Components (42 files total)
- **Directory rename:** `sales/` → `users/` with file renames:
  - `SaleName.tsx` → `UserName.tsx`, `SalesList.tsx` → `UsersList.tsx`, etc.
- **Resource:** `<Resource name="sales">` → `<Resource name="users">` in CRM.tsx
- **Route:** `/sales` → `/users`
- **`reference="sales"` → `reference="users"`** in 16 component files (accounts, contacts, companies, tasks, notes, activity log modules)
- **`SaleName` → `UserName`** import + JSX usage in 10 files
- **Data providers:** all `"sales"` string literals → `"users"` in fakerest dataProvider, dataGenerator
- **Import system:** `useImportFromJson.ts` — JSON paths (`$.sales.*` → `$.users.*`), TYPES array, switch cases, stats/failures type properties, defaults
- **Import sample JSON:** `"sales"` key → `"users"` key
- **Settings page:** `useGetOne("sales")` → `useGetOne("users")`
- **Header/canAccess:** resource checks updated

## PostgREST Schema Cache Bug

After `ALTER TABLE RENAME`, PostgREST keeps the old table name in its schema cache. Queries to the new name fail with:

> "could not find the table 'public.users' in the schema cache"

This also breaks all `ReferenceField` components using `reference="users"` (e.g., the task assignee display) since they silently fail to fetch the referenced record.

**Fix:** Add `NOTIFY pgrst, 'reload schema'` at the end of any migration that renames tables or changes the schema in ways PostgREST needs to know about. Alternatively, `supabase db reset` or restarting containers also clears the cache.

## Commits
- `927fa62` — Rename sales table and resource to users across entire codebase
- `bf473af` — Add PostgREST schema cache reload to sales→users migration
