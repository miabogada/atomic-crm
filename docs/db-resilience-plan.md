# Production DB Resilience Plan (manual standby)

## Context

On 2026-08-22, the Proxmox host `pve2` (which runs prod container 703 "crm")
locked up and required a manual power cycle. A separate RCA session could not
determine a root cause. It's functional now, but since the cause is unknown,
it could happen again.

Goal: reduce the impact of a repeat lockup. **Not** aiming for automatic
failover — deliberately keeping this simple and manual.

**Host B = an LXC/VM on `pve8`**, a second Proxmox host in the office,
a few miles from `pve2` (home). Different building means separate power
circuit and separate ISP connection — this covers the failure that actually
happened (a single host locking up) plus a building-level outage at either
location. Only a genuinely regional event (grid-wide power failure, a
disaster affecting several miles) would take out both, and that's an
acceptable residual risk to leave uncovered for a practice this size.

Chosen over a cloud VM (AWS/DigitalOcean/Hetzner/Oracle) specifically
because `pve8` is free (hardware already owned) and zero learning curve —
same Proxmox tooling (`pct`, the web UI) already used for 703, no new
provider account to operate under pressure during an actual incident.

## Confirmed current exposure architecture

- **Frontend**: `crm.tanoclark.com` → Cloudflare Pages (static build). Fully
  independent of container 703 — unaffected by a pve2 outage.
- **API**: `api.tanoclark.com` → Cloudflare Tunnel `crm` (cloudflared,
  tunnel ID `026cbb99-ae12-46b5-b195-0b6117403ef7`) → Kong on
  `localhost:8000` inside container 703. Confirmed via Cloudflare dashboard
  screenshot (2026-08-22): 1 active replica, origin IP `107.216.222.33`,
  status Healthy, uptime 3 days.
- Nginx on 703 (port 80, LAN-only) is a separate/legacy path, not part of
  the public route.
- `VITE_SUPABASE_URL` in the Cloudflare Pages build is almost certainly
  `https://api.tanoclark.com` — a stable hostname, not a raw IP. (Not
  independently confirmed by reading the Pages env var directly — but the
  tunnel setup only makes sense if this is how it's wired. Worth a final
  check before relying on this plan.)
- Earlier assumption that this hostname came from the Google OAuth plan
  (`docs/google-oauth-login-plan.md`) was **wrong** — that plan was never
  implemented (no code changes, no `GoogleOAuthButton.tsx`). The hostname
  turned out to be correct anyway, confirmed independently via the Cloudflare
  Tunnels dashboard, not via that doc.

## Proposed architecture

```
                    ┌───────────────────────────────┐
                    │  crm.tanoclark.com              │
                    │  Cloudflare Pages (static)      │
                    │  — unaffected by any of this —  │
                    └────────────────┬─────────────────┘
                                     │ VITE_SUPABASE_URL = https://api.tanoclark.com
                                     ▼
                    ┌─────────────────────────────────────┐
                    │  Cloudflare edge — Tunnel "crm"        │
                    │  routes api.tanoclark.com to whichever │
                    │  replica below is currently connected  │
                    │  and healthy (this is the failover      │
                    │  mechanism — no DNS change needed)     │
                    └───────────┬─────────────────┬─────────┘
                                │                 │
                      replica 1 │       replica 2 │ (added during
                      (normally │        (stopped │  failover, not
                       running) │         normally)│  left running)
                                ▼                 ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│ PRIMARY — LXC 703, host pve2        │   │ STANDBY — Host B, LXC on pve8      │
│  (home)                             │   │           (office, ~miles away)    │
│  cloudflared (replica 1)            │   │  cloudflared (replica 2, stopped   │
│  Kong → PostgREST/Auth/Storage      │   │  until failover)                   │
│                │                     │   │  Kong → PostgREST/Auth/Storage     │
│                ▼                     │   │                │                    │
│           Postgres (db)              │   │                ▼                    │
│           read/write, PRIMARY  ──────┼──►│  Postgres (db) — read-only,        │
└───────────────────────────────────┘ WAL  │  replaying WAL, STANDBY             │
                                   stream  └───────────────────────────────────┘
```

