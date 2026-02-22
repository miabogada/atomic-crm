# Plan: Replace contacts with account_contacts in CRM UI

## Context

The CRM has two separate contact systems: the upstream `contacts` table (generic sales CRM contacts) and the Clarklaw `account_contacts` table (immigration contacts). Currently `/contacts` nav shows the old `contacts` resource while `account_contacts` only appear within account show pages. Users should only interact with `account_contacts`. The old `contacts` resource stays in the DB but becomes hidden from the UI.

Tasks currently reference `contacts` via `contact_id` — this needs removal since in Clarklaw workflow tasks apply to accounts or contracts, not contacts.

Additionally, `account_contacts.full_name` should be split into `first_name` + `last_name` to match the `contacts` table pattern.

## Changes

### 0. DB migration: split full_name into first_name/last_name

**New migration file** `supabase/migrations/YYYYMMDDHHMMSS_split_account_contact_name.sql`:
- Add `first_name text` and `last_name text` columns to `account_contacts`
- Migrate data: split `full_name` on first space (`split_part`)
- Drop `full_name` column
- Recreate `accounts_summary` view replacing `bc.full_name` with `bc.first_name || ' ' || bc.last_name as billing_contact_name`
- `NOTIFY pgrst, 'reload schema'`

**Update `types.ts`** — `AccountContact` type: replace `full_name: string` with `first_name: string; last_name: string`

**Update `account-contacts/ContactInputs.tsx`** — Replace `full_name` TextInput with `first_name` + `last_name` side by side

**Update `account-contacts/index.ts`** — `recordRepresentation`: `${record.first_name} ${record.last_name}`

**Update `accounts/AccountInputs.tsx`** — Billing contact section:
- Rename `billing_full_name` to `billing_first_name` + `billing_last_name` in `BILLING_FIELDS`
- `stripBillingFields`: derive `accountData.name` from `billing_first_name + " " + billing_last_name`
- `BillingContactInputs`: lookup handler sets `billing_first_name`/`billing_last_name` from `data.first_name`/`data.last_name`
- Autocomplete: `optionText` becomes `(r) => r.first_name + " " + r.last_name`, filter on both fields
- Replace single "Full Name" input with two inputs (First Name, Last Name)

**Update `accounts/AccountCreate.tsx`** — When creating billing contact: `first_name: billingData.billing_first_name`, `last_name: billingData.billing_last_name`

**Update `accounts/AccountEdit.tsx`** — Same pattern: split full_name in create/update of account_contacts, and pre-fill form with `billing_first_name`/`billing_last_name`

**Update `accounts/AccountContactsList.tsx`** — Display `contact.first_name + " " + contact.last_name` instead of `contact.full_name`

Files:
- `supabase/migrations/YYYYMMDDHHMMSS_split_account_contact_name.sql` (new)
- `src/components/atomic-crm/types.ts`
- `src/components/atomic-crm/account-contacts/ContactInputs.tsx`
- `src/components/atomic-crm/account-contacts/ContactCreate.tsx`
- `src/components/atomic-crm/account-contacts/index.ts`
- `src/components/atomic-crm/accounts/AccountInputs.tsx`
- `src/components/atomic-crm/accounts/AccountCreate.tsx`
- `src/components/atomic-crm/accounts/AccountEdit.tsx`
- `src/components/atomic-crm/accounts/AccountContactsList.tsx`

### 1. New account_contacts views

**`account-contacts/ContactList.tsx`** (new) — List page showing all account_contacts
- Columns: first_name + last_name, email, phone, account (ReferenceField), contact type badge, billing badge
- "Add Contact" button → `/account_contacts/create`

**`account-contacts/ContactShow.tsx`** (new) — Detail page
- All fields + link to parent account

**`account-contacts/ContactEdit.tsx`** (new) — Edit page reusing `ContactInputs`

**`account-contacts/index.ts`** — Export list, show, edit, create views

Files:
- `src/components/atomic-crm/account-contacts/ContactList.tsx` (new)
- `src/components/atomic-crm/account-contacts/ContactShow.tsx` (new)
- `src/components/atomic-crm/account-contacts/ContactEdit.tsx` (new)
- `src/components/atomic-crm/account-contacts/index.ts` (edit)

### 2. Route nav to account_contacts, hide old contacts

**`root/CRM.tsx`**:
- `<Resource name="contacts" />` — no views, just registered for backward compat
- `<Resource name="account_contacts" {...accountContactViews} />` — full CRUD

**`layout/Header.tsx`** — Contacts tab: `to="/account_contacts"`, update path matching

