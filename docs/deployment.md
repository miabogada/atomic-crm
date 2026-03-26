# Deployment Architecture

## Overview

- **Dev (LXC)**: Proxmox LXC `crm-dev` (`10.0.10.229`) running Supabase CLI + Vite dev server
- **Dev (workstation)**: Workstation running Supabase CLI + Vite dev server (original setup, still available)
- **Prod backend**: Proxmox LXC container 703 (`crm`) running Supabase self-hosted (Docker Compose)
- **Prod frontend**: Cloudflare Pages (static site, built from git, triggered by pushes to `dev` branch)

## Infrastructure

- Proxmox host `pve2` (AMD Ryzen 5 5600X, 47GB RAM)
- LXC `crm-dev` (`10.0.10.229`): Debian 11, Docker, 4 cores, 8GB RAM, 30GB disk
  - Cloned from container 301 (`deb11docker`) — Docker/nesting already configured
  - Repo at `/home/f4rrest/Documents/clarklaw-domain/atomic-crm`
  - GitHub access via SSH deploy key (ed25519)
  - Vite dev server: `npx vite --host 0.0.0.0` to expose on LAN
  - Access from workstation: `http://10.0.10.229:5173/` (app), `http://10.0.10.229:54323/` (Studio), `http://10.0.10.229:54324/` (Inbucket)
  - Setup details: see `docs/dev-lxc-migration.md`
- LXC container 703 (`crm`): Debian 11, Docker 29.x + Compose v5, 8GB RAM, 20GB disk
  - Cloned from container 301 (`deb11docker`) — Docker/nesting already configured
  - Supabase self-hosted stack at `/opt/supabase/docker`

## Dev/Prod Separation

### Credentials

| Environment | Supabase credentials | Notes |
|---|---|---|
| Dev (workstation) | Supabase CLI defaults (well-known) | Any dev can `git clone` + `make install` + `supabase start` |
| Dev (LXC `crm-dev`) | Supabase CLI defaults (well-known) | Same as workstation, runs on `10.0.10.229` |
| Prod (container 703) | Real generated secrets | Stored in Bitwarden + Google Workspace |

Exchange/migration credentials are stored separately in Bitwarden + Google Workspace. They are only needed when running migration scripts, not by the prod Supabase instance itself.

### Schema changes (code + migrations)

Developed on workstation, committed to git, deployed to prod:

```bash
# Push schema migrations to prod
PGSSLMODE=disable npx supabase db push --db-url "postgresql://postgres:[POSTGRES_PASSWORD]@10.0.10.228:5433/postgres"
```

### Data

- **Prod is the source of truth** for data once live
- Dev uses test data or periodic snapshots from prod (`pg_dump` → restore)
- Never push dev data → prod
- Legacy migration scripts (Exchange → Supabase) should use **upsert** so they are idempotent and safe to re-run against prod

## Workflow

```
workstation or crm-dev LXC (dev)
  │
  ├─ git push ──────────────────────┬───────────────────────────┐
  ├─ npx supabase db push ──────────┤                           │
  └─ migration scripts (upsert) ────┤                           │
                                     ▼                           ▼
                          container 703 (prod backend)   Cloudflare Pages (prod frontend)
                          Supabase API + DB               static React app
                          ← users write data here         → talks to container 703 API
                          ↓
                    periodic pg_dump snapshot
                    → workstation (for realistic dev testing)
```

## Database Connections

### Local dev (Supabase CLI)

```bash
# Check status and get connection details
npx supabase status

# Direct Postgres connection
postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Dump data (data only, public schema)
npx supabase db dump --local --data-only -f /tmp/crm-data.sql

# Dump auth schema (users/identities)
npx supabase db dump --local --data-only --schema auth -f /tmp/crm-auth-data.sql
```

### Prod (container 703, 10.0.10.228)

```bash
# Direct Postgres — port 5433 bypasses Supavisor (use for migrations/restores)
# Requires PGSSLMODE=disable
PGSSLMODE=disable psql postgresql://postgres:[POSTGRES_PASSWORD]@10.0.10.228:5433/postgres

# Push schema migrations to prod
PGSSLMODE=disable npx supabase db push --db-url "postgresql://postgres:[POSTGRES_PASSWORD]@10.0.10.228:5433/postgres"

# Supabase Studio (local network only, not exposed via tunnel)
http://10.0.10.228:8000
```

Note: Port 5432 on prod maps to Supavisor (requires TLS). Use port 5433 for direct Postgres access — this requires the `docker-compose.override.yml` in `/opt/supabase/docker/` which exposes db:5432 on host:5433.

## Reproducing the Dev Environment

Everything needed is in git:

- `supabase/migrations/` — full schema history
- `supabase/config.toml` — Supabase project config
- `src/` — React app
- `migration/` — Exchange migration scripts

On a new machine:
```bash
git clone <repo>
make install
supabase start
```

The only things NOT in git (store in Bitwarden + Google Workspace):
- `migration/.env` — Exchange + Supabase credentials for migration scripts
- Prod Supabase secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`)

## Prod Credentials to Store

```
# Supabase (prod)
POSTGRES_PASSWORD=
JWT_SECRET=
ANON_KEY=
SERVICE_ROLE_KEY=

# Exchange (migration scripts)
EXCHANGE_URL=
EXCHANGE_USERNAME=
EXCHANGE_PASSWORD=

# App
SUPABASE_URL=http://[container-ip]:8000
```

Note: `ANON_KEY` and `SERVICE_ROLE_KEY` are JWT tokens derived from `JWT_SECRET`.
Generate `JWT_SECRET` first, then derive the keys using the Supabase JWT tool.