Why `cloudflared` on Host B is stopped by default: if it were always
running, Cloudflare would round-robin `api.tanoclark.com` traffic across
both replicas even while 703 is perfectly healthy, and any write that
happened to land on Host B's read-only standby would get a spurious error.
Keeping it off until you deliberately start it avoids that — but note the
two tiers below need it stopped at different points for different reasons.

## Three-tier response — this is the actual design decision

This is a standard Postgres HA pattern: streaming replication keeps a
standby continuously caught up, and a human decides *if and when* to
promote it. Tier 1/2 below correspond to "wait it out" vs. "declare
disaster" on `pve8`; Tier 3 is the last resort if both Proxmox hosts are
gone at once (e.g. a regional event, or simply being unreachable while
traveling and unable to get either box back up).

### Tier 1 — restore read access (do this immediately, for any outage)

Host B's Postgres **stays read-only** — no promotion. Just bring its
Supabase stack into the routing:

```bash
# on Host B
docker compose -f /opt/supabase/docker/docker-compose.yml up -d
cloudflared tunnel run --token <crm-tunnel-token>
```

Cloudflare now has two healthy replicas and starts routing
`api.tanoclark.com` traffic across both (703's replica already dropped out
on its own if 703 is truly locked up). Reads succeed. Writes hitting Host B
fail cleanly with a Postgres "read-only transaction" error — no data risk,
because nothing has been promoted. Already-logged-in staff can browse
accounts/contracts/tasks; new logins and any edit/save action won't work
until either 703 comes back or you move to Tier 2.

**Exactly how long "already logged in" actually lasts (verified against
the real client code, not assumed) — 2026-08-23:** Supabase Auth issues a
short-lived JWT access token (stateless, verified by signature against
`JWT_SECRET` — no DB lookup) plus a longer-lived refresh token (a DB row,
rotated on each use). Because 706 got the *exact* `.env` copied from 703
(same `JWT_SECRET`) and physically replicates the entire `auth` schema, an
already-issued access token verifies successfully on 706 too — this falls
out naturally from physical replication + shared secret, no extra design
needed, and applies the same regardless of which hostname routes to 706.

Confirmed `JWT_EXPIRY=3600` (1 hour) in 703's `.env`. Checked the actual
installed `@supabase/auth-js` (v2.90.1) source
(`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`): the client
polls every 30s (`AUTO_REFRESH_TICK_DURATION_MS`) and proactively refreshes
once within 3 ticks / 90s of expiry (`AUTO_REFRESH_TICK_THRESHOLD`) — so
the first refresh attempt happens **~58.5 minutes** after last token issue,
not the full hour. On Host B (read-only), that refresh's required write
(refresh-token rotation) fails with a real HTTP error from GoTrue — not a
network-level "retryable" failure — so `_callRefreshToken` calls
`_removeSession()`, which **immediately signs the user out** (fires
`SIGNED_OUT`, clears localStorage), rather than gracefully continuing on
the still-valid-for-~90-more-seconds token. It's a hard cutoff, not a
fade-out.

**Bottom line**: each already-open session gets ~58 minutes of fully
transparent continued access once traffic moves to Host B, then an abrupt
full logout, with no way to log back in until Tier 2 (promote) or 703
returns. This is a hard limit of the JWT/refresh mechanism itself, not
something the routing approach (this same-hostname design vs. a
hypothetical separate `crm2.tanoclark.com`/`api2.tanoclark.com` site, which
was considered and set aside — see below) can change.

#### Alternatives considered for the login gap (2026-08-23), not adopted

