# Plan: Payment Allocations (Many-to-Many) + Invoice Foundation

## Context

The current `contract_payment_schedule` table links to payments via a 1:1 `payment_id` FK. This can't handle three real-world patterns:
1. **Partial payments** — $300 paid on a $400 schedule row
2. **Lump sums** — $1500 covering 5×$300 schedule rows
3. **Split payments** — two payments ($100+$200) covering one $300 row

The current `link_payment_schedule.py` algorithm drifts when amounts don't match exactly, leaving **69 payments orphaned** (linked to contracts but not to any schedule row).

This is foundational for the **Apr 1 milestone**: generating invoices from the CRM. Invoices need a clear "amount due" vs "amount paid" per line item, which requires the allocations model.

---

## Step 1: Migration — `payment_allocations` table

**File**: `supabase/migrations/YYYYMMDD_payment_allocations.sql`

### 1a. Create junction table

```sql
CREATE TABLE public.payment_allocations (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_id     BIGINT NOT NULL REFERENCES account_payments(id) ON DELETE CASCADE,
    schedule_id    BIGINT NOT NULL REFERENCES contract_payment_schedule(id) ON DELETE CASCADE,
    amount_applied NUMERIC(10,2) NOT NULL CHECK (amount_applied > 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(payment_id, schedule_id)
);

CREATE INDEX idx_payment_allocations_schedule ON payment_allocations(schedule_id);
CREATE INDEX idx_payment_allocations_payment  ON payment_allocations(payment_id);
```

- `UNIQUE(payment_id, schedule_id)` — one allocation row per pair; adjustments update the amount, not create duplicates
- `ON DELETE CASCADE` both ways — deleting a payment or schedule row removes the allocation

### 1b. RLS + grants

```sql
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select payment_allocations"
    ON payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert payment_allocations"
    ON payment_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update payment_allocations"
    ON payment_allocations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated can delete payment_allocations"
    ON payment_allocations FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON payment_allocations TO authenticated;
GRANT ALL ON payment_allocations TO service_role;
```

### 1c. Migrate existing `payment_id` data

```sql
INSERT INTO payment_allocations (payment_id, schedule_id, amount_applied)
SELECT
    cps.payment_id,
    cps.id,
    LEAST(cps.amount, ap.amount)
FROM contract_payment_schedule cps
JOIN account_payments ap ON ap.id = cps.payment_id
WHERE cps.payment_id IS NOT NULL;
```

`LEAST()` handles drift: if a $300 payment was linked to a $400 row, record $300 applied. If a $500 payment was linked to a $300 row, record $300 (fully paid).

### 1d. Update the view

Replace the current `contract_payment_schedule_view` to compute status from allocations:

```sql
CREATE OR REPLACE VIEW public.contract_payment_schedule_view
    WITH (security_invoker = on)
AS
SELECT
    cps.id,
    cps.contract_id,
    cps.account_id,
    cps.payment_number,
    cps.due_date,
    cps.amount,
    cps.created_at,
    ac.contract_number,
    ac.case_type,
    a.name         AS account_name,
    a.account_number,
    COALESCE(alloc.total_applied, 0)          AS amount_paid,
    cps.amount - COALESCE(alloc.total_applied, 0) AS balance_remaining,
    CASE
        WHEN COALESCE(alloc.total_applied, 0) >= cps.amount THEN 'paid'
        WHEN COALESCE(alloc.total_applied, 0) > 0 THEN 'partial'
        WHEN cps.due_date < CURRENT_DATE THEN 'late'
        WHEN cps.due_date = CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
    END AS status
FROM public.contract_payment_schedule cps
JOIN public.account_contracts ac ON ac.id = cps.contract_id
JOIN public.accounts          a  ON a.id  = cps.account_id
LEFT JOIN LATERAL (
    SELECT SUM(pa.amount_applied) AS total_applied
    FROM payment_allocations pa
    WHERE pa.schedule_id = cps.id
) alloc ON TRUE;
```

Key changes from current view:
- Removes `payment_id` column
- Adds `amount_paid` and `balance_remaining`
- Adds `'partial'` status

### 1e. Update `generate_payment_schedule()` function

Currently deletes rows `WHERE payment_id IS NULL`. Change to preserve rows that have any allocations:

```sql
DELETE FROM public.contract_payment_schedule
WHERE contract_id = p_contract_id
  AND id NOT IN (
      SELECT DISTINCT schedule_id FROM payment_allocations
      WHERE schedule_id IN (
          SELECT id FROM contract_payment_schedule WHERE contract_id = p_contract_id
      )
  );
```

### 1f. Drop the old column

```sql
ALTER TABLE contract_payment_schedule DROP COLUMN payment_id;
```

All in one migration transaction — if anything fails, the whole thing rolls back.

---

## Step 2: TypeScript types

**File**: `src/components/atomic-crm/types.ts`

- Add `PaymentAllocation` type: `{ id, payment_id, schedule_id, amount_applied, created_at }`
- Update `ContractPaymentSchedule`:
  - Remove `payment_id?: Identifier | null`
  - Add `amount_paid?: number` (from view)
  - Add `balance_remaining?: number` (from view)
  - Update `status` to include `'partial'`

---

## Step 3: UI — `ScheduleTable` refactor

**File**: `src/components/atomic-crm/contracts/ContractShow.tsx` (lines 195-419)

### 3a. Data fetching
- Fetch `payment_allocations` for the contract's schedule rows (via `useGetList`)
- Build a map: `scheduleId → PaymentAllocation[]`
- For each allocation, look up the payment details from the existing `payments` list

