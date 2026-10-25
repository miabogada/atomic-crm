# Plan: Bring the migration skill up to date + fix the deleted-payment allocation bug

This plan has two independent parts. **Do Part A first.** Part B is separate work and isn't required for Part A, nor is Part A required for it.

- **Part A — Skill cleanup:** documentation-only edits to `.claude/skills/migration/SKILL.md`. No code, schema, or data changes.
- **Part B — Deleted-payment allocation bug:** a migration, a script fix, and a one-time cleanup of prod data.

Both came out of a currency check of the migration skill on 2026-10-25. The skill itself works: the 2026-05-18 (6 accounts) and 2026-08-02 (3 accounts) batches both succeeded, and none of the migration scripts or schema have changed since the skill was last edited (~2026-04-01).

Dev (10.0.10.229) was synced from prod on 2026-10-25 22:36 UTC. Backup: `migration/backups/prod_data_2026-10-25.sql`.

---

# Part A — Skill cleanup

All edits are to `.claude/skills/migration/SKILL.md`, done as one commit.

### A1. Skill describes an old local Docker setup instead of the dev LXC

**Problem:** Phase 1 "After running" says to apply SQL with `docker exec -i supabase_db_atomic-crm-demo psql ...` and to spot-check at `http://localhost:5173`. That container doesn't exist anymore. `migration/.env` already points `SUPABASE_REST_URL` at `http://10.0.10.229:54321`.

**Fix:**
- Replace the apply command with the dev LXC equivalent:
  `export $(grep SUPABASE_DEV_PW .env.development.local) && docker run --rm -i -e PGPASSWORD=$SUPABASE_DEV_PW postgres:15 psql -h 10.0.10.229 -p 54322 -U postgres -d postgres < migration/output/sample_import.sql`
- Spot-check URL → `http://10.0.10.229:5173`.
- Change the remaining "local" wording to "dev LXC" (Phase 2 "Apply to local DB", Phase 4 "validated on local", "Syncing Prod → Local").

### A2. Skill's prod → dev sync command doesn't work as written

**Problem:** The "Syncing Prod → Local" section pipes only the prod password and `y`. It doesn't export `SUPABASE_DEV_PW`, which the script requires.

**Fix:** Delete the duplicated command and point to the `db-sync-prod-to-dev` skill, which has the working version. Keeping one copy prevents the two from drifting apart again.

### A3. Skill tells you to refresh the Access DB, but it's retired

**Problem:** The skill's "Updating the Access DB" section, the "Stale Access DB" gotcha, and the Phase 1 "verify the Access DB is current" step all say to refresh `billing_be.mdb` from EXC1DC1 before each batch. Per `.claude/memory/project_access_db_retired.md`, billing has been fully in Atomic CRM since 2026-05-18. The `.mdb` is a historical artifact: still read by `fetch_sample.py` for older accounts' payment history, but never refreshed.

**Fix:**
- Remove the "Updating the Access DB" section (or reduce it to a one-line "retired, do not refresh" note).
- Rewrite the "Stale Access DB" gotcha: the copy (last modified 2026-04-30) is frozen on purpose. Accounts or payments created after 2026-05-18 exist only in Atomic CRM, not in the `.mdb`.
- Remove the `stat` freshness check from Phase 1 "Before running".

### A4. Skill is missing two hard-won lessons, and has a dead muninndb step

**Problem:**
- (a) Re-import duplicates. `fetch_sample.py` puts `ON CONFLICT` only on `accounts`; every child table duplicates on re-apply. This is recorded only in `.claude/memory/feedback_import_sql_no_conflict.md`, along with the FK-safe delete order.
- (b) Prod deploy shortcuts. Skip the Phase 4 backup if a sync already ran this session, and do a `MAX(id)`/`COUNT(*)` check on `account_payments`, `account_contracts`, `contract_payment_schedule` instead of regenerating SQL. This is recorded only in `.claude/memory/feedback_migration_prod_deploy.md`.
- (c) Phase 5 says "Save to muninndb". The muninndb MCP server failed to connect this session. Project memory now lives in `.claude/memory/` in the repo.

**Fix:**
- Add (a) to Gotchas, with the delete order: `contract_payment_schedule` → `account_activities` → `tasks` → `account_payments` → `account_contracts` → `account_contacts` → `accounts`. The "verify target accounts don't already exist" step in Phase 1 already exists; reference it from the gotcha.
- Add (b) to Phase 4 step 1 ("Backup prod").
- Phase 5: change "Save to muninndb" → "Update `.claude/memory/` if anything non-obvious was learned" (muninndb optional, if connected).

### Part A — Verify

- Re-read the edited skill end to end and check every command, path, and URL it references still exists (`scripts/`, `migration/*.py`, `migration/.env` keys, `10.0.10.229:5173`).
- Confirm no remaining references to `supabase_db_atomic-crm-demo`, `localhost:5173`, or the EXC1DC1 refresh.

