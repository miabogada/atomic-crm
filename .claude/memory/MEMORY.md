# Project Memory

## Business context

- **Timezone**: `America/Los_Angeles` (Pacific Time). Use this in any migration USING clause, date arithmetic, or timezone-aware logic.

## User workflow preferences

- **Wait for full input before acting.** When the user says "let's rethink" or raises a design question, STOP and ask — do not implement anything until they've finished giving their input. Silence or a partial message is not a green light.
- **Prod password workflow — NEVER tell the user to run scripts themselves.** Ask user to paste the prod DB password in chat, then run the command yourself via Bash tool with the password piped in non-interactively. NEVER say "you'll need to run this yourself" or suggest a separate terminal. See [feedback_prod_password.md](feedback_prod_password.md).

## Operational discipline

- **Targeted operations only:** [feedback_targeted_operations.md](feedback_targeted_operations.md) — when fixing a known subset of records, scope to just those records; don't re-run bulk scripts against all data.
- **Check existing scripts/skills first:** [feedback_check_scripts_first.md](feedback_check_scripts_first.md) — before any prod operation, check `scripts/` and `.claude/skills/` for existing tooling; don't improvise ad-hoc commands.
- **SSH commands need absolute repo path:** [feedback_ssh_script_paths.md](feedback_ssh_script_paths.md) — when running scripts over SSH to dev LXC, always `cd /home/f4rrest/Documents/clarklaw-domain/atomic-crm &&` first; root's CWD is `/root/`.
- **Import SQL child tables lack ON CONFLICT:** [feedback_import_sql_no_conflict.md](feedback_import_sql_no_conflict.md) — re-importing already-imported accounts duplicates child rows; delete in FK order first (contract_payment_schedule → activities → tasks → payments → contracts → contacts → accounts).

## Tool usage rules

- **Don't glob for files you already know exist.** Use `Read` directly for obvious paths (e.g. `README.md`, `package.json`). Glob results truncate at 100 entries and node_modules floods results, leading to wrong assumptions.
- When genuinely discovering file locations, use `mcp__jcodemunch__get_file_tree` (excludes node_modules) instead of recursive globs.
- Never assume a file doesn't exist just because it didn't appear in truncated search results.

## CRITICAL: Never destroy data
- NEVER run `npx supabase db reset`, `DROP DATABASE`, `TRUNCATE`, `rm -rf`, `git reset --hard`, or any destructive operation without explicit user approval first.
- To test migrations, use `npx supabase migration up` only — never reset.
- This rule is absolute and non-negotiable.

## Key file locations

- **Outlook screenshots**: `/home/f4rrest/Documents/clarklaw-domain/outlookforms/screenshots/`
  - `Screenshot-Outlook-Account-Tracking.png` — reference screenshot for QA of task/activity migration
- **Outlook VBScript forms**: `/home/f4rrest/Documents/clarklaw-domain/outlookforms/outlook-forms/`
- **Access DB**: `/home/f4rrest/Documents/clarklaw-domain/outlookforms/accessdb/billing_be.mdb`
- **Exchange MCP notes**: `/home/f4rrest/Documents/clarklaw-domain/outlookforms/skills/EXCHANGE_MCP_PROJECT.md`
- **Migration script**: `migration/fetch_sample.py` (credentials in `migration/.env`, gitignored)

## Database connections

- **psql is not installed on the host.** Always use dockerized psql for ALL database queries (local and prod).
- **Querying prod**: Use `prod-query` skill (`.claude/skills/prod-query/`). `docker run --rm -e PGPASSWORD=<pw> postgres:15 psql -h 10.0.10.228 -p 5433 -U supabase_admin -d postgres -c "SQL"`. See [feedback_prod_query_workflow.md](feedback_prod_query_workflow.md).
- **Full schema reference**: `docs/database-schema.md` — all tables, columns, types, views. Key gotcha: contracts table is `account_contracts` (NOT `contracts`).
- **Local dev Postgres**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Local container: `docker exec supabase_db_atomic-crm-demo psql -U postgres -c "SQL"`.
- **Prod Supabase Studio**: `http://10.0.10.228:8000` (local network only)
- Port 5433 requires `docker-compose.override.yml` at `/opt/supabase/docker/` exposing db:5432 → host:5433
- Dump local data: `npx supabase db dump --local --data-only -f out.sql`

## Migration balance & payment issues (2026-03-08)