- **Separate always-on `crm2.tanoclark.com`/`api2.tanoclark.com` pointed
  permanently at 706.** Real upside: Tier 1 access becomes passive (no
  manual `cloudflared` step), and it continuously proves the standby
  actually works instead of only being exercised during a real disaster.
  Real downside: it's a genuinely different browser origin, so an existing
  `crm.tanoclark.com` session (localStorage-based) doesn't carry over —
  and the ~58-minute limit above applies identically there anyway, so the
  main thing it would've bought (session continuity) isn't actually
  different from the current design. Cloudflare Access (the email
  one-time-link layer in front of everything) is a separate, DB-independent
  gate and isn't the blocker — GoTrue's own session-write is.
- **Cookie-based session storage scoped to the apex domain**
  (`Domain=.tanoclark.com`) instead of Supabase's default localStorage.
  Would let an existing session carry over to a hypothetical `crm2`. Real
  code change (custom `auth.storage` adapter on the Supabase client,
  currently plain `createClient()` with no override — see
  `src/components/atomic-crm/providers/supabase/supabase.ts`). Doesn't
  change the ~58-minute hard limit either way.
- **Logical replication instead of physical, to scope read-write
  permissions** (replicate `public` schema + `auth.users`/`identities`
  read-only, keep `auth.sessions`/`refresh_tokens` local and writable on
  706, so fresh logins would actually work there). Genuinely would solve
  the login gap. Set aside because it's a materially bigger architecture
  change than what's built: schema/DDL changes don't auto-replicate
  (migrations would need a separate manual step against 706 every time),
  initial setup needs a schema dump+restore instead of the working
  `pg_basebackup` byte-copy, and roles/RLS need independent setup rather
  than being inherited for free. (One favorable fact if this is revisited:
  703 already has `wal_level = logical` enabled, since Realtime's own
  `cainophile_*` slot already requires it — that prerequisite is already
  met.)

#### Decision (2026-08-23): extend `JWT_EXPIRY` to 7 days instead

Chosen over the alternatives above: increase `JWT_EXPIRY` from `3600`
(1 hour) to `604800` (7 days) on production. Rationale:

- **Accepted the security tradeoff deliberately**, given: Cloudflare
  Access (email one-time-link) already gates network access in front of
  everything, and there are only 4 total users (3 active daily + 1 admin)
  — a small, known population, not a large or anonymous one. A leaked/
  stolen access token is now usable for up to 7 days instead of ~1 hour;
  the only way to kill it early is a full `JWT_SECRET` rotation (logs
  everyone out everywhere), there's no per-token revocation. Worth
  revisiting this call if the user base or risk profile ever changes.
- **Solves a real operational problem, not just convenience**: a short
  JWT lifetime creates pressure to promote 706 (Tier 2 — a one-way door)
  just to restore login capability during outages that might otherwise
  have resolved on their own within a few hours. A 7-day window means
  Tier 2 stays reserved for outages actually confirmed to be long-term,
  rather than being forced by login pressure alone. See "Failback
  procedure" below for why *fewer, more deliberate* promotions matter —
  each one requires a real, non-trivial rebuild afterward.
- **Doesn't fix fresh logins during an outage** — `JWT_EXPIRY` only
  extends already-issued tokens; someone not already logged in when 706
  takes over still can't log in until Tier 2 or 703 returns. Unchanged
  limitation, just a smaller practical population likely affected by it.
- **Must be a standing setting, not reactive.** It only affects tokens
  issued *after* the change — can't retroactively extend a token already
  issued under the old value. Since outages aren't predictable, this has
  to already be in effect before an incident to help, not toggled during
  one.
- **Confirmed mechanics of applying it**: does *not* end today's active
  sessions. A JWT's expiry is baked into the token at issuance/refresh
  time, not looked up live — changing the config only affects tokens
  issued going forward. Requires restarting the `auth` (GoTrue) container
  to pick up the new `.env` value; existing sessions keep running on their
  current ~1hr rolling refresh and silently pick up the new 7-day expiry
  the next time each one naturally refreshes (within about an hour of the
  change, with zero visible interruption to anyone).

#### Failback procedure — bringing 703 back after a Tier 2 promotion

Worked out 2026-08-23 while discussing promotion frequency. No data
"reconciliation" is needed in a merge sense — once 706 is promoted, its
data simply *is* the authoritative truth going forward; 703's old copy is
just stale and gets discarded, not merged.

