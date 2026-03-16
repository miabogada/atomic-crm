---
name: Bug 7 + allocations deployment status
description: Payment allocations schema, bug fixes, balance formula, sync logging — all committed and deployed to prod 2026-03-15
type: project
---

All 5 commits completed and pushed to origin/dev on 2026-03-15:
1. Payment allocations schema + correct schedule formula
2. Link script full rebuild
3. Balance formula fix (ContractShow + ContractListContent)
4. Sync logging (db-sync-prod-to-local.sh)
5. Docs (CHANGELOG, post-migration-plan, crm-feature-requests, memory files, fetch_sample)

Deployed to production via `scripts/db-sync-local-to-prod.sh`. Verified: all row counts match.

**Why:** Bug 7a (schedule formula), 7b (11 misassigned payments), LMC reclassification, 31 missing post-migration payments, balance formula, sync logging.

**How to apply:** No action needed — this is a historical record. If rollback is needed, see CHANGELOG.md rollback caveat about balance formula commit bundling type filter + write-off subtraction.