- **Balance must use `tblPaymentsReceived`**, NOT `tblPaymentSchedule.AmtRecd` (almost never updated after retainer)
- **Payment-to-contract association**: most `tblPaymentsReceived` rows have blank `Contract` field
- **Access vs Exchange discrepancies**: Exchange has reversals/corrections not in Access; Exchange is authoritative
- **Payment types added**: `account_payments.type` column: payment, refund, discount, write_off (migration `20260308000000`)
- **Split payments**: known limitation — one payment can only link to one contract; future `payment_allocations` table planned
- See `migration/migration-workflow.md` for 3-phase import plan
- See `migration/active-accounts-analysis.md` for balance calculation details

## Infrastructure

- **Dev environment**: Proxmox LXC `crm-dev` at `10.0.10.229` (cloned from container 301 `deb11docker`)
  - Repo at `/home/f4rrest/Documents/clarklaw-domain/atomic-crm` (mirrors workstation path)
  - GitHub access via SSH deploy key (ed25519, passphrase-protected)
  - Claude Code SSH access: `ssh -i ~/.ssh/claude_code root@10.0.10.229`
  - Status: fully operational as of 2026-03-26. Use `npx vite --host 0.0.0.0` to expose dev server to LAN.
  - Plan: `docs/dev-lxc-migration.md`
- **Prod**: Proxmox LXC 703 (`crm`) at `10.0.10.228`
- **Proxmox host**: `pve2` (AMD Ryzen 5 5600X, 47GB RAM)

## Current status (as of 2026-03-15)

### Recently completed
- **Post-migration data corrections (Issues 4-6)**: account roles, credit card payments, date_opened — all applied to prod 2026-03-15 as ad-hoc SQL (not migrations). Before/after CSVs in `migration/output/fix{4,5,6}_*.csv`. `fetch_sample.py` also fixed to prevent recurrence.

### Recently completed
- **Full 82-account import** from Exchange/Access — tasks (2,516), activities (12,051 incl. post items), contracts (139), payments (1,230), contacts (82)
- **Task notes column** — `tasks.notes` stores task body/progression journal from Exchange
- **Post items import** — IPM.Post items imported as activities linked to parent tasks via `parent_type='tasks'` + `parent_id`
- **TaskView dialog** — read-only view on click, separate from checkbox; shows notes, assignee, account, dates
- **ActivityView dialog** — read-only view on click for activities; shows body, type badge, parent link
- **Activity edit uses Dialog** (not EditSheet) — smaller centered modal matching TaskEdit pattern
- **Add Activity button** in TaskView dialog footer
- **Soft delete + undelete.py** — cascade triggers, `scripts/undelete.py` with `--prod` flag, tested both directions
- Payment adjustments feature (refund, discount, write-off) — backend + UI
- DB sync scripts rewritten with trigger-disable approach + all-table verification
- Production backup cron — daily 2 AM UTC at `/opt/supabase/backups/backup-db.sh` on 10.0.10.228
- **Task owner mapping** — `tasks:owner` Exchange property → CRM `user_id` via name lookup (was previously hardcoded to admin)
- **Post item creator mapping** — "modified by {Name}" in subject → CRM `user_id`
- **`--use-cache` flag** on `fetch_sample.py` — reuses cached Exchange/Access JSON, only re-fetches Supabase IDs
- **USER-GUIDE.md** — end-user instructions for the CRM

### Pending commits
- See [project_pending_commits.md](project_pending_commits.md) — 5-commit plan for payment allocations + Bug 7 fixes, ready to commit and deploy to prod

### Next up
- Full feature backlog is in `crm-feature-requests.md` (unchecked items)

## Migration gotchas — see migration/README.md for full details

→ Details in: `migration/exchange-gotchas.md` (in the repo)

Key summary:
- Task namespace for Exchange public folders: `http://schemas.microsoft.com/exchange/tasks/` (NOT `urn:schemas:tasks:`)
- Contract payment terms are in Exchange UserProperties, NOT in tblContracts
- Contract UserProperty namespace contains `{GUID}` — Python expat rejects it; use PROPFIND + regex
- Billing contacts are in `/public/Billing Contacts/` folder, NOT Account Tracking
- Exchange WebDAV property names are case-sensitive (`homeStreet` not `homestreet`)
- Supabase service key (not publishable key) required to bypass RLS for users/contact_types tables
