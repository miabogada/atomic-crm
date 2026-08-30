---
name: project_payment_delete_bug
description: Five independent bugs — premature onClick handler, missing getManyReference/getOne/getMany filters, missing resource="tasks" hitting wrong table, and the PWA service worker never reloading clients on new deploys (masking that all the other fixes had actually shipped). Found/fixed 2026-08-26 to 2026-08-30.
metadata:
  type: project
---

## Bug 5: PWA service worker never reloads clients on a new deploy (found + fixed 2026-08-30, on PRODUCTION)

After bugs 1-4 were fixed, committed as 4 separate commits, and pushed to `dev` — which is production's actual deploy branch on Cloudflare Pages (custom domain `crm.tanoclark.com`, auto-deploys on push to `dev`; the repo's `.github/workflows/deploy.yml` triggering on `main` is a red herring, unrelated to the real Cloudflare Pages deployment) — the user tried deleting payment 3885 on prod for real. It still didn't work: no confirm dialog appeared at all (single click did nothing), even after a hard refresh, and even after opening a brand new tab following an unrelated Cloudflare Access hang.

Confirmed via direct prod DB query that zero delete attempts ever reached the database (`updated_at` still equals `created_at`) — meaning the browser was still running the **old, pre-fix JS bundle**, not the newly deployed one (verified the deploy itself was healthy: the exact Cloudflare Pages deployment URL for commit `6e3aff3` returned HTTP 200 directly).

**Root cause:** `vite.config.ts` sets `VitePWA({ registerType: "autoUpdate", ... })`, whose docs claim it will "reload all browser windows/tabs with the application open automatically" when a new version activates. But that reload behavior is implemented entirely inside `vite-plugin-pwa`'s `virtual:pwa-register` client helper (`wb.addEventListener("activated", ...) => window.location.reload()`), which the app never imported anywhere. With no explicit import, `injectRegister` (default `"auto"`) fell back to injecting a bare-bones `registerSW.js` that only calls `navigator.serviceWorker.register(...)` — no update detection, no reload, nothing. So `registerType: "autoUpdate"` had been silently inert since the PWA plugin was added: every deploy left already-open (and sometimes freshly-opened, if the new SW hadn't finished activating yet) tabs running stale cached code indefinitely, with zero user-facing signal and no self-healing path short of manually unregistering the service worker in DevTools.

This means **bugs 1-4 were likely working correctly in production the whole time** — the user just could never observe it, because their browser kept re-running the old broken bundle no matter how many times they reloaded.

**Fix:** `src/main.tsx` now imports `registerSW` from `virtual:pwa-register` and calls `registerSW({ immediate: true })`; `src/vite-env.d.ts` adds the `vite-plugin-pwa/client` type reference. Verified via a local `vite build` that (a) the redundant auto-injected `registerSW.js` script tag disappeared from `dist/index.html` (confirming `injectRegister: "auto"` correctly detected the explicit import), and (b) the built JS bundle now actually contains the `workbox-window`/`window.location.reload()` reload-on-activate logic. All 51 unit tests still pass. Typecheck clean.

**Committed separately:** `459b36c` — "fix: service worker never reloads clients on new deploy".

