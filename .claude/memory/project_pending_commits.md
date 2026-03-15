---
name: Pending commits for Bug 7 + allocations work
description: 5-commit plan for payment allocations schema, bug fixes, and docs — ready to commit on dev, then deploy to prod
type: project
---

5 commits planned (4 code + 1 docs), all on dev branch:

1. **Payment allocations schema + correct schedule formula** — `supabase/migrations/20260315175141_payment_allocations.sql`, `migration/payment-allocation-many-to-many-plan.md`, `src/components/atomic-crm/types.ts`, FakeRest generators (`contract_payment_schedule.ts`, `index.ts`, `types.ts`), `src/components/atomic-crm/payments/AccountPaymentInputs.tsx`, `src/components/atomic-crm/payments/PaymentRow.tsx`, `src/components/atomic-crm/dashboard/Receivables.tsx`

2. **Link script full rebuild** — `migration/link_payment_schedule.py` (full clear+rebuild instead of incremental; no existing allocations)

3. **Balance formula fix** — `src/components/atomic-crm/contracts/ContractShow.tsx`, `src/components/atomic-crm/contracts/ContractListContent.tsx` (filter Received to type=payment, subtract write-offs/discounts from balance). Rollback caveat: type filter and write-off subtraction are in same lines — rolling back removes both.

4. **Sync logging** — `scripts/db-sync-prod-to-local.sh` (append timestamp to `migration/backups/sync.log`)

5. **Docs** — `CHANGELOG.md`, `migration/post-migration-plan.md`, `crm-feature-requests.md`, `.claude/memory/` files, `migration/fetch_sample.py`

**Why:** Bug 7a (schedule formula), 7b (11 misassigned payments), LMC CLOSE/REOPEN reclassification, 31 missing post-migration payments, balance formula, sync logging.

**How to apply:** Commit in order 1-5, then deploy to prod per steps in post-migration-plan.md Issue 7.
