# Changelog

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
