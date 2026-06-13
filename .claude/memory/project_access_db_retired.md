---
name: Access DB retired
description: billing_be.mdb is no longer refreshed — billing is fully in Atomic CRM
type: project
---

The Access DB (`billing_be.mdb`) is no longer used as the live billing backend. Do NOT attempt to refresh it from EXC1DC1 before migrations.

**Why:** As of 2026-05-18, all active billing is managed in Atomic CRM. The .mdb file is a historical artifact; newer accounts won't exist in it anyway.

**How to apply:** Skip the "Updating the Access DB" step in the migration skill entirely. The existing .mdb file is still used by `fetch_sample.py` for historical payment data on older accounts, but there's no need to refresh it.
