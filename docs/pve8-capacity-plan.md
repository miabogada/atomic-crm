# pve8 RAM Capacity Plan

## Context

`pve8` was chosen as Host B for the [DB resilience plan](db-resilience-plan.md)
(production Postgres standby). As of 2026-08-22 the host only has ~4.6 GB RAM
free (15.52 GB total, 70.29% used), which is tight for the ~4GB standby CT
that plan calls for. This doc tracks the separate cleanup that frees up room
— not part of DB resilience itself, but needed to give it comfortable
headroom.

Current guests on pve8, relevant to this cleanup:

| CT/VM | Role | Allocated | Actual usage | Notes |
|---|---|---|---|---|
| 100 (Exc1dc1) | Win2k domain controller | ? | ? | Legacy Outlook CRM. Stop/start is slow and slightly risky — leave running continuously, not a target for reclaim. |
| 101 (Exc3) | Win2k3 Exchange | ? | ? | Same legacy system, same reasoning as 100. |
| 105 (opnsense-office) | Office firewall/router | ? | ? | Not part of this cleanup. |
| 128 (win-clerk) | WinXP legacy client | 1 GB | <630 MB | Used via Guacamole for occasional old-client exports from the legacy Outlook CRM. |
| 129 (win-assistant) | WinXP legacy client | 1 GB | <630 MB | Same as 128. |
| 211 (sbc2-3cx) | ? | 2 GB | <512 MB | Significantly over-provisioned. |

## Planned changes

1. **Right-size 211**: 2GB → ~768MB-1GB. Reclaims **~1-1.25GB**.
2. **Retire one of 128/129 permanently.** Both are WinXP legacy clients used
   one-at-a-time via Guacamole for occasional exports — no indication two
   are ever needed simultaneously. Reclaims **~1GB** outright.
3. **Right-size the remaining WinXP client** (whichever of 128/129 stays):
   1GB → ~768MB. Reclaims **~256MB**.
4. **Leave 100 and 101 running continuously** — do not stop/start on demand.
   Both are fragile legacy Windows Server-era boxes (DC + Exchange); clean
   shutdown/startup risk isn't worth the RAM it might free.

Net reclaim from steps 1-3: **~2.25-2.5GB**.

## Guacamole migration (AWS → pve8)

Currently: a Guacamole server on AWS, used to remotely reach the WinXP
client(s) for legacy exports. Costing ongoing AWS spend for something that's
used occasionally.

Plan: stand up Guacamole (guacd + web app, typically Docker) on `pve8`
instead, budgeted at **~1GB RAM** — comfortably covered by the ~1GB reclaimed
from retiring one WinXP client (step 2 above). Once running on pve8, EOL the
AWS instance.

## Net effect on pve8 RAM budget

- Free today: ~4.6 GB
- + reclaimed from right-sizing/retiring (steps 1-3): ~2.25-2.5GB
- − new Guacamole footprint: ~1GB
- **Net free after this cleanup: ~5.85-6.1 GB**

This gives the [DB resilience plan](db-resilience-plan.md)'s 4GB standby CT
comfortable headroom instead of a near-total consumption of what's currently
free, and removes an AWS cost line at the same time.

## Open items

- [ ] Confirm actual RAM allocation for 100 and 101 (not yet checked) — not
      being changed, but worth knowing for the full host budget picture.
- [ ] Decide which of 128/129 to retire (no technical difference identified
      yet — likely just "whichever is less recently used").
- [ ] Right-size 211, 128 or 129 (whichever remains) in Proxmox.
- [ ] Stand up Guacamole on pve8 (Docker: `guacamole/guacd` +
      `guacamole/guacamole`, small backing DB for connection config).
- [ ] Verify Guacamole on pve8 can reach the remaining WinXP client, then
      decommission the AWS Guacamole instance.