1. The moment 703 is reachable again, stop its `cloudflared` before
   anything else (see "Split-brain risk" above) — its Docker auto-restart
   would otherwise silently reconnect a stale primary to the tunnel.
2. Wipe 703's stale `volumes/db/data` — nothing in it is worth keeping
   once 706 has taken real writes.
3. Rebuild 703 as a fresh standby of 706: same process as the original
   706 setup, reversed (`pg_basebackup` from 706 into 703, new slot on
   706, `pg_hba.conf` rule for 703's IP, and the `hot_standby`/
   `read-replica.conf` fix reapplied — 703 would hit the identical
   wal-g.conf issue, but it's a known fix this time, not a fresh
   discovery).
4. **Bandwidth asymmetry to expect**: this transfer flows office→home
   (706 sending, 703 receiving) — the office's weak *upload* side
   (5-10Mb/s), not the fast download side used for the original setup.
   At this database's actual size (~2GB), still only ~25-55 minutes in
   practice, not hours — but noticeably slower than today's ~3 minutes.
5. Decide: leave 706 as the permanent new primary (simpler, no second
   cutover — but means production now runs on pve8's weaker CPU
   long-term), or do a second promotion cycle back to 703 (promote 703,
   redirect the tunnel, rebuild 706 as 703's standby again — this
   direction is the fast one, same as today's original setup).

**If 703 comes back on its own** (this was a transient lockup): tear Tier 1
down — `cloudflared` on Host B stops, back to one replica, no data to
reconcile because no writes ever diverged. This is the common case and it's
fully reversible.

### Tier 2 — declare disaster (one-way door, don't do this lightly)

Only once you've concluded 703 or its data isn't coming back:

```sql
-- on Host B
SELECT pg_promote();
```

Host B is now a real read-write primary. From this moment, 703's old data
is permanently behind — 703 can never rejoin the tunnel again except as a
freshly rebuilt standby (or it gets decommissioned outright).

## Split-brain risk — only relevant once you've promoted (Tier 2)

Cloudflare Tunnel routing is purely network-level: it sends traffic to
whichever replicas are connected and healthy, with zero awareness of which
side holds current data. That's harmless in Tier 1 (Postgres itself blocks
writes to the standby). It becomes dangerous the moment Host B is promoted:

**703's Docker is configured to auto-restart containers** (see
`docs/infrastructure.md`). If 703 reboots after being power-cycled post
Tier-2-promotion, its `cloudflared` container would auto-reconnect and
silently rejoin rotation — now genuinely holding stale, diverged data next
to Host B's promoted primary. Cloudflare would load-balance live writes
across both: silent corruption, not a clean recovery.

Cloudflare can't prevent this, and plain Postgres has no built-in fencing
against it either. The fix is operational: **once you've promoted Host B,
703 must never be allowed to silently rejoin the tunnel.** Since bringing
703 back already requires physically power-cycling it, add one step to
that same manual process — stop the stack before it can reconnect, not
after:

```bash
# As soon as 703 is reachable again post-incident, BEFORE checking anything else:
ssh root@10.0.10.228
docker compose -f /opt/supabase/docker/docker-compose.yml stop cloudflared
```

Only restart `cloudflared` on 703 once it has been deliberately rebuilt as
the new standby (see below) — never as an automatic side effect of the box
booting.

## After a Tier 2 promotion, once 703 is reachable again

Don't just resume it as primary — it's now stale. Rebuild it as the new
standby (reverse replication direction, fresh `pg_basebackup` from Host B)
before trusting it again, then decide whether to fail back or just leave
Host B as primary going forward. Only after that rebuild is done should
`cloudflared` on 703 be started again.

If you never reached Tier 2 (703 just came back on its own), none of this
applies — see "Tier 1" above, it's a clean no-op teardown.

### Tier 3 — AWS cold site (only if pve2 AND pve8 are both unavailable)

