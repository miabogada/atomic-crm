---
name: project-db-resilience
description: In-progress production DB resilience/DR build (pve8 warm standby + AWS cold site) — status and resume point
metadata:
  type: project
---

Building production DB resilience after the 2026-08-22 `pve2` host lockup
(a separate RCA session couldn't determine root cause — not being redone,
just mitigated). Full design and progress log live in
`docs/db-resilience-plan.md` — this memory is just a pointer + resume
summary, not a duplicate of that doc's detail.

**Design**: three tiers. Tier 1/2 = warm standby CT `706` (`crm-standby`)
on `pve8` (office, separate building/power/ISP from `pve2` home) — Tier 1
is read-only access during any outage, Tier 2 is a manual, deliberate
`pg_promote()` only for a declared disaster. Tier 3 = AWS cold site (S3
backups + launch-on-demand EC2), only if both Proxmox hosts are down —
deferred, not started yet.

**Status as of 2026-08-23 (paused for the evening, mid-build)**:
- CT 706 provisioned on pve8, Docker working, `db` service running as a
  live, verified, zero-lag streaming standby of 703. Direct SQL queries
  against replicated data work today.
- Not yet done: Kong/PostgREST/Auth/Storage aren't up on 706 yet, so
  there's no API-level read access yet, only direct DB access.
- One known unresolved issue to fix before trusting this: the `hot_standby`
  fix (see doc's Progress log, gotcha #3) was a `docker exec` edit into the
  container's writable layer, not bind-mounted — won't survive
  `docker compose down`/`up`, only `restart`. Needs Supabase's actual
  supported mechanism for this instead.
- **Resume point**: pick up at "Open items" checklist in
  `docs/db-resilience-plan.md` — next unchecked items are the
  `hot_standby` persistence fix, then bringing up the rest of the stack.

**Key facts learned that aren't obvious from re-reading the doc alone**:
- `~/.ssh/crm-prod.pem` is the trusted SSH key for prod (703) despite its
  misleading `backup@workstation` key comment — confirmed working,
  confirmed as the *only* key in 703's `authorized_keys`.
- `pve2` (home) and `pve8` (office) are separate standalone Proxmox
  installs (not clustered), linked home↔office via WireGuard. Home is
  1Gb/1Gb; office is ~100Mb down / 5-10Mb up — matters for transfer
  direction (703→706 today used the office's *download* side, fine; a
  future 706→703 rebuild would hit the office's weak *upload* side, slow).
- A separate, already-existing daily backup pull (`sync-crm-backups.sh`,
  cron on the workstation, pulls from 703) lives at
  `proxmox/pve2/vm703-crm/daily-backups/` — was mis-filed under an
  unrelated `vm706-ai` folder before this session fixed it. This is
  workstation-local (same building as `pve2`), so it doesn't satisfy Tier
  3 on its own, but Tier 3's S3 step is planned to extend this script
  rather than build a separate pipeline — deferred, noted in the plan doc.
