# Changelog

## 2026-03-07 — LMC feedback batch (planned)

Address feedback from LMC review covering account/contact/contract creation forms and task filters.

### Database migrations

1. **Add `role` to `users` table** — `text` column (values: `attorney`, `law_clerk`, `legal_assistant`). Backfill existing users. Used to auto-assign team fields on new account creation. When a staff member is replaced: disable the old user, assign the role to the new user. Completed tasks, activities, and closed accounts retain the original user. Only open accounts and unfinished tasks get reassigned to the new role holder.
2. **Change contract status default** — `'To do'` → `'In process'` on `account_contracts.status`. Update any existing rows with status "To do" to "In process". Remove "To do" from contract statuses only (tasks keep "To do").
3. **Add "child" to `contact_types`** — `INSERT INTO contact_types (name) VALUES ('child')`.

### Frontend changes

1. **Phone input mask** (accounts + account_contacts) — Numeric-only input, displays as `(555) 123-4567`, stores E.164 format (`+15551234567`). No DB schema change needed (already `text` columns).
2. **Hide team fields on account create** — Auto-assign `attorney_id`, `law_clerk_id`, `legal_assistant_id` by looking up users with the matching `role`. Keep fields read-only on account show page.
3. **Remove "To do" from contract statuses** — Remove from `defaultContractStatuses` array, `contractStatusColors` map, `ContractShow.tsx` fallback, and contract status filter. Contract-only; task statuses unchanged.
4. **Hide "Date first consult"** on account create form.
5. **Title case transforms** on name, street, city inputs (accounts + account_contacts).
6. **Country dropdown default to US** (accounts + account_contacts).
7. **Task filters** — Reorder "Assigned To" to first position; add filter options for all users (not just "Me"); add "Not done" composite filter (To do OR In Process OR Blocked).
8. **Fix final payment calculation bug** — When `fee - retainer` divides evenly by `monthly_payment`, final payment should be `$0` not another monthly payment. E.g. $1000 fee = $250 retainer + $150/mo × 5 + $0.

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