For the case where neither Proxmox host can be reached at all — both down,
or you're traveling and can't get either back up. A true cold site: almost
nothing runs (or costs money) day-to-day; compute only gets stood up if
this tier is actually needed.

**Ongoing (near-zero cost):**
- Daily `pg_dump` shipped to a private S3 bucket.
- Ship it **from `pve8` (the standby), not from 703.** If 703 is the one
  that's dead, backups to S3 keep flowing uninterrupted from the
  still-alive standby. If both are down, the last successful daily backup
  is what you restore from — accepted RPO is "up to 24h of data loss,"
  the standard cold-site tradeoff.
- No EC2 instance running. S3 storage for a database this size is pennies
  a month.
- **Revisit (not yet done): reuse the existing backup pipeline instead of
  building a new one.** Discovered 2026-08-22: there's already a 5-month
  daily backup history (`prod_backup_*.sql.gz`, 168 files back to
  2026-03-08) pulled via cron (`sync-crm-backups.sh`, now correctly filed
  at `proxmox/pve2/vm703-crm/daily-backups/` after fixing a mis-filed
  folder) from 703 to the home workstation. This pipeline does **not**
  satisfy Tier 3 on its own — the workstation is in the same building as
  `pve2`, so it shares the exact building-level failure Tier 3 exists to
  cover. But rather than building a separate daily-backup job on `pve8`
  from scratch, the plan is to add an `aws s3 cp` step directly to this
  already-proven script. One nuance to handle when we come back to this:
  the script currently pulls from **703**, not `pve8`/706 — once 706 is
  live as a streaming standby, re-point the source to 706 for better RPO
  (seconds-behind via replication, vs. once-daily dump). Deferred for now
  — staying focused on getting 706 built.

**Activation (only during an actual triple-failure disaster), from
anywhere with a laptop/phone and your AWS login + MFA:**

1. Launch an EC2 instance from a pre-built AMI (Docker + the Supabase
   compose setup already baked in — a launch, not a from-scratch install).
2. Pull the latest dump from S3, restore it locally.
3. Bring the stack up, start `cloudflared` on this instance as a third
   tunnel replica, same token as the others — traffic routes here the same
   way it would to `pve8`.
4. This is now a Tier-2-equivalent promoted primary. Same rule applies
   afterward: **neither 703 nor `pve8` may silently rejoin the tunnel once
   they're back** — both get rebuilt as fresh standbys (fresh
   `pg_basebackup` from this AWS instance) before reconnecting `cloudflared`
   on either of them.

## Progress log

- **2026-08-22**: CT 706 (`crm-standby`) created on `pve8` — 2 vCPU, 4GB RAM,
  20GB disk on `local-lvm`, unprivileged, nesting enabled (matching 703),
  `discard`+`noatime` mount options, DHCP with an OPNsense reservation
  pinning it to `10.0.0.228` (chosen to echo prod's `.228`, since 706's role
  is "become prod if needed" — office LAN is a separate `10.0.0.0/24`
  subnet from home's `10.0.10.0/24`, no actual technical relation between
  the two addresses, just a mnemonic). SSH access via the same key already
  trusted on 703 (`~/.ssh/crm-prod.pem`, confirmed working, despite its
  `backup@workstation` key comment).
- Confirmed 703's actual `/opt/supabase/docker` layout: alongside
  `docker-compose.yml`/`.env`, there's a `volumes/` tree with Kong config,
  init SQL scripts, pooler/functions/logs config — all static and safe to
  copy — **and `volumes/db/data`, which is the live Postgres data
  directory** (contains `pg_wal`, `base`, `global`, `postgresql.conf`,
  etc.). That one must be excluded from any config copy and populated
  separately via `pg_basebackup` — copying it directly would risk exactly
  the torn/inconsistent-backup problem this plan avoided by choosing
  `pg_basebackup` over a Proxmox backup-restore approach in the first
  place.

### Config copy command (703 → 706, excluding live DB data)

Routed through the local workstation as a relay (703 and 706 have no trust
relationship with each other):