**Important operational note going forward:** any future deploy will, for the *first* time each user visits after that deploy, briefly show old content before the tab auto-reloads once (this is normal and expected — it's the same one-reload lag inherent to service worker activation, just now self-resolving instead of hanging forever). If a bug fix ever again "doesn't seem to work" in production right after a deploy, hard-refreshing twice or waiting a few seconds for the auto-reload should now be sufficient — if it still doesn't self-resolve, treat that as a new, separate incident, not a recurrence of this one.

## Bug 4: getOne/getMany also missing the deleted_at filter — leaked into "All Activity" panel (found + fixed 2026-08-29)

Found via a QA pass run by the user through the Claude for Chrome extension (a separate product from Claude Code, driving the actual browser against crm-dev) — see full report handed back as `crmdevtaskdeletefindings.md`. That pass **confirmed bug 3's fix works**: task delete from the Account page (task id 5049) and the Contract page (task id 5097) both succeeded, verified independently against PostgREST (`deleted_at` correctly stamped), with all counts/balance on account 169 unchanged (Contacts 1, Contracts 1, Tasks 3 open, Payments 9, balance $6,000 — matching the dev baseline recorded under bug 2 above).

It also surfaced a new, independent bug: both deleted tasks kept showing up in the account's "All Activity" panel (e.g. "Maria Ruiz completed task Task 1: Please do the following..."), even though every list-style fetch (`getList`/`getManyReference`, both already fixed) correctly excluded them. Root cause: the activity feed hydrates individual task references via a by-id fetch (`GET /rest/v1/tasks?id=eq.5049`), i.e. `getOne`/`getMany` — and neither of those methods had a `deleted_at` guard in `dataProvider.ts` (only `getList` and `getManyReference` did). Confirmed by hand against PostgREST: the raw by-id GET returns the row with `deleted_at` set, no filtering at all.

**Fix:** in `dataProvider.ts`, `getOne` now throws `HttpError("Not found", 404)` (imported from `ra-core`) when a fetched record for a `SOFT_DELETE_RESOURCES` type has `deleted_at` set; `getMany` (previously had no override at all) now filters deleted records out of its result array. Note: `getOne` for "accounts"/"companies"/"contacts" redirect to their `_summary` views first and return before this check runs — those views already filter `deleted_at is null` at the SQL level, so a deleted account/contact's `getOne` already naturally returns 0 rows (a different, pre-existing, acceptable "not found" path) — the new guard only applies to raw-table resources like tasks/account_payments/account_contracts/account_contacts/account_activities. Typecheck clean.

**Cleanup:** the two test tasks soft-deleted during the QA pass (ids 5049, 5097) were restored (`deleted_at` cleared) on dev after verification, per the report's own suggested cleanup step.

**Not yet verified in-browser:** this fix (getOne/getMany), same limitation as before — no browser automation available to me directly. The user's Claude-for-Chrome extension is the way to get real click-driven verification; worth a follow-up pass to confirm the "All Activity" panel now correctly hides deleted tasks (and account_payments id 3885 was flagged in the report as a good second test case for the same leak on a different resource).

**Secondary observations from the QA report (not yet acted on, lower priority):**
- Deleting a task leaves related note/activity rows behind as orphans (e.g. "Task 1 modified by Linnette Clark" survives). Undecided whether these should cascade or be relabelled.
- The "⋮" → Delete on a task has no confirm dialog — only a ~5s Undo toast (this is `useDeleteWithUndoController`'s intended "undoable" pattern, likely by design, not a bug — but flagged in case a confirm step was actually intended here like the EditSheet-based deletes have).
- Contract page (contract 285) task list "⋮" buttons sit off the right edge of the viewport at ~1449px wide, requiring horizontal scroll to reach.

## Bug 3: Task delete from Account/Contract page hits the wrong table entirely (found + fixed 2026-08-29)

User tested task delete from the Account page's task feed on 2026-08-26/27 and got a raw Postgres/PostgREST error toast: "Cannot coerce the result to a single JSON object." This is a genuine, pre-existing, **independent** bug — nothing to do with bugs 1 or 2 above.

**Root cause:** `src/components/atomic-crm/tasks/Task.tsx` (the row component behind the "⋮" dropdown → Delete on a task) calls `useDeleteWithUndoController({ record: task, redirect: false, mutationOptions: {...} })` — with **no explicit `resource` prop**. That hook resolves resource via `useResourceContext()` (ambient React context) when not given one explicitly. `<Task>` is rendered in three places with three different ambient contexts:
- `ContactAside.tsx` — wraps `<TasksIterator><Task/></TasksIterator>` inside `<ReferenceManyField reference="tasks">`, which correctly provides a "tasks" resource context. **Delete works fine here.**
- `AccountShow.tsx` (~line 847) — `<Task task={task} />` rendered in a plain `.map()` inside the account's combined task/activity feed, no `ReferenceManyField`/`ResourceContextProvider` wrapper. Ambient context falls through to `<ShowBase>`'s inferred resource, `"accounts"`.
- `ContractShow.tsx` (~line 645) — same pattern, ambient context is `"account_contracts"`.

So deleting a task from the Account or Contract page sends the delete request against the `accounts`/`account_contracts` table using the **task's** numeric id as the filter — which essentially never matches a row there, producing PostgREST's 0-rows-returned error ("Cannot coerce the result to a single JSON object", PGRST116) instead of silently no-op'ing like bugs 1/2. This is why it manifested as a visible error toast rather than a silent failure.

**How this was diagnosed:** the user couldn't recall exactly which delete path they'd used and couldn't retest immediately. No browser automation tool is available in this environment, and PostgREST/Postgres weren't logging per-request/statement detail on crm-dev, so it had to be found by static analysis: a raw SQL `UPDATE tasks SET deleted_at=... WHERE id=... RETURNING *` as the `authenticated` role confirmed a normal single-id update returns exactly 1 row (ruling out RLS/trigger causes), which narrowed it down to something wrong with *which resource/table* the request targeted rather than the query itself — leading to checking `useResourceContext` resolution at each `<Task>` call site.

**Fix:** added `resource: "tasks"` explicitly to the `useDeleteWithUndoController(...)` call in `Task.tsx`. One-line fix, no migration. Typecheck clean. Not yet manually verified in-browser (no browser tool available) — needs a real click-test on crm-dev from the Account or Contract page's task list specifically (the Contact page path was never broken).

## Bug 2: getManyReference doesn't filter soft-deleted rows (found + fixed 2026-08-26, same day as bug 1)

After fixing bug 1 below, testing on crm-dev showed the $5,500 payment (id 3885) *was* actually soft-deleted (`deleted_at` correctly set — verified via direct query) but still appeared in the UI. Second, independent bug: `src/components/atomic-crm/providers/supabase/dataProvider.ts` only injected the `deleted_at IS NULL` filter in its `getList` override — `getManyReference` (used by `ReferenceManyField`/`ReferenceManyCount`, e.g. the Payments/Contacts/Contracts/Tasks tabs on `AccountShow.tsx`, and task lists on `ContactAside.tsx`/`ContactShow.tsx`) had no override at all and fell straight through to the raw postgrest provider, showing/counting deleted rows for every `SOFT_DELETE_RESOURCES` type.

This had been silently broken since soft-delete was introduced (migration `20260308200000_soft_delete.sql`) — it just never surfaced because bug 1 meant deletes never actually set `deleted_at` in the first place for these resource types via the UI.

**Fix:** added a `getManyReference` override in `dataProvider.ts` mirroring the existing `getList` pattern — injects `"deleted_at@is": null` into `params.filter` for any resource in `SOFT_DELETE_RESOURCES`. Pure additive filter change, no migration, no DB write; prod frontend is a static Cloudflare Pages deploy so revert is trivial. Typecheck clean.

**Confirmed unaffected (already correct):** `accounts_summary` view's `balance_due`/`total_received`/etc. are computed SQL-side with `deleted_at is null` already baked into the view definition (`20260308200000_soft_delete.sql` lines 159-171), so account balance figures were never wrong — only the tab list contents and `ReferenceManyCount` badges were.

**Dev baseline for account 169 (post both fixes, before manual delete-flow testing):** payments_active=9 (payments_total=10, i.e. payment 3885 now correctly excluded), contacts_active=1, contracts_active=1, open_tasks_active=3, balance_due=6000.00.

**Bug:** Clicking Delete in several admin-only Edit sheets (Payment, Note, Task, Account Contact) appeared to succeed — toast shown (or sheet just closed silently) and the sheet closed — but the record was never actually soft-deleted; it stayed fully visible everywhere. Confirmed on prod: payment id 3885 ($5,500, account 169, contract 285) had `deleted_at` NULL and `updated_at` identical to `created_at` to the microsecond, meaning the row was never touched after creation.

**Root cause:** `src/components/admin/delete-button.tsx`'s `handleClick` — the handler for the *first* click, before any confirmation — runs the caller's `onClick` prop and only then opens the confirm dialog:

```js
const handleClick = (e) => {
  e.stopPropagation();
  onClick?.(e);          // fires immediately, pre-confirmation
  setConfirmOpen(true);   // only now would the confirm dialog open
};
```

Four call sites passed an `onClick` prop that was actually written as a *post-delete* success callback (notify + close the parent sheet). Since it fires on the pre-confirmation click instead, it closes/unmounts the `EditSheet` (and the `Confirm` dialog and `DeleteButton` inside it) before the user ever confirms. `handleConfirm` — the function that actually calls `deleteOne(...)` — never runs. The delete silently no-ops while looking successful (or, for Note/Task/Contact, looking like nothing happened at all — those call sites didn't even show a toast, just closed the sheet).

**Affected call sites (all fixed 2026-08-26):**
1. `src/components/atomic-crm/payments/AccountPaymentEditSheet.tsx` — had `onClick={() => { notify("Payment deleted"); onOpenChange(false); }}`
2. `src/components/atomic-crm/notes/NoteEditSheet.tsx` — had `onClick={() => { onOpenChange(false); }}` (no toast at all)
3. `src/components/atomic-crm/tasks/TaskEditSheet.tsx` — had `onClick={() => { onOpenChange(false); }}` (no toast at all)
4. `src/components/atomic-crm/account-contacts/ContactEditSheet.tsx` — had `onClick={() => onOpenChange(false)}` (no toast at all)

**Not affected (already used the correct pattern):** `AccountActivityEditSheet.tsx` and `TaskEdit.tsx` already put their post-delete logic in `mutationOptions.onSuccess`, which is why they worked correctly — this is the reference pattern the fix follows.

**Fix applied:** moved each site's notify/close (and, where the original `redirect` prop pointed somewhere other than `false`, an explicit `redirect(...)` call) out of `onClick` and into `DeleteButton`'s `mutationOptions.onSuccess`, so it only fires after `deleteOne` actually succeeds. Note: `mutationOptions.onSuccess` fully replaces `DeleteButton`'s default `onSuccess` (object spread, not merge) — for NoteEditSheet and ContactEditSheet, which previously relied on the default `onSuccess` calling `redirect(redirectTo, resource)` with a real path, the fix now calls `useRedirect()` explicitly inside the custom `onSuccess` to preserve that navigation. Typecheck passes clean (`npx tsc --noEmit`).

**How to apply / status:** Fixed 2026-08-26 on crm-dev (10.0.10.229) after a fresh prod→dev DB sync + backup ([[db-sync-prod-to-dev]] skill — sync completed, row counts matched prod exactly, `account_payments.id=3885` confirmed present on dev with `deleted_at` still NULL before the fix). Not yet committed/deployed to prod as of this writing. Any other "delete didn't work" reports for these 4 resource types before the fix ships almost certainly have the same root cause — check `updated_at == created_at` on the row to confirm before assuming it's something else.

**Known-affected record:** `account_payments.id = 3885` (account 169, $5,500, contract 285) — still live on prod as of 2026-08-26, needs deleting for real through the UI once the fix is deployed there (dev and prod are separate DBs — fixing/deleting on dev does not touch prod's copy).

**Commits (each fix committed separately on `dev`, so any one can be reverted independently without touching the others):**
- Bug 1 (premature `onClick`): `9e2a5e8` — "fix: delete buttons no-op because onClick fires before confirm"
- Bug 2 (`getManyReference` filter): `bb2dcdd` — "fix: getManyReference doesn't filter soft-deleted rows"
- Bug 3 (`Task.tsx` wrong table): `13c090b` — "fix: task delete from Account/Contract page hits wrong table"
- Bug 4 (`getOne`/`getMany` filter): `56dcc7a` — "fix: getOne/getMany don't filter soft-deleted rows"

None have been deployed to prod yet — all four are only on the local `dev` branch as of this writing. `npx tsc --noEmit` passes clean on the final state (verified after splitting into these 4 commits).

**Remaining checklist:**

1. User confirmed payment 3885's Delete flow via UI on crm-dev (2026-08-26) — surfaced bug 2 above, since fixed.
2. ~~Retest task delete specifically from the Account page task feed and the Contract page task list (bug 3)~~ — done 2026-08-29 via QA pass, confirmed working; surfaced bug 4, since fixed.
3. Retest the "All Activity" panel (bug 4 fix) — confirm deleted tasks 5049/5097 (restored, so re-delete to test) and payment 3885 no longer appear there.
4. Test remaining delete flows (note/account-contact) on crm-dev — see test plan given to user 2026-08-26 for exact validation targets/expected values.
5. Push `dev` and open a PR, deploy to prod as usual (no migration needed — safe for a mid-week deploy per discussion with user; only risk is broader manual-test surface, not data risk).
6. On prod: delete payment 3885 for real through the UI.
7. Optional: sweep prod for other records (payments/notes/tasks/account_contacts) where `updated_at == created_at` that a user believes they deleted — same bug-1 root cause likely applies; no audit trail exists to find these automatically, so this relies on user reports.
