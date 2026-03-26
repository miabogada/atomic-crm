# Plan: Move Dev Environment to Proxmox LXC

## Context

Dev currently runs directly on the workstation, exposing it to supply chain attacks via npm/pip packages. Production already runs on Proxmox LXC 703 (cloned from container 301 `deb11docker`). Moving dev to its own LXC isolates the workstation from untrusted code execution while keeping the same proven stack.

## Step-by-step

### 1. Create the LXC on Proxmox

- Clone container 301 (`deb11docker`) — same base as prod (Debian 11, Docker/nesting pre-configured)
- Allocate: **4 cores, 8GB RAM, 30GB disk** (similar to prod's 8GB/20GB but extra disk for node_modules + Docker images)
- Assign a static IP on the 10.0.10.x network (e.g. `10.0.10.229`)
- Name it something like `crm-dev`

### 2. Install dependencies inside the LXC

```bash
apt-get update && apt-get install -y git make python3 curl mdbtools

# Node.js v22 (via nvm or nodesource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Docker should already be available from the deb11docker base
# Verify:
docker --version
docker compose version
```

### 3. Clone the repo and install

```bash
git clone <repo-url> /root/atomic-crm   # or wherever you prefer
cd /root/atomic-crm
make install
```

### 4. Configure environment files

Copy from workstation (these are gitignored):
- `migration/.env` — Exchange + Supabase credentials (update `SUPABASE_REST_URL` to `http://localhost:54321`)
- `supabase/functions/.env` — already committed, no action needed

The `.env.development` is already in git and uses `127.0.0.1:54321` which is correct for local dev.

### 5. Start the stack

```bash
make start   # supabase start + vite dev
```

### 6. Make Vite accessible from your workstation browser

Edit `vite.config.ts` or use the CLI flag — Vite needs to listen on `0.0.0.0` instead of `localhost`:

Option A (one-time): `npx vite --host 0.0.0.0`
Option B (permanent): Add `server: { host: '0.0.0.0' }` to vite config

Then access from workstation at: `http://10.0.10.229:5173/`

Supabase Studio will also be at: `http://10.0.10.229:54323/`

**Important:** The frontend `.env.development` points Supabase API to `http://127.0.0.1:54321`, but when accessed from your workstation browser, the browser needs to reach the API too. Update `.env.development`:
```
VITE_SUPABASE_URL=http://10.0.10.229:54321
```

### 7. Copy the Access DB file

The migration scripts need `billing_be.mdb`. Copy it to the LXC:
```bash
scp /home/f4rrest/Documents/clarklaw-domain/outlookforms/accessdb/billing_be.mdb root@10.0.10.229:/root/
```
Update `migration/.env` `MDB_PATH` to the new path.

### 8. SSH workflow from workstation

```bash
ssh root@10.0.10.229
cd /root/atomic-crm
# Claude Code, vim, etc. all run here
```

### 9. Update deployment docs

Update `docs/deployment.md` to reflect the new dev environment location.

### 10. Clean up workstation (optional, after verifying everything works)

- Remove Node.js, Docker, Python dev dependencies
- Keep only SSH client and browser

## What does NOT change

- Production (container 703) — untouched
- Git remote — same repo, just cloned on a different machine
- Deployment workflow — `db push`, `git push` all work the same from the LXC
- Exchange server access — already on `10.0.0.12`, reachable from the 10.x network

## Phase 2: sshfs hybrid setup

Steps 1–7 above provision the LXC. This phase switches to a hybrid model where Claude Code runs on the workstation but all files, runtime, and Docker live on the LXC.

### Architecture

- **LXC (`crm-dev`, 10.0.10.229)**: owns the repo (`.git`, `node_modules`, Docker/Supabase, Vite)
- **Workstation**: mounts the LXC project dir via sshfs, runs Claude Code against the mount. No Node, Docker, or repo clone needed locally.
- File edits on the workstation go directly to the LXC filesystem. Vite HMR picks up changes instantly.
- Git commands run through the sshfs mount (slightly slower over LAN, but fine).

### Steps

#### 1. Install sshfs on the workstation

```bash
sudo apt-get install -y sshfs
```

#### 2. Stop local Supabase on the workstation (if running)

```bash
docker stop $(docker ps -q --filter "name=supabase")
```

#### 3. Rename the local repo out of the way

```bash
mv ~/Documents/clarklaw-domain/atomic-crm ~/Documents/clarklaw-domain/atomic-crm.bak
mkdir ~/Documents/clarklaw-domain/atomic-crm
```

#### 4. Mount the LXC project dir via sshfs

```bash
sshfs root@10.0.10.229:/home/f4rrest/Documents/clarklaw-domain/atomic-crm \
  ~/Documents/clarklaw-domain/atomic-crm
```

Verify: `ls ~/Documents/clarklaw-domain/atomic-crm` should show the repo from the LXC.

#### 5. Verify Claude Code and git work through the mount

```bash
cd ~/Documents/clarklaw-domain/atomic-crm
git status
git log --oneline -3
```

#### 6. Start Supabase + Vite on the LXC

```bash
ssh -i ~/.ssh/claude_code root@10.0.10.229
cd /home/f4rrest/Documents/clarklaw-domain/atomic-crm
make start
npx vite --host 0.0.0.0
```

#### 7. Test from workstation browser

- App: `http://10.0.10.229:5173/`
- Supabase Studio: `http://10.0.10.229:54323/`

#### 8. Make the sshfs mount persistent (optional, after verifying)

Add to `/etc/fstab` or create a systemd mount unit so it survives reboots.

#### 9. Clean up (after verifying everything works)

- Delete `~/Documents/clarklaw-domain/atomic-crm.bak`
- Remove Node.js, Docker, Python dev dependencies from workstation
- Keep only sshfs, SSH client, and browser on workstation

## Verification

1. `make start` succeeds, Supabase containers all healthy
2. Frontend loads at `http://10.0.10.229:5173/` from workstation browser
3. Supabase Studio loads at `http://10.0.10.229:54323/`
4. `make test`, `make typecheck`, `make lint` all pass
5. Login works (create a test user via Supabase Studio or Inbucket)
6. Migration scripts work: `cd migration && python3 fetch_sample.py --use-cache`
7. `scripts/db-compare.sh` can reach prod at `10.0.10.228:5433`
