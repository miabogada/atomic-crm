---
name: project_import_contract_status_entities_bug
description: OPEN (found 2026-11-08). Two legacy-import data bugs on contracts. (1) 289 contracts have status "In progress", which is not a valid contract status, so the Status dropdown shows blank. (2) 93 contracts have XML escapes like "&amp;" in work_description. Both come from migration/fetch_sample.py. Live on prod (dev was synced from prod 2026-11-08).
metadata:
  type: project
---

## Status: OPEN. Recorded, not fixed (2026-11-08)

Found while testing [[plan-multiple-case-types]] on contract 192 (20030701A2, ROMAN, DAVID). Not caused by the case-types change, and it doesn't block it. Counts are from dev right after the 2026-11-08 prod→dev sync, so they match prod as of that date.

## Bug 1: imported contracts have an invalid status, "In progress"

**Symptom:** on contract show/edit, the Status dropdown (form and right-hand aside) is blank. The valid choices are `defaultContractStatuses` in `src/components/atomic-crm/root/defaultConfiguration.ts`: "In process", "In process - Past due", "Stopped - Past due", "In process - Paid", "Done - Paid", "Canceled". A `SelectInput` can't display a value that isn't one of its choices.

**Scope (non-deleted contracts):**
| status | count |
|---|---|
| In progress | 289 (created 2026-03-08 → 2026-11-01, i.e. every import batch) |
| In process | 40 (created in the CRM) |
| Complete | 1 (contract 288 / 26020201A1, the Kornfeld K Visa write-off close-out; set by hand) |

**Root cause:** `migration/fetch_sample.py` line ~954 hardcodes `'In progress'` in the `INSERT INTO account_contracts` it generates. The CRM's value is "In process".

**Risk until fixed:** what happens when a user saves one of these contracts without picking a status is untested. It might keep the hidden value, clear it, or hit the `NOT NULL` constraint on `status`. Tell users to pick a status before saving.

**Not the same as** the closed item in `crm-feature-requests.md` ("observed Status empty in form, expected In process"). That was the create-form default.

## Bug 2: XML escapes in work_description

**Symptom:** the work description shows `I-130 &amp; I-601A`, not `I-130 & I-601A`.

**Scope:** 93 contracts (created 2026-03-08 → 2026-08-02). Only `account_contracts.work_description`. Checked and clean: `case_type`, `tasks.text`/`notes`, `account_activities.body`.

**Root cause:** `fetch_contract_user_props()` in `migration/fetch_sample.py` (~line 562) parses the Exchange PROPFIND response with a regex (`_val_re`), since expat rejects the `{GUID}` namespace. Regex skips XML decoding, so `&amp;`, `&lt;` etc. pass through unescaped. It feeds `txtContractWorkDescription` → `contract_work_desc` → `work_description`.

## Fix plan (not started; needs user approval before prod)

1. **Data, Bug 1:** `UPDATE account_contracts SET status = 'In process' WHERE status = 'In progress';` Contract 288 "Complete": ask the user which status it should have (probably "Done - Paid").
2. **Data, Bug 2:** decode entities in `work_description` for the affected rows (`&amp;`→`&`, plus `&lt;` `&gt;` `&quot;` `&#NN;` if any). Scope it to rows matching `&(amp|lt|gt|quot|#[0-9]+);`.
3. **Script:** in `fetch_sample.py`, change `'In progress'` → `'In process'`, and wrap the regex value in `html.unescape()`, so future imports are clean. Imports are still running (last batch 2026-11-01).
4. Do it on dev first and check that contract 192 shows its status and a clean description, then prod. Per [[feedback_targeted_operations]], scope the UPDATEs to the affected rows only.