### Part A — Key files

- `.claude/skills/migration/SKILL.md`
- `.claude/memory/project_access_db_retired.md`
- `.claude/memory/feedback_import_sql_no_conflict.md`
- `.claude/memory/feedback_migration_prod_deploy.md`

---

# Part B — Deleted payments still count toward schedule "paid"

Full write-up: `.claude/memory/project_deleted_payment_allocations_bug.md`. Doesn't block new account imports (freshly imported accounts have no deleted payments).

### Problem

Soft-deleting a payment only sets `account_payments.deleted_at`. Its `payment_allocations` rows stay (the `ON DELETE CASCADE` never fires), and nothing downstream checks `deleted_at`:
- `contract_payment_schedule_view` sums all allocations per schedule row. That feeds `amount_paid`, `balance_remaining`, `status`, and through them invoices (`invoices/fetchInvoiceData.ts`).
- `ContractShow.tsx` reads raw `payment_allocations` (lines ~213, ~542) to compute per-payment "used" amounts.
- `link_payment_schedule.py` `fetch_payments()` doesn't filter `deleted_at`, and `fetch_existing_allocations()` counts deleted payments' allocations as capacity already used.

### Live impact (prod as of 2026-10-25, the only soft-deleted payment in the DB)

Account **26012501 LARA, MARIA**, contract **285**: schedule is 29 rows / $10,500, and **all 29 show `paid`**. The real (non-deleted) payments total **$5,000**. The other $5,500 is deleted payment **3885** (dated 2026-06-12, deleted 2026-08-30), which still has 17 allocations. Payment 4047 ($500, also dated 2026-06-12, entered 2026-07-24) looks like the corrected re-entry of a $500 payment mistyped as $5,500. Confirm with the user before treating it that way.

### Recommended fix: a DB trigger plus a one-time cleanup, in one migration

One fix at the source covers every consumer (view, invoices, ContractShow, scripts) without touching each of them:

1. `npx supabase migration new delete_allocations_on_payment_soft_delete`
2. Trigger function on `account_payments` `AFTER UPDATE OF deleted_at`. When `OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL`, run `DELETE FROM payment_allocations WHERE payment_id = NEW.id`.
3. In the same migration, a one-time cleanup: `DELETE FROM payment_allocations pa USING account_payments p WHERE pa.payment_id = p.id AND p.deleted_at IS NOT NULL;` (17 rows today, all payment 3885).
4. `migration/link_payment_schedule.py`: add `"deleted_at": "is.null"` to `fetch_payments()`. This guards against a payment deleted outside the app (e.g. ad-hoc SQL) and matches `associate_payments.py`.

Tradeoff: restoring a deleted payment won't bring its allocations back. That's acceptable: the UI has no restore, and the allocations can be recovered from the daily backups. The alternative (filter `deleted_at` in the view, ContractShow, and the scripts) keeps that history but fixes the same gap in 3+ places, and misses any future consumer.

### Verify on dev

- Before: `select status, count(*) from contract_payment_schedule_view where contract_id = 285 group by 1;` → 29 paid.
- `npx supabase migration up` (never `db reset`).
- After: allocations for 3885 = 0, and contract 285 shows $5,000 paid with the rest partial/late/upcoming. Check the contract page at http://10.0.10.229:5173.
- Trigger test: soft-delete a throwaway payment that has an allocation via the UI, and confirm its allocations are gone.
- `make typecheck && make test`.

### Prod

`npx supabase db push` (only after user approval, since it deletes prod rows). Then re-run the contract 285 check against prod.

### Open questions for the user

- Was payment 3885 ($5,500) a mistyped $500, with 4047 as the re-entry? If so, after the fix contract 285 will correctly show $5,000 paid of $10,500.
- Payment **3993** on the same contract is dated **2027-06-28** (entered 2026-06-29). This is probably a year typo for 2026-06-28. It's separate from this bug and not covered by this plan.
- Trigger approach (recommended) or view/consumer filtering?

### Part B — Order of work

1. Migration + script change on dev, verify, one commit.
2. Prod `db push` after approval.
3. Mark `.claude/memory/project_deleted_payment_allocations_bug.md` closed and update its `MEMORY.md` line.

### Part B — Key files

- `migration/link_payment_schedule.py` (`fetch_payments()`, line ~55)
- `supabase/migrations/20260315175141_payment_allocations.sql` (current view definition)
- `src/components/atomic-crm/contracts/ContractShow.tsx` (reads raw allocations; fixed automatically by the trigger)
- `src/components/atomic-crm/invoices/fetchInvoiceData.ts` (reads the view; fixed automatically)
- `.claude/memory/project_deleted_payment_allocations_bug.md`
