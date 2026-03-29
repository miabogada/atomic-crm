---
name: Production query workflow
description: How to query prod DB — use dockerized psql, never guess connection details, check prod-query skill first
type: feedback
---

When needing to read data from production:

1. Use the `prod-query` skill at `.claude/skills/prod-query/instructions.md`
2. Query via: `docker run --rm -e PGPASSWORD=<pw> postgres:15 psql -h 10.0.10.228 -p 5433 -U supabase_admin -d postgres -c "SQL"`
3. Ask user for password if not already provided in conversation
4. Table `account_contracts` (NOT `contracts`). Full schema in `docs/database-schema.md`.

**Why:** Wasted cycles trying to SSH, find env files, and use local supabase-db container. The db-compare skill already documented the dockerized psql pattern — should have checked skills/memories first before improvising.

**How to apply:** Any time prod data is needed, go straight to the prod-query skill. Don't try SSH, don't look for env files, don't try local docker containers.
