# Migration Workflow — 3-Phase Import & Reconciliation

## Overview

Migrating accounts from the legacy OutlookForms/Access CRM into Atomic CRM
requires three phases to handle data quality issues in the source systems.

| Phase | What | When |
|-------|------|------|
| 1. Bulk import | Import accounts, contacts, contracts, payments from Access + Exchange | First |
| 2. Auto-associate | Link payments to contracts where possible | Immediately after Phase 1 |
| 3. Reconcile | Cross-check Exchange payment items, generate corrections | After Phase 2 |

---

## Phase 1: Bulk Import

**Script:** `migration/fetch_sample.py` (enhanced for batch mode)

Imports from two sources:
- **Access** (`billing_be.mdb`): clients, contracts, payment schedule, payments received
- **Exchange** (WebDAV): contacts, tasks, activities, contract metadata

### Balance approach

Balance is computed by Atomic CRM's `accounts_summary` view using the
`account_payments` table, NOT imported as a static number. As long as
payments are imported correctly, the balance will be correct.

### Payment import

All payments from `tblPaymentsReceived` are imported as `type = 'payment'`.
Most will have `contract_id = NULL` because the legacy system does not
associate payments with specific contracts.

---

## Phase 2: Auto-Associate Payments to Contracts

**Script:** `migration/associate_payments.py` (to be created)

After bulk import, run a post-import step to link `account_payments` records
to `account_contracts` where the association can be inferred.

### Strategy (in priority order)

#### Rule 1: Single-contract accounts

If an account has exactly one contract, all payments belong to it.

```sql
UPDATE account_payments ap
SET contract_id = (
  SELECT id FROM account_contracts ac
  WHERE ac.account_id = ap.account_id
)
WHERE ap.contract_id IS NULL
AND (SELECT count(*) FROM account_contracts ac
     WHERE ac.account_id = ap.account_id) = 1;
```

#### Rule 2: Date-range matching

For multi-contract accounts, assign payments to the contract whose date range
they fall within (using `date_opened` through next contract's `date_opened`).
This works when contracts are sequential (common case).

#### Rule 3: Amount matching against payment schedule

For accounts with overlapping/concurrent contracts (stacked payments),
compare the payment amount against the scheduled installment amounts:

- If `payment.amount` matches exactly one contract's `monthly_payment`,
  assign to that contract
- If `payment.amount` equals the sum of two contracts' `monthly_payment`
  values, this is a combined payment — leave `contract_id = NULL` and flag
  for manual review (future split-payment feature required)

#### Remaining: manual review

Payments that cannot be auto-associated are left with `contract_id = NULL`.
The attorney or staff can assign them manually via the CRM UI.

---

## Phase 3: Exchange Reconciliation

**Script:** `migration/reconcile_exchange.py` (to be created)

For each imported account, query Exchange WebDAV for `IPM.Post.Account payment`
items and compare against the imported `account_payments` records.

### What to compare

| Metric | Source: Access (imported) | Source: Exchange (authoritative) |
|--------|--------------------------|----------------------------------|
| Payment count | `count(account_payments)` | count of payment items |
| Total received | `sum(amount)` | sum of `curPayment` UserProperty |

### Discrepancy types and corrections

| Discrepancy | Root cause | Correction |
|-------------|-----------|------------|
| Exchange has reversal (-$X) not in Access | Payment correction in Outlook | Insert `type = 'refund'` record |
| Exchange has payment not in Access | Recent payment, or Access entry missed | Insert `type = 'payment'` record |
| Access has payment not in Exchange | Data entry directly in Access (rare) | Review — may need delete |
| Totals differ but counts match | Amount discrepancies on individual payments | Review individually |

### Exchange payment item extraction

Payment items are `IPM.Post.Account payment` in `/public/Account Tracking/`.
Key UserProperties (extracted via PROPFIND + regex, not WebDAV SEARCH):

- `curPayment` — payment amount (float)
- `txtDatePayment` — date string
- `txtPmtMethod` — payment method
- `txtCheckNumber` — reference number

See `migration/exchange-gotchas.md` for namespace and extraction details.

### Output

The reconciliation script should produce:

1. **Reconciliation report** (`migration/output/reconciliation_report.csv`):
   - Account number, Access total, Exchange total, delta, action needed
2. **Correction SQL** (`migration/output/reconciliation_corrections.sql`):
   - INSERT statements for refund/discount/payment records
   - Each correction includes a `notes` field explaining the source

### Attorney review step

Before applying corrections:
1. Generate the report
2. Attorney reviews accounts with remaining balance > $0
3. Attorney marks accounts for write-off (unpaid balances to forgive)
4. Write-off records are created as `type = 'write_off'` in `account_payments`

---

## Payment adjustment types (new CRM feature)

Added in migration `20260308000000_payment_adjustments.sql`.

The `account_payments.type` column supports four values:

| Type | Amount | Effect on balance | When to use |
|------|--------|-------------------|-------------|
| `payment` | positive | reduces balance | Normal payment received |
| `refund` | **negative** | increases balance | Money returned to client |
| `discount` | positive | reduces balance | Fee reduction (e.g. "lmc discount") |
| `write_off` | positive | reduces balance | Unpaid amount forgiven by attorney |

### Balance formula

```
balance_due = total_contracted - SUM(all payment amounts)
```

Refunds are stored as negative amounts. All other types are positive.
The formula works because negative refunds naturally increase the balance.

### Write-offs

Write-offs are applied at the **account level** (no contract association).
The attorney reviews remaining balances and decides which to forgive.
A write-off for the full remaining balance brings `balance_due` to $0.

### Discounts

Discounts are associated with a **contract** (via `contract_id`), following
the same pattern as regular payments. A required `notes` field documents
the reason.

---

## Known limitations / future work

### Split payments

The current data model assigns each payment to at most one contract.
When a client makes one monthly payment that covers installments on
multiple concurrent contracts, that payment cannot be split in the UI.

**Workaround for migration:** Leave such payments with `contract_id = NULL`.
The account-level balance remains correct regardless of contract association.

**Future feature:** Add a `payment_allocations` table:
```
payment_allocations (
  id, payment_id FK, contract_id FK, amount
)
```
This allows one $800 payment to be split as $400 to contract A + $400 to
contract B. The `account_payments.contract_id` column would be deprecated
in favor of the allocations table.

### Lump sum payments

A client may pay more than a single scheduled installment (e.g., pay $2,000
when the monthly payment is $400). The balance formula handles this correctly
(balance = fee - total received). The payment schedule rows for the
"covered" months remain without a linked `payment_id`, but the overall
balance is accurate.

---

## Files

| File | Purpose |
|------|---------|
| `migration/fetch_sample.py` | Phase 1: bulk import from Access + Exchange |
| `migration/fetch_active_accounts.py` | Identify active accounts + compute balances |
| `migration/associate_payments.py` | Phase 2: auto-link payments to contracts (TBD) |
| `migration/reconcile_exchange.py` | Phase 3: Exchange reconciliation (TBD) |
| `migration/active-accounts-analysis.md` | How active accounts are identified |
| `migration/exchange-gotchas.md` | Exchange WebDAV quirks |
| `supabase/migrations/20260308000000_payment_adjustments.sql` | type column + view |
