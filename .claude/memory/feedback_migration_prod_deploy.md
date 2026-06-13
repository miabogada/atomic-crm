---
name: Migration prod deployment — follow the skill, don't over-engineer
description: Apply migration SQL files to prod directly; don't regenerate or re-backup
type: feedback
---

Follow the migration skill's Phase 4 exactly as written — apply the three SQL files to prod in order. Do not add extra steps.

**Why:** I over-complicated a prod deployment by worrying about ID mismatches between dev and prod, proposing to re-run Phase 2/3 scripts against prod, and suggesting a redundant backup. The user had to point out that (1) we just synced prod→dev so sequences are identical, (2) the sync already created a backup, and (3) this is how it's always been done.

**How to apply:**
- Before applying, do a quick sanity check: compare `MAX(id)` + `COUNT(*)` on `account_payments`, `account_contracts`, and `contract_payment_schedule` between prod and dev. If prod matches the pre-migration state (i.e. no one added data since the sync), the dev SQL is safe to apply directly.
- If sequences have diverged, that's the one case where re-running the scripts against prod is warranted. But first check — don't assume.
- If the sync already ran in the same session, skip the backup step.
