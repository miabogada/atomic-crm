Base directory for this skill: /home/f4rrest/Documents/clarklaw-domain/atomic-crm/.claude/skills/prod-query

# Querying Production Database

## When to use
Use this skill whenever you need to read data from the production database — looking up accounts, payments, allocations, or any other data on prod.

## Connection details

- **Host**: 10.0.10.228
- **Port**: 5433
- **User**: supabase_admin
- **Database**: postgres
- **SSL**: disabled (local network)
- **Password**: Stored in user's Bitwarden under "supabase crm". Ask the user for it if not already provided in the conversation.

## How to query

Use a dockerized psql client (psql is not installed on the host):

```bash
docker run --rm -e PGPASSWORD=<PASSWORD> postgres:15 psql -h 10.0.10.228 -p 5433 -U supabase_admin -d postgres -c "YOUR SQL HERE"
```

## Important notes

- **Table names**: The contracts table is `account_contracts` (NOT `contracts`). See `docs/database-schema.md` for the full schema.
- **Views**: Use `contract_payment_schedule_view` instead of raw `contract_payment_schedule` to get computed fields (`amount_paid`, `balance_remaining`, `status`).
- **Read-only**: This skill is for SELECT queries only. Never run INSERT/UPDATE/DELETE on prod without explicit user approval.
- **Password handling**: If the user has already pasted the password in the current conversation, reuse it. Otherwise ask for it. NEVER hardcode it in files.
