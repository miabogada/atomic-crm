---
name: Always check existing scripts and skills before ad-hoc operations
description: Before running manual SQL or ad-hoc commands against prod, check scripts/ dir and .claude/skills/ for existing tooling
type: feedback
---

Always check `scripts/` directory and `.claude/skills/` for existing automation before improvising ad-hoc approaches for production operations.

**Why:** During Bug 7 deployment, I ran raw migration SQL against prod instead of using the existing `scripts/db-sync-local-to-prod.sh` script. This caused a broken deployment that had to be rolled back. The script was documented in both `.claude/skills/db-compare/SKILL.md` and `.claude/skills/migration/SKILL.md`, but I didn't check them.

**How to apply:** Before any production deployment or database operation:
1. Check `scripts/` for existing scripts (especially `db-sync-local-to-prod.sh`, `db-sync-prod-to-local.sh`)
2. Check `.claude/skills/` for relevant skill docs
3. Only improvise ad-hoc commands if no existing tooling covers the use case
