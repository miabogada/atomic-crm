# Changelog

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