**`layout/MobileNavigation.tsx`** — Contacts button: `to="/account_contacts"`. Mobile CreateButton "Contact" option: navigate to `/account_contacts/create` instead of opening old ContactCreateSheet.

Files:
- `src/components/atomic-crm/root/CRM.tsx`
- `src/components/atomic-crm/layout/Header.tsx`
- `src/components/atomic-crm/layout/MobileNavigation.tsx`

### 3. Dashboard: replace HotContacts with placeholder

**`dashboard/Dashboard.tsx`**:
- Remove HotContacts widget, replace with empty placeholder
- Remove `contacts` count check that gates DashboardStepper (the stepper depends on old contacts existing — skip it or condition on `account_contacts` instead)

Files:
- `src/components/atomic-crm/dashboard/Dashboard.tsx`

### 4. Tasks: remove contact_id references

**`tasks/TaskFormContent.tsx`** — Remove `selectContact` prop and contact ReferenceInput. Remove `contactOptionText` import.

**`tasks/Task.tsx`** — Remove `showContact` prop. Remove `contact_id` ReferenceField block. Keep `account_id` block.

**`tasks/TaskListContent.tsx`** — Remove `contact_id` ReferenceField block.

**`tasks/TaskEditSheet.tsx`** — Replace contact ReferenceField title with plain "Edit Task".

**`tasks/AddTask.tsx`** — Remove `selectContact` prop. Always set `contact_id: null`. Remove `last_seen` update logic. Remove contact RecordRepresentation in title.

**`tasks/TaskCreateSheet.tsx`** — Remove `contact_id` prop and related fetch/display/update logic.

**`tasks/TaskList.tsx`** — Remove `selectContact` from AddTask calls.

**`tasks/TasksIterator.tsx`** — Remove `showContact` prop from Task calls.

Files:
- `src/components/atomic-crm/tasks/TaskFormContent.tsx`
- `src/components/atomic-crm/tasks/Task.tsx`
- `src/components/atomic-crm/tasks/TaskListContent.tsx`
- `src/components/atomic-crm/tasks/TaskEditSheet.tsx`
- `src/components/atomic-crm/tasks/AddTask.tsx`
- `src/components/atomic-crm/tasks/TaskCreateSheet.tsx`
- `src/components/atomic-crm/tasks/TaskList.tsx`
- `src/components/atomic-crm/tasks/TasksIterator.tsx`

### 5. Make account contacts clickable from account show

**`accounts/AccountContactsList.tsx`** — Wrap name in `<Link to={/account_contacts/${contact.id}/show}>`.

## File summary

| # | File | Action |
|---|------|--------|
| 0 | `supabase/migrations/..._split_account_contact_name.sql` | new |
| 0 | `types.ts` | edit |
| 0 | `account-contacts/ContactInputs.tsx` | edit |
| 0 | `account-contacts/ContactCreate.tsx` | edit |
| 0 | `account-contacts/index.ts` | edit |
| 0 | `accounts/AccountInputs.tsx` | edit |
| 0 | `accounts/AccountCreate.tsx` | edit |
| 0 | `accounts/AccountEdit.tsx` | edit |
| 0 | `accounts/AccountContactsList.tsx` | edit |
| 1 | `account-contacts/ContactList.tsx` | new |
| 1 | `account-contacts/ContactShow.tsx` | new |
| 1 | `account-contacts/ContactEdit.tsx` | new |
| 2 | `root/CRM.tsx` | edit |
| 2 | `layout/Header.tsx` | edit |
| 2 | `layout/MobileNavigation.tsx` | edit |
| 3 | `dashboard/Dashboard.tsx` | edit |
| 4 | `tasks/TaskFormContent.tsx` | edit |
| 4 | `tasks/Task.tsx` | edit |
| 4 | `tasks/TaskListContent.tsx` | edit |
| 4 | `tasks/TaskEditSheet.tsx` | edit |
| 4 | `tasks/AddTask.tsx` | edit |
| 4 | `tasks/TaskCreateSheet.tsx` | edit |
| 4 | `tasks/TaskList.tsx` | edit |
| 4 | `tasks/TasksIterator.tsx` | edit |

## Verification

1. `supabase db reset` or apply migration — verify `account_contacts` has `first_name`/`last_name`, no `full_name`
2. `npx tsc --noEmit` — type check passes
3. Nav "Contacts" tab → `/account_contacts` showing list of account contacts
4. Create contact from list page and from account show page — both work with first_name/last_name
5. Edit/show contact pages work
6. Account create/edit billing contact section works with first_name/last_name
7. Dashboard loads without HotContacts
8. Tasks: create from `/tasks` (no contact picker), create from account show — both work
9. Task display shows account reference only, no contact reference
