---
name: Don't cap invoice amount due at balance
description: Invoice amount due should not be capped at account balance — mismatches expose unallocated adjustments
type: feedback
---

Do not cap invoice `amountDue` at `accounts_summary.balance_due`. When amount due exceeds balance, it means discounts/write-offs/adjustments haven't been allocated to schedule lines. This mismatch is a useful signal for the attorney to fix allocation gaps before printing invoices.

**Why:** User explicitly rejected `Math.min(scheduleAmountDue, accountBalance)` because it hid a $3,100 unallocated discount on account 15030101. The inflated amount due prompted investigation and proper allocation.

**How to apply:** In `fetchInvoiceData.ts`, keep amount due as a pure schedule-based sum. If it looks wrong, the fix is allocating adjustments in the UI, not capping the number.