### 3b. Replace `payment_id` logic
- `linkedPaymentIds` set → allocations-based: a payment is "used" if it has any allocation
- `hasPaid` → `schedule.some(r => (r.amount_paid ?? 0) > 0)`
- `availablePayments` → payments whose total allocated amount is less than their amount

### 3c. Status column + badges
- `paid` → green badge (unchanged)
- `partial` → amber badge showing "$X / $Y"
- `late` → **red** badge
- `due` / `upcoming` → unchanged (allocate-payment dropdown)

Status is purely about "is the obligation satisfied?" — a row paid by a discount/write-off still shows "paid". The *how* is visible in the allocation sub-rows (see 3e). If the attorney later wants a visual distinction between "paid with money" vs "waived", we can add a `waived` status by checking whether all allocations reference non-payment types — but start simple.

### 3d. Actions
- **`handleAllocate`** (was `handleLink`): Opens dropdown on unpaid/partial rows to select a payment. Creates a `payment_allocations` row with `amount_applied = min(payment.unallocated, schedule.balance_remaining)`. The "Create new payment" option stays.
- **`handleDeallocate`** (was `handleUnlink`): Deletes the allocation row for that specific sub-row
- **`handleCreateSuccess`**: Creates payment + allocation row in sequence

### 3e. Allocation sub-rows (multi-line)
When a schedule row has allocations, each allocation renders as an indented sub-row within the table showing:
- Amount applied
- Paid date (from the payment)
- Method
- Ref #
- Deallocate (×) button

For a single allocation, this is visually identical to the current single-payment display. For multiple allocations (split payments or partial top-ups), each appears as its own indented line beneath the schedule row — no collapsing or "+N" indicator.

---

## Step 4: Dashboard — Receivables widget

**File**: `src/components/atomic-crm/dashboard/Receivables.tsx`

Current filters use `"payment_id@is": null` (lines 30, 37). Replace with:
- Overdue: `{ "status@in": "(late,partial)", "due_date@lt": today }` — or use `"balance_remaining@gt": 0, "due_date@lt": today`
- Upcoming: `{ "balance_remaining@gt": 0, "due_date@gte": today, "due_date@lte": in90 }`

The `balance_remaining` column from the view makes this filter clean without cross-column comparison hacks.

Amounts displayed should use `balance_remaining` instead of `amount` so overdue totals reflect what's actually still owed.

---

## Step 5: Linking script rewrite

**File**: `migration/link_payment_schedule.py`

Rewrite `link_schedule()` to return `(schedule_id, payment_id, amount_applied)` triples instead of `(schedule_id, payment_id)` pairs. The algorithm body stays almost identical — the only change is tracking the exact dollar amounts:

```python
apply_amount = min(remaining, sched_remaining)
allocations.append((s["id"], p["id"], apply_amount))
remaining -= apply_amount
sched_remaining -= apply_amount
```

`generate_sql()` outputs `INSERT INTO payment_allocations` instead of `UPDATE contract_payment_schedule SET payment_id = ...`.

---

## Step 6: FakeRest data generator

**Files**:
- `src/components/atomic-crm/providers/fakerest/dataGenerator/contract_payment_schedule.ts` — remove `payment_id` from generated rows, add `amount_paid: 0`, `balance_remaining: amount`
- New file or addition to index: `payment_allocations` resource with sample allocation data
- `src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts` — register `payment_allocations`

---

## Step 7: Invoice generation (scope only — separate implementation)

The allocations table is the **prerequisite** for invoicing. Once this plan ships, invoice generation can be built as a follow-up:

- **`invoices` table**: `id, contract_id, account_id, invoice_number, invoice_date, due_date, total_amount, status (draft/sent/paid/void), created_at`
- **`invoice_line_items` table**: `id, invoice_id, schedule_id (nullable), description, amount`
- Invoice status computed from sum of allocations on its line items' schedule rows
- "Generate Invoice" button on ContractShow page
- PDF generation via `@react-pdf/renderer` or edge function
- This is a **separate plan** that builds on this one

---

## Deployment strategy

1. Apply migration locally: `npx supabase migration up`
2. Verify data migration (see below)
3. Deploy frontend changes, test all three patterns
4. Re-run updated `link_payment_schedule.py` to fix the 69 orphaned payments
5. Sync to prod: `npx supabase db push` (after user approval)

The migration is safe — data migration INSERT preserves all existing links as allocation rows before dropping `payment_id`. The whole migration is one transaction.

---

## Verification

```sql
-- 1. All old payment_id links became allocation rows
SELECT count(*) FROM payment_allocations;
-- Should equal: SELECT count(*) FROM contract_payment_schedule WHERE payment_id IS NOT NULL (before migration)

-- 2. Schedule statuses still correct
SELECT status, count(*) FROM contract_payment_schedule_view GROUP BY status ORDER BY 1;

-- 3. No balance regression — contract balances unchanged
-- (accounts_summary.balance_due uses account_payments directly, not allocations)

-- 4. Orphaned payments resolved after re-running link script
SELECT count(*) FROM account_payments ap
WHERE ap.contract_id IS NOT NULL
  AND ap.type = 'payment'
  AND ap.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = ap.id);
-- Should be 0 after re-running link_payment_schedule.py
```

**UI smoke tests:**
- Open a contract with linked payments → schedule renders with correct paid/partial badges
- Create a payment for less than schedule row amount → "partial" status appears
- Create one large payment, allocate across multiple rows → all show "paid"
- Dashboard Receivables shows correct overdue/upcoming counts
