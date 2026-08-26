---
name: project_payment_delete_bug
description: Deleting a payment in the Edit Payment sheet shows success but never touches the DB row — root cause identified, fix scheduled for this weekend on crm-dev
metadata:
  type: project
---

**Bug:** Clicking Delete on an account payment (Edit Payment sheet, admin-only) shows a "Payment deleted" toast and closes the sheet, but the payment is never actually soft-deleted — it stays fully visible everywhere (list, balances, etc). Confirmed on prod: payment id 3885 ($5,500, account 169, contract 285) has `deleted_at` NULL and `updated_at` identical to `created_at` to the microsecond, meaning the row was never touched after creation.

**Root cause:** `src/components/atomic-crm/payments/AccountPaymentEditSheet.tsx` (lines ~56-59) passes a premature success handler as the `onClick` prop to `DeleteButton`:

```jsx
onClick={() => {
  notify("Payment deleted");
  onOpenChange(false);
}}
```

But in `src/components/admin/delete-button.tsx`, `handleClick` — the handler for the *first* click, before any confirmation — runs `onClick?.(e)` and only then `setConfirmOpen(true)`:

```js
const handleClick = (e) => {
  e.stopPropagation();
  onClick?.(e);         // fires AccountPaymentEditSheet's onClick immediately, pre-confirmation
  setConfirmOpen(true);  // only now would the confirm dialog open
};
```

So the very first click fires the "success" notify + closes/unmounts the `EditSheet` (and everything inside it, including the `Confirm` dialog and `DeleteButton` itself) before the user ever confirms. `handleConfirm` — the function that actually calls `deleteOne(...)` — never runs. The delete silently no-ops while looking successful.

**Why:** `AccountPaymentEditSheet`'s `onClick` prop was written as if it were a post-delete success callback, but `DeleteButton.handleClick` calls it as a pre-confirmation click handler, not a post-mutation callback.

**Fix (not yet applied):** move the `notify("Payment deleted")` + `onOpenChange(false)` out of the `onClick` prop and into `DeleteButton`'s `mutationOptions.onSuccess` (or `handleConfirm`'s own `onSuccess`), so it only fires after the delete actually succeeds.

**How to apply:** Fix is planned for this weekend on crm-dev (10.0.10.229), after a fresh prod→dev DB sync + backup ([[db-sync-prod-to-dev]] skill). Do not fix directly on prod. Any other payment "delete" reports before then almost certainly have the same root cause — check `updated_at == created_at` on the row to confirm before assuming it's something else.

**Known-affected record:** `account_payments.id = 3885` (account 169, $5,500, contract 285) — still live on prod as of 2026-08-25, needs deleting for real once the fix ships.
