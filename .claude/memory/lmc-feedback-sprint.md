# LMC Feedback Sprint — Implementation Notes

Plan is in CHANGELOG.md under "2026-03-07 — LMC feedback batch (planned)".

## DB Migrations Needed

### 1. Add `role` to `users`
- Add `role text` column to `users` table
- Backfill: fcc@tanoclark.com (id=1) = no role (admin/dev), lmc@tanoclark.com (id=2) = attorney, assistant@tanoclark.com (id=3) = law_clerk, clerk@tanoclark.com (id=4) = legal_assistant
- Used for auto-assign on account create: lookup user by role → set attorney_id, law_clerk_id, legal_assistant_id
- On staff replacement: disable old user, assign role to new user, reassign open accounts + unfinished tasks only

### 2. Change contract status default
- `ALTER TABLE account_contracts ALTER COLUMN status SET DEFAULT 'In process';`
- `UPDATE account_contracts SET status = 'In process' WHERE status = 'To do';`
- Contract-only. Tasks keep "To do".

### 3. Add "child" contact type
- `INSERT INTO contact_types (name) VALUES ('child');`

## Frontend Changes

### Phone input mask
- Accounts: `phone` field (text) in `AccountInputs.tsx`
- Account contacts: `phone` field (text) in `account-contacts/ContactInputs.tsx`
- Store as E.164 (`+15551234567`), display as `(555) 123-4567`
- No DB schema change needed

### Hide team fields on account create
- `AccountTeamInputs` in `accounts/AccountInputs.tsx` (lines 107-162)
- 4 fields: attorney_id, law_clerk_id, legal_assistant_id, user_id (Account Manager)
- Hide first 3 on create, auto-assign by role lookup
- Keep read-only on show page (`AccountAside.tsx` lines 48-90)
- Account Manager (user_id) stays required

### Remove "To do" from contract statuses
- `defaultContractStatuses` in `root/defaultConfiguration.ts` (line 97)
- `contractStatusColors` in `misc/statusColors.ts`
- `ContractShow.tsx` line 605: fallback `value={record.status || "To do"}` → change to "In process"
- `ContractInputs.tsx` line 51: status select choices
- `ContractListFilter.tsx` line 11: status filter buttons
- FakeRest: `dataGenerator/account_contracts.ts` line 36

### Other frontend
- Hide `date_first_consult` on account create form
- Title case on name/street/city inputs (accounts + account_contacts)
- Country dropdown default to US (accounts + account_contacts)
- Task filters: reorder Assigned To first, all-users filter, "Not done" composite
- Final payment bug: check `trg_fn_generate_payment_schedule` trigger and/or frontend calc

## Key Files
- Account form: `src/components/atomic-crm/accounts/AccountInputs.tsx`
- Account aside: `src/components/atomic-crm/accounts/AccountAside.tsx`
- Account create: `src/components/atomic-crm/accounts/AccountCreate.tsx`
- Contact form: `src/components/atomic-crm/account-contacts/ContactInputs.tsx`
- Contract inputs: `src/components/atomic-crm/contracts/ContractInputs.tsx`
- Contract show: `src/components/atomic-crm/contracts/ContractShow.tsx`
- Contract list filter: `src/components/atomic-crm/contracts/ContractListFilter.tsx`
- Default config: `src/components/atomic-crm/root/defaultConfiguration.ts`
- Status colors: `src/components/atomic-crm/misc/statusColors.ts`
- Task list filter: `src/components/atomic-crm/tasks/TaskListFilter.tsx`
- Payment schedule trigger: check in migration `20260222000001_contract_payment_schedule.sql`
