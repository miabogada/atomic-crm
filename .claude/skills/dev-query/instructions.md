Base directory for this skill: /home/f4rrest/Documents/clarklaw-domain/atomic-crm/.claude/skills/dev-query

# Querying Dev Database

## When to use
Use this skill whenever you need to read or write data on the dev database. This is the DEFAULT database for all queries unless the user explicitly says "prod" or "production".

## BEFORE writing any SQL

**Always read `docs/database-schema.md` first** to verify table and column names. Key gotchas:
- The contracts table is `account_contracts` (NOT `contracts`)
- Contacts are in `account_contacts` (NOT `contacts`)
- Use `contract_payment_schedule_view` for computed fields (`amount_paid`, `balance_remaining`, `status`)
- All FK columns use `_id` suffix (e.g. `account_id`, `user_id`)

Do NOT guess column names. If you're unsure, check the schema doc.

## Connection details

- **Host**: 10.0.10.229 (dev LXC — NEVER use localhost or start local Supabase)
- **Port**: 54322
- **User**: postgres
- **Password**: postgres
- **Database**: postgres
- **Container**: `supabase_db_atomic-crm-demo` (runs on the dev LXC)

## How to query

SSH into the dev LXC and exec into the Supabase Postgres container:

```bash
ssh -i ~/.ssh/claude_code root@10.0.10.229 "docker exec supabase_db_atomic-crm-demo psql -U postgres -d postgres -c \"YOUR SQL HERE\""
```

For multi-line or complex SQL, use a heredoc:

```bash
ssh -i ~/.ssh/claude_code root@10.0.10.229 'docker exec supabase_db_atomic-crm-demo psql -U postgres -d postgres -c "
SELECT ...
FROM ...
WHERE ...
"'
```

## Important notes

- **NEVER start local Supabase** (`npx supabase start`) to query dev data. Dev runs on 10.0.10.229.
- **NEVER guess schema** — read `docs/database-schema.md` before writing queries.
- **Write operations**: INSERT/UPDATE/DELETE are allowed on dev (it's the dev environment), but still confirm destructive operations with the user.
