# Plan: Payment Schedule Feature

## Goal

When a contract is created with payment terms, automatically generate a payment schedule (one row per installment). This enables:
1. **Cashflow forecasting** — dashboard widget showing upcoming payments grouped by month
2. **AR identification** — overdue payments surfaced on contract detail and dashboard

---

## Phase 1: Database Migration

**File:** `supabase/migrations/20260222000001_contract_payment_schedule.sql`

### New table: `contract_payment_schedule`

```sql
create table public.contract_payment_schedule (
  id             bigint generated always as identity primary key,
  contract_id    bigint not null references account_contracts(id) on delete cascade,
  account_id     bigint not null references accounts(id) on delete cascade,
  payment_number integer not null,       -- 1 = first installment, N = last
  due_date       date not null,
  amount         numeric(10,2) not null,
  payment_id     bigint references account_payments(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.contract_payment_schedule(contract_id);
create index on public.contract_payment_schedule(due_date);
create index on public.contract_payment_schedule(account_id);
```

`payment_id` is a FK to `account_payments`. When set, the scheduled payment is considered paid. Status (upcoming/due/late/paid) is computed at query time — never stored — so it never goes stale.

### Function: `generate_payment_schedule(p_contract_id bigint)`

Logic:
1. Read `date_first_payment`, `monthly_payment`, `num_payments`, `final_payment` from `account_contracts`.
2. No-op if any required field is NULL or zero.
3. Delete existing **unpaid** schedule rows for this contract (`payment_id IS NULL`).
4. Insert N rows:
   - Payments 1..(N-1): `due_date = date_first_payment + (i-1) months`, `amount = monthly_payment`
   - Payment N: `due_date = date_first_payment + (N-1) months`, `amount = final_payment`

### Trigger: auto-generate on INSERT

`AFTER INSERT ON account_contracts` — calls `generate_payment_schedule(new.id)`.

On contract UPDATE, the "Regenerate Schedule" button (Phase 3 UI) calls the function manually. Auto-regeneration on update is not implemented in V1 to avoid overwriting paid rows accidentally.

### View: `contract_payment_schedule_view`

Joins `contract_payment_schedule` with `account_contracts` and `accounts`, adds a computed `status` column:

```
paid     → payment_id IS NOT NULL
late     → due_date < current_date AND payment_id IS NULL
due      → due_date = current_date AND payment_id IS NULL
upcoming → due_date > current_date AND payment_id IS NULL
```

Also exposes: `contract_number`, `case_type`, `account_name`, `account_number`.

### RLS Policies

Authenticated users can SELECT / INSERT / UPDATE / DELETE on `contract_payment_schedule` (same pattern as `account_payments`).

---

## Phase 2: Types

**File:** `src/components/atomic-crm/types.ts`

Add:
```typescript
export type ContractPaymentSchedule = {
  contract_id: Identifier;
  account_id: Identifier;
  payment_number: number;
  due_date: string;
  amount: number;
  payment_id?: Identifier | null;
  created_at: string;
  // From view (contract_payment_schedule_view)
  contract_number?: string;
  case_type?: string;
  account_name?: string;
  account_number?: string;
  status?: 'upcoming' | 'due' | 'late' | 'paid';
} & Pick<RaRecord, 'id'>;
```

---

## Phase 3: ContractShow — Schedule Section

**File:** `src/components/atomic-crm/contracts/ContractShow.tsx`

Add a `ContractPaymentSchedule` card that renders **above** the existing Payments card inside `ContractLinkedItems`.

The component:
- Fetches `contract_payment_schedule` filtered by `contract_id`, sorted by `payment_number ASC`.
- Shows a compact table: `#` | `Due Date` | `Amount` | `Status badge`
  - Status badge colors: paid = green, late = red, due = amber, upcoming = muted
- When `payment_id` is set, shows a link to the related payment (optional click-to-scroll).
- If the schedule is empty (e.g. existing contract without terms set), renders nothing.

**Aside button: "Regenerate Schedule"**

Add a small button in `ContractAside` that calls a Supabase RPC `generate_payment_schedule(contract_id)`. Only shown to admins. Useful after editing contract terms.

---

## Phase 4: Dashboard Widgets

### 4a. `UpcomingPayments` widget

**File:** `src/components/atomic-crm/dashboard/UpcomingPayments.tsx`

- Queries `contract_payment_schedule_view` for `status IN (upcoming, due)`, ordered by `due_date ASC`, next 90 days.
- Displays a card with:
  - **Header:** "Upcoming Payments" + total dollar amount for next 30 days
  - **Table rows:** Due Date | Account | Contract# | Amount | Status badge
  - Grouped by month with subtotals
- Truncated to ~15 rows; "See all" link to a full list (future).

### 4b. `ARLate` widget

**File:** `src/components/atomic-crm/dashboard/ARLate.tsx`

- Queries `contract_payment_schedule_view` for `status = late`, ordered by `due_date ASC`.
- Displays a card with:
  - **Header:** "Overdue Payments" + count + total overdue amount (red badge if any)
  - **Table rows:** Account | Contract# | Due Date | Amount | Days Late
  - Each row links to the contract show page.
- If no overdue rows, renders a green "All payments current" state.

### 4c. Dashboard layout

**File:** `src/components/atomic-crm/dashboard/Dashboard.tsx`

Replace the currently-empty left column (`md:col-span-3`) content with:
```
<ARLate />
<UpcomingPayments />
```

---

## Phase 5: FakeRest Generator

**File:** `src/components/atomic-crm/providers/fakerest/dataGenerator/account_contracts.ts` (or new `contract_payment_schedule.ts`)

After generating contracts, generate matching `contract_payment_schedule` entries using the same date/amount logic as the DB function. This keeps demo mode consistent.

Also register `contract_payment_schedule` and `contract_payment_schedule_view` (as `contract_payment_schedule_view`) in the FakeRest adapter's resource list so the view can be queried from the frontend.

---

## Out of Scope (V1)

- Auto-linking incoming `account_payments` to schedule rows (matching by amount+date heuristic) — V2.
- Editing a schedule row's `due_date` or `amount` individually — V2.
- Auto-regeneration on contract UPDATE (to avoid overwriting paid rows) — manually triggered instead.

---

## File Checklist

| File | Action |
|------|--------|
| `supabase/migrations/20260222000001_contract_payment_schedule.sql` | New |
| `src/components/atomic-crm/types.ts` | Add `ContractPaymentSchedule` type |
| `src/components/atomic-crm/contracts/ContractShow.tsx` | Add schedule card + regenerate button |
| `src/components/atomic-crm/dashboard/UpcomingPayments.tsx` | New widget |
| `src/components/atomic-crm/dashboard/ARLate.tsx` | New widget |
| `src/components/atomic-crm/dashboard/Dashboard.tsx` | Add new widgets to left column |
| `src/components/atomic-crm/providers/fakerest/dataGenerator/account_contracts.ts` | Generate schedule data |
