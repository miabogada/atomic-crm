# Clarklaw CRM Setup

Fork of [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm) customized for the Clarklaw immigration law office.

## Prerequisites

- Node 22 LTS
- Docker (for local Supabase)
- Make

## Quick Start

```bash
cd ~/Documents/clarklaw-domain/atomic-crm
make install    # npm install
make start      # starts Supabase (Docker) + Vite dev server
```

- App: http://localhost:5173/
- Supabase Studio: http://localhost:54323/
- First user to sign up becomes admin

## What Was Customized

### Database Schema (`supabase/migrations/20260217000000_clarklaw_schema.sql`)

New tables replacing the Exchange 2003 public folder + Outlook forms CRM:

| Table | Replaces | Purpose |
|---|---|---|
| `contact_types` | — | Lookup: petitioner, beneficiary, billing, spouse, employer, other |
| `accounts` | `IPM.Post.Account info` + `tblClients` | Master account records with team assignment FKs |
| `account_contacts` | `IPM.Contact.Account contact` | Contacts per account with type and billing flag |
| `account_contracts` | `IPM.Post.Account contract` + `tblContracts` | Legal service contracts |
| `account_tasks` | `IPM.Task.Account task` | Tasks with polymorphic threading |
| `account_activities` | `IPM.Activity.Account activity` | Activities/notes with polymorphic threading |

Key design decisions:
- **No address on accounts** — billing contact's address serves as the account address (via `accounts_summary` view join)
- **Partial unique index** enforces at most one billing contact per account
- **Polymorphic threading** via `parent_type` + `parent_id` on tasks and activities enables nesting under contracts, other tasks, etc.
- **`generate_account_number()`** PL/pgSQL function implements `YYMMDD##` auto-generation matching the legacy VBScript logic

### Configuration (`src/components/atomic-crm/root/defaultConfiguration.ts`)

- Title: "Clarklaw CRM"
- Task types: Email, Call, Meeting, Follow-up, Document Review, Filing, Court Date, Client Request
- Case types: 17 immigration case types (Adjustment of Status, Consular Processing, Naturalization, etc.)
- Activity types: call, email, meeting, document, note, payment
- Account categories: In Process, Closed, Archived, Consultation Only

### TypeScript Types (`src/components/atomic-crm/types.ts`)

Added: `Account`, `ContactType`, `AccountContact`, `AccountContract`, `AccountTask`, `AccountActivity`

### Data Provider (`src/components/atomic-crm/providers/supabase/dataProvider.ts`)

Added `accounts` → `accounts_summary` view mapping (same pattern as companies/contacts).

### UI Components (`src/components/atomic-crm/accounts/`)

| File | Purpose |
|---|---|
| `index.tsx` | Resource registration (list, show, edit, create) |
| `AccountList.tsx` + `AccountListContent.tsx` | Account list with initials avatar, status badge, counts |
| `AccountShow.tsx` | Detail view with tabs: Contacts, Contracts, Tasks, Activities |
| `AccountEdit.tsx` + `AccountCreate.tsx` | Forms; create auto-generates account number via Supabase RPC |
| `AccountInputs.tsx` | Shared form fields (account, dates, team, misc) |
| `AccountAside.tsx` | Sidebar: status, team, billing address |
| `AccountContactsList.tsx` | Contacts tab with type badges and billing flag |
| `AccountContractsList.tsx` | Contracts tab with fee/payment info |
| `AccountTasksList.tsx` | Tasks tab with due date and status |
| `AccountActivitiesList.tsx` | Activities tab with type and date |

### Navigation (`src/components/atomic-crm/layout/Header.tsx`)

Added "Accounts" tab between Dashboard and Contacts.

### Resources (`src/components/atomic-crm/root/CRM.tsx`)

Registered: `accounts`, `account_contacts`, `account_contracts`, `account_tasks`, `account_activities`, `contact_types`

Stock resources (deals, companies, contacts) kept for reference.

## Testing End-to-End

1. `make start` from the `atomic-crm` directory
2. Sign up (first user becomes admin)
3. Navigate to Accounts tab, create an account (number auto-generates)
4. Add contacts with types (petitioner, beneficiary, billing)
5. Add contracts, tasks, activities
6. Verify billing contact address appears on account view
7. Verify partial unique index: setting two billing contacts on same account should fail

## Architecture

```
Account (accounts)
├── Account Contact (account_contacts) — with contact_type and billing flag
├── Account Contract (account_contracts)
├── Account Task (account_tasks) — optional parent_type/parent_id threading
└── Account Activity (account_activities) — optional parent_type/parent_id threading
```

The `sales` table (from stock Atomic CRM) is used for team assignment: attorney, law clerk, legal assistant, and account manager.
