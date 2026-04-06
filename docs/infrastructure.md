# Infrastructure & Recovery

Quick reference for the physical infrastructure and how to bring services back up after an outage (e.g., power loss).

For full deployment architecture, credentials, and workflow details, see [deployment.md](deployment.md).

## Hosts

| Name | IP | LXC ID | Role | Key Services |
|---|---|---|---|---|
| `crm` | 10.0.10.228 | 703 | Production | Supabase (Docker Compose), Nginx, PostgreSQL :5433 |
| `crm-dev` | 10.0.10.229 | 705 | Development | Supabase CLI (Docker), Vite dev server, PostgreSQL :54322 |
| `pve2` | — | — | Proxmox host | AMD Ryzen 5 5600X, 47GB RAM |

## Ports

| Service | Prod (10.0.10.228) | Dev (10.0.10.229) |
|---|---|---|
| PostgreSQL (direct) | 5433 | 54322 |
| Supabase API (Kong) | 8000 | 54321 |
| Supabase Studio | 8000 | 54323 |
| Inbucket (email) | — | 54324 |
| Vite dev server | — | 5173 |
| Nginx (frontend) | 80 | — |

## Recovery After Power Outage

### 1. Start the LXC containers on Proxmox

From the Proxmox web UI or CLI on `pve2`:

```bash
pct start 703          # prod
pct start 705          # crm-dev
```

### 2. Verify databases are up

From the workstation (or any machine on the LAN):

```bash
# Prod
docker run --rm postgres:15 pg_isready -h 10.0.10.228 -p 5433

# Dev
docker run --rm postgres:15 pg_isready -h 10.0.10.229 -p 54322
```

Both should report `accepting connections`.

### 3. Prod services

Prod runs Supabase via Docker Compose in `/opt/supabase/docker`. Docker is configured to restart containers automatically, so after the LXC starts, the Supabase stack (PostgreSQL, Kong, GoTrue, etc.) and Nginx should come up on their own.

Verify:

```bash
ssh root@10.0.10.228
docker ps                # all Supabase containers should be running
systemctl status nginx   # should be active
```

The prod frontend is served by Cloudflare Pages (static), so it's unaffected by local outages. The Nginx on 10.0.10.228 is only used for LAN access.

### 4. Dev services

The database (Supabase CLI Docker containers) should auto-start with Docker. However, **the Vite dev server does NOT auto-start** — it must be launched manually.

```bash
ssh root@10.0.10.229

# Check Supabase containers
docker ps

# If Supabase containers are not running:
cd /home/f4rrest/Documents/clarklaw-domain/atomic-crm
npx supabase start

# Start the Vite dev server (use tmux so it survives SSH disconnect)
tmux
npx vite --host 0.0.0.0
# Ctrl+B, D to detach
```

Access from workstation:
- App: http://10.0.10.229:5173/
- Supabase Studio: http://10.0.10.229:54323/

### 5. Workstation (sshfs mount)

The sshfs mount does not survive a reboot. Remount after the LXC is up:

```bash
sshfs root@10.0.10.229:/home/f4rrest/Documents/clarklaw-domain/atomic-crm \
  ~/Documents/clarklaw-domain/atomic-crm
```

## Future Improvement

Create a systemd service on `crm-dev` to auto-start Vite on boot, eliminating the manual step in recovery.
