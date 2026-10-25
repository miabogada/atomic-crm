---
name: project_deleted_payment_allocations_bug
description: OPEN (found 2026-10-25) — soft-deleting a payment leaves its payment_allocations rows in place, and contract_payment_schedule_view doesn't filter by deleted_at, so schedule rows keep showing "paid" from a deleted payment. link_payment_schedule.py has the same gap. Live on prod for payment 3885 (account 26012501).
metadata:
  type: project
---

## Status: OPEN — recorded, not fixed (2026-10-25)

Found while checking the [[migration]] skill is current. Confirmed against dev right after a full prod→dev sync on 2026-10-25, so the data below matches prod as of that date.

## Symptom

Payment **3885** (account **26012501 LARA, MARIA**, contract 285, $5,500, received 2026-06-12) was soft-deleted on 2026-08-30. That delete was the target of the 5-bug saga in [[project_payment_delete_bug]]. It still has **17 `payment_allocations` rows totaling $5,500**, and all 17 schedule rows they point at show status **`paid`** in `contract_payment_schedule_view`. The schedule for that contract says it's paid, but the money behind it has been deleted.

As of 2026-10-25 this is the only soft-deleted payment in the DB (`select count(*) from account_payments where deleted_at is not null` → 1), so 3885 is the full extent of the bad data right now. Every future payment soft-delete will cause the same problem.

## Root cause (three spots, same gap)

1. **Delete path:** soft-delete only sets `account_payments.deleted_at`. Allocations are removed only by `ON DELETE CASCADE` (`payment_allocations_payment_id_fkey`), and that never fires because the row is never hard-deleted.
2. **`contract_payment_schedule_view`** (defined in `supabase/migrations/20260315175141_payment_allocations.sql`): the `LEFT JOIN LATERAL` sums `payment_allocations.amount_applied` by `schedule_id` without joining `account_payments`, so `deleted_at` is never checked. That sum feeds `amount_paid`, `balance_remaining` and `status`. The view was written a week after soft-delete was added (20260308200000) but never took it into account.
3. **`migration/link_payment_schedule.py`:**
   - `fetch_payments()` filters `contract_id=not.is.null` and `type=eq.payment`, but not `deleted_at=is.null`, so a deleted payment can get new allocations.
   - `fetch_existing_allocations()` loads allocations from deleted payments as well, so they count as "already paid" and take up schedule capacity in incremental mode.
   - `associate_payments.py` *does* filter `deleted_at` (line ~84), so this is a gap in one script, not a pattern shared by all of them.

## Fix options (not yet decided — ask the user)

- **View-side (smallest change):** in the lateral subquery, join `account_payments p on p.id = pa.payment_id` and add `where p.deleted_at is null`. This fixes 3885 and all future deletes without touching data. Other places that read `payment_allocations` directly (e.g. invoice generation, the ContractShow allocate dropdown) should be checked for the same gap.
- **Data-side:** delete allocations when a payment is soft-deleted (trigger, or in the dataProvider delete). One-off cleanup for 3885: `delete from payment_allocations where payment_id = 3885;` (17 rows). A plain DELETE also loses the record of what was allocated, so restoring the payment later wouldn't bring the allocations back.
- In both cases, add `"deleted_at": "is.null"` to `fetch_payments()` in `link_payment_schedule.py`, and filter deleted payments' allocations out of `fetch_existing_allocations()`.

**How to apply:** This needs a migration (view change) and/or prod data cleanup, so get the user's approval before touching prod. Doesn't block new [[migration]] imports (freshly imported accounts have no deleted payments), but fix it before relying on schedule status for account 26012501.