```bash
# Step 1: pull 703's config (everything except live DB data) to a local scratch dir
mkdir -p /tmp/supabase-706-config
rsync -avz -e "ssh -i ~/.ssh/crm-prod.pem" \
  --exclude 'volumes/db/data' \
  root@10.0.10.228:/opt/supabase/docker/ \
  /tmp/supabase-706-config/

# Step 2: push it to 706
ssh -i ~/.ssh/crm-prod.pem root@10.0.0.228 'mkdir -p /opt/supabase/docker'
rsync -avz -e "ssh -i ~/.ssh/crm-prod.pem" \
  /tmp/supabase-706-config/ \
  root@10.0.0.228:/opt/supabase/docker/
```

`volumes/db/data` gets created fresh by `pg_basebackup` in a later step —
don't `mkdir` or otherwise touch it manually before that.

## Progress log (continued)

- **2026-08-23**: 706 is now a live, fully-caught-up streaming standby of
  703. Confirmed via `pg_is_in_recovery()` = `t`, a real read query against
  replicated data succeeding, and `pg_stat_replication` showing
  `sent_lsn` = `replay_lsn` with sub-25ms write/replay lag.
- Production-side setup done: `max_slot_wal_keep_size` lowered from an
  existing 4GB (too close to 703's ~4GB free disk margin) to 1GB;
  `pg_hba.conf` rule added for replication from `10.0.0.228`; physical
  replication slot `crm_standby_706` created (distinct from Supabase's own
  pre-existing `cainophile_*` logical slot used internally by Realtime —
  unrelated, don't touch that one).
- **Gotcha #1 — `pg_hba.conf` isn't where you'd expect.** `SHOW hba_file`
  reports `/etc/postgresql/pg_hba.conf`, not
  `/var/lib/postgresql/data/pg_hba.conf` (the data-directory copy exists
  but isn't the active one). Same pattern likely applies to other config
  lookups on this image — check `SHOW <file>_file` rather than assuming
  the data-directory path.
- **Gotcha #2 — version-mismatched `pg_basebackup` writes a `primary_conninfo`
  the server can't parse.** Ran `pg_basebackup` from the generic
  `postgres:15` Docker Hub image (resolves to a newer 15.x point release
  than 703's actual `supabase/postgres:15.8.1.085`). The `-R`-generated
  `primary_conninfo` included newer libpq options (`sslnegotiation`, then
  `sslcertmode`) the older server's libpq didn't recognize, causing
  `walreceiver` to fail with "invalid connection option." Fixed by
  replacing `primary_conninfo` with a minimal version (just
  `user`/`password`/`host`/`port`/`sslmode=disable`) — safe here since
  `sslmode=disable` makes all the SSL sub-options moot anyway. **Lesson
  for next time**: run `pg_basebackup` from a container matching the
  server's exact image/version, not a generic same-major-version tag.
- **Gotcha #3 — `hot_standby` was forced off by an unrelated included
  config file.** Even with `pg_is_in_recovery()` true, Postgres refused
  all connections ("Hot standby mode is disabled"). Root cause:
  `/etc/postgresql-custom/wal-g.conf` (Supabase's WAL-G backup tooling
  config, irrelevant on a normal primary but included regardless) sets
  `hot_standby = off`. Supabase ships a second file,
  `/etc/postgresql-custom/read-replica.conf`, included *after* `wal-g.conf`
  specifically as the override point for exactly this scenario — it ships
  with `# hot_standby = on` commented out. Uncommented it; later include
  wins, so this correctly overrides `wal-g.conf`.
- **Resolved 2026-08-23 — persistence of gotcha #3's fix.** Created
  `volumes/db/read-replica.conf` on 706's host filesystem (content:
  `hot_standby = on`, plus the original commented-out lines for
  reference), and added a volume mount in `docker-compose.override.yml`:
  `./volumes/db/read-replica.conf:/etc/postgresql-custom/read-replica.conf:Z`.
  Verified by fully force-recreating the container
  (`docker compose up -d --force-recreate --no-deps db`, not just
  `restart`) — `hot_standby` stayed `on`, still in recovery, replicated
  data still queryable, replication resumed cleanly from 703's side. This
  is now a durable fix, safe across container recreation.

## Open items before this is real (not yet done)

- [x] Provision Host B (CT 706 created on pve8 — see Progress log above).
- [x] Copy 703's Supabase config to 706 (done 2026-08-22, excluding live
      DB data — archived at `proxmox/pve2/vm703-crm/supabase-docker-config-2026-08-22/`).
- [x] Docker + nesting working on 706 (needed the `lxc.apparmor.profile` /
      `lxc.cgroup.devices.allow` / `lxc.cap.drop` raw config lines, matching
      703 — see `proxmox/pve2/vm703-crm/lxc-config-2026-08-22.conf`).
- [x] Set up native Postgres streaming replication — **done and verified
      2026-08-23**: `pg_basebackup` run, `db` service up, `pg_is_in_recovery()`
      = `t`, zero lag confirmed via `pg_stat_replication`. See "Progress log
      (continued)" above for the three gotchas hit along the way.
- [x] Fix `hot_standby` persistence (resolved 2026-08-23 — see Progress
      log above; verified durable across a full container recreation).
- [x] Bring up Kong/PostgREST/Auth on 706 — **done and verified
      2026-08-23**. `docker compose up -d kong rest auth storage` pulled in
      required deps (`analytics`, `imgproxy`) automatically. Kong, rest,
      auth, analytics, imgproxy all healthy. Confirmed end-to-end through
      the real API path (not just direct SQL): `curl` through Kong
      (`:8000/rest/v1/account_contacts`) with the `service_role` key
      returned real replicated rows; with the `anon` key it correctly
      returned `[]` (RLS doing its job, not a bug).
- [ ] **Storage does not work on 706 and can't, as currently built** —
      confirmed hard PostgreSQL limitation, not a config issue. Storage's
      TUS (resumable upload) route registration unconditionally calls
      Postgres `LISTEN` at server startup (`postgres-locker.js` /
      `LockNotifier.start`), and Postgres categorically refuses `LISTEN`
      during recovery (error `25006`,
      `PreventCommandDuringRecovery`) — this is fundamental Postgres
      behavior, not a bug in this image. Checked: `TUS_LOCK_TYPE` only
      supports `postgres` or `s3`, and *both* share the same
      Postgres-based `lockNotifier` underneath, so switching doesn't avoid
      it. The standard real-world workaround (point the `LISTEN`
      connection at the primary while reading from the replica) doesn't
      apply to us — Tier 1 exists specifically for when the primary is
      *unreachable*. Container stopped on 706 (was crash-looping) rather
      than left retrying forever.
      **Confirmed non-issue, not just an accepted limitation** — checked
      prod directly (2026-08-23): `storage.objects` has 0 rows, and the
      `attachments` array column on `contact_notes`, `deal_notes`, and
      `account_activities` is empty on every single row. This is inherited
      framework capability (from the open-source base this app started
      from) that this workflow has never actually used — not a real gap.
      No further action needed here.
- [ ] Confirm `VITE_SUPABASE_URL` value directly in Cloudflare Pages project
      env settings.
- [ ] Get the tunnel token for tunnel `crm` (Cloudflare dashboard → Tunnels →
      crm → "Add a replica" gives the install command/token) and install
      `cloudflared` on Host B, but leave it **not started** by default.
- [ ] Add continuous WAL archiving to off-host storage (separate from
      replication) so an accidental delete/corruption doesn't just replicate
      straight to the standby too.
- [ ] Tier 3 (AWS cold site): create a private S3 bucket; add a daily
      `pg_dump` → S3 step on `pve8` (not 703); set a lifecycle rule to expire
      old backups and keep storage cost trivial; build a minimal AMI
      (Docker + `/opt/supabase/docker` compose files pre-cloned) so
      activation is a launch + restore, not a from-scratch setup; confirm
      IAM user/permissions for the account that will do the S3 write and
      the EC2 launch.
