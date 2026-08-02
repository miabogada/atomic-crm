@AGENTS.md
@SKILLS.md

## STRICT RULES — DO NOT VIOLATE

### NEVER destroy data without explicit user confirmation
- **NEVER** run `npx supabase db reset`, `DROP DATABASE`, `TRUNCATE`, or any destructive database operation without asking the user first and receiving explicit approval.
- **NEVER** run `git reset --hard`, `git clean -f`, `rm -rf`, or any command that deletes files or data without asking first.
- To verify a migration applies cleanly, use `npx supabase migration up` (incremental) — NEVER `db reset`.
- If you need a clean-slate test, ask the user. Do not assume it is acceptable.
