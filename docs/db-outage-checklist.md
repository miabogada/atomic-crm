# 703 Outage — Quick Response Checklist

Full design, rationale, and gotchas are in `db-resilience-plan.md`. This
is the short version to have at hand during an actual incident — don't
improvise from memory beyond what's here; if it's not on this page, go
read the full doc rather than guess.

## Orientation

`crm.tanoclark.com` (the CRM frontend) always talks to `api.tanoclark.com`
— that address doesn't point at one fixed server, it's a Cloudflare
Tunnel that routes to whichever backend is currently connected. There are
two independent Postgres backends it can route to:

- **703** — home network. LXC on Proxmox host `pve2` (`10.0.10.121`),
  container itself at `10.0.10.228`. Normal read-write primary.
- **706** — office network. LXC on Proxmox host `pve8` (`10.0.0.8`),
  container itself at `10.0.0.228`. Warm standby, continuously replicating
  from 703, normally not connected to the tunnel at all.

**The goal**: if 703's backend fails, you can switch `crm.tanoclark.com`
over to the office standby in **read-only** mode. This works — including
staying logged in with no action needed — **only for users who were
already logged in** before the switch, for **up to 7 days**. Nobody can
log in fresh, and nobody can save/edit anything, until either 703 comes
back or 706 is promoted (see bottom).

## 1. Confirm it's real

- [ ] Cloudflare dashboard (Tunnels → `crm`) shows the `crm` replica gone,
      and/or you got the "unhealthy/down" email alert

## 2. Bring up read-only access (Tier 1) — on 706 (`10.0.0.228`)

- [ ] SSH in: `ssh -i ~/.ssh/crm-prod.pem root@10.0.0.228`
- [ ] Confirm the stack is up: `cd /opt/supabase/docker && docker compose up -d`
      (likely already running)
- [ ] Confirm Nginx is running: `systemctl status nginx`
- [ ] Start the tunnel replica:
  ```bash
  systemd-run --unit=cloudflared-manual --description="Manual Tier1 cloudflared replica" bash -c 'set -a; source /opt/cloudflared-tunnel-token.env; set +a; exec cloudflared tunnel run --token "$CF_TUNNEL_TOKEN"'
  ```
- [ ] Confirm `crm-standby` shows as an active replica in the dashboard
- [ ] Confirm `crm.tanoclark.com` loads for already-logged-in staff (reads
      work; saves/edits will error — expected, not a bug; fresh logins
      won't work either)

## 3. Wait and watch

- [ ] Watch for the "healthy" recovery email / the `crm` replica
      reappearing in the dashboard — that means 703 is back on its own
- [ ] If 703 stays down long enough that this becomes a real decision (not
      just "wait a bit longer") → stop, go read the full Tier 2 procedure
      in `db-resilience-plan.md` before acting

## 4. When 703 comes back on its own (transient outage — the common case)

- [ ] **The instant 703 is reachable, before checking anything else**:
      `systemctl stop cloudflared` on 703 — it's a native systemd service
      there (confirmed 2026-08-23), not a docker-compose container.
- [ ] Confirm nothing was promoted on 706 (`pg_is_in_recovery()` should
      still be `t`) — if so, there's no data to reconcile, safe to proceed
- [ ] Tear down Tier 1: `systemctl stop cloudflared-manual` on 706
- [ ] Restart 703's tunnel: `systemctl start cloudflared` on 703
- [ ] Confirm `crm` replica is back, `crm-standby` is gone, tunnel healthy

## If 703 is permanently lost (not a transient outage)

This is a one-way door — don't do it just because 703 has been down for a
while, only once you've actually concluded it's not coming back. On 706:
`SELECT pg_promote();` — this makes 706 a real, independent read-write
primary, and every already-logged-in session's next login/action starts
working normally again on it. From that moment, 703's data is permanently
stale: it can never be allowed to reconnect to the tunnel as-is, and has
to be rebuilt from scratch as a fresh standby of 706 (or decommissioned)
before it's trusted again. Full procedure, including the failback option
and its bandwidth caveats, is in `db-resilience-plan.md` — this isn't a
step to freelance from a one-line summary.
