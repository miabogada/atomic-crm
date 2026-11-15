# Plan: Multiple Case Types per Contract

**Status:** Live on prod since 2026-11-08. Legacy contracts mapped to case types on dev and prod 2026-11-15 (see "Legacy contract mapping" below).

## Context

Requested: add six case types (I-130/I-601A, I-601A, U Visa, VAWA, T Visa, DACA). Checking dev turned up a bigger issue.

**Today the contract form allows one case type.** `ContractInputs.tsx` uses a single-choice `SelectInput` with a hardcoded list of 25 entries. None of the six requested types are on it. (A second list, `defaultCaseTypes` in `root/defaultConfiguration.ts`, has VAWA, U-Visa, T-Visa and DACA, but only the FakeRest demo data generator reads it. Nothing in the real UI uses it.)

**Combined cases are common.** Many contracts cover more than one service in a single fee. The legacy system stored case type as hand-typed text, and that text was copied into `account_contracts.case_type` during the import.

### Dev data, 2026-11-01 (deleted contracts excluded)

| | Count |
|---|---|
| Contracts | 328 |
| No case type | 46 |
| With a case type | 282 |
| Distinct hand-typed values | 142 |
| Combinations (contain `&`, `/`, `,`, `;` or ` and `) | 88 contracts (about 1 in 3) |
| Distinct spellings of those combinations | 64 |
| Distinct combinations after normalizing | about 30 (about 25 if "NVC & Consular" and visa + derivative are counted as single types) |

The most common combinations are I-130 + I-601A (about 19 contracts) and VAWA + Adjustment of Status (about 8). Most others appear once or twice. Some values also carry notes that aren't case types: client names ("FOR SOFIA", "(BRUNO)") and scope ("NO REPRESENTATION AT INTERVIEW").

### Why it matters

The main reason is finding every past client with a given case type when the law changes or a new program opens up. Today a search for I-601A has to catch "I-601A", "I-601A WAIVER", "I-130 & I-601A", "I-130 PETITION & I-601A WAIVER" and so on, and some will be missed.

## Options considered

- **A. Pre-made combinations in a single-choice list.** Workable, but it needs about 30 combined entries now and a new entry for each new pairing. Searching by one type still means matching every combination that contains it.
- **B. Allow one or more case types per contract (chosen).** The list stays short, any combination works, and a search for one type finds every contract that includes it.

## Decisions so far

- **Case types live in a database table**, not hardcoded, so adding one doesn't need a code change. A Settings/admin screen for managing them is **out of scope for now** (future work). Until then, new types are added by migration or SQL.
- **The contract ↔ case type link is normalized** into a join table with foreign keys. Chosen over an array column because it follows best practice and the database enforces integrity.
- **Spelling follows USCIS:** form numbers as `I-130`, `I-601A` (no hyphen before the "A"). Visas as "U Visa" and "T Visa" (no hyphen; title case to match the existing "K Visa" and "V Visa"). Acronyms "VAWA" and "DACA".
- **"I-130/I-601A" is not its own type.** Such a contract gets both I-130 and I-601A.
- **UI: type-to-search multi-select** (`src/components/admin/autocomplete-array-input.tsx`, already in the project). Staff type a few characters and pick, so where an item sits in the list doesn't matter.
- **Shortcuts for common pairs** (for example a one-click "I-130 + I-601A") are deferred. Add them only if staff find picking two items slow.

## Proposed design

### Database
1. New table `case_types`: `id`, `name` (unique), `active` boolean (retire a type rather than delete it), `created_at`. Seed it with the merged list: the current 25 from `ContractInputs.tsx`, plus I-601A, U Visa, T Visa, VAWA and DACA. Review the seed list with the attorney.
2. New join table `account_contract_case_types`: `contract_id` FK → `account_contracts(id)`, `case_type_id` FK → `case_types(id)` `ON DELETE RESTRICT`, primary key `(contract_id, case_type_id)`, `created_at`. The relationship is normalized, so the database enforces integrity: no links to missing contracts or types, and a case type that's in use can't be deleted. Reporting ("all contracts with I-601A", counts by type) is a plain join. RLS policies follow the existing table pattern.
   - *Rejected alternative:* a `case_type_ids bigint[]` column on `account_contracts` (like upstream `contacts.tags`). It's simpler for ra-core, but has no per-element foreign-key enforcement and makes reporting SQL clumsier.
3. **Reads:** a contracts view (extend the one the data provider already uses for `account_contracts`, or add `account_contracts_summary`) adds `case_type_ids bigint[]` and `case_type_names text[]`, gathered from the join table. Then `ReferenceArrayInput`/`ReferenceArrayField` and the list columns work unchanged.
4. **Writes:** the form submits `case_type_ids`. The supabase dataProvider (`create`/`update` for `account_contracts`) strips the view-only fields, saves the contract, then syncs the join table: it upserts the picked links first, then deletes the unpicked ones, so a failure part-way never leaves the contract with fewer types. (A Postgres RPC was considered; the project's backend-dev guidelines prefer dataProvider logic over stored procedures.) Reads for `account_contracts` (getList/getOne/getMany/getManyReference, plus the activity log) are routed to `account_contracts_summary`.
5. Keep the legacy `case_type` text column during the transition (read-only; still shown where nothing has been mapped). Drop it in a later migration once the mapping is done.
6. Update `contract_payment_schedule_view`, which uses `case_type` today, to expose `case_type_names` from the join table so lists and invoices don't need extra lookups.

### Frontend (files that use `case_type` today)
- `contracts/ContractInputs.tsx`: replace `SelectInput` with `ReferenceArrayInput` + `AutocompleteArrayInput` on `case_types`, and remove the hardcoded list.
- `contracts/ContractList.tsx`, `ContractListContent.tsx`: show multiple types; filter by case type (array "contains").
- `contracts/ContractShow.tsx`, `accounts/AccountShow.tsx`, `AccountAside.tsx`, `AccountContractsList.tsx`, `misc/ParentContractPicker.tsx`, `activity/ActivityLogContractCreated.tsx`: show the joined names.
- `invoices/fetchInvoiceData.ts`: case type text on invoices.
- `providers/supabase/dataProvider.ts`, `types.ts`: new field and resource.
- FakeRest: generators for `case_types` and `account_contract_case_types`, and emulate the view's `case_type_ids`/`case_type_names`. Remove the unused `defaultCaseTypes` in `root/defaultConfiguration.ts` and `ConfigurationContext.tsx`.
- CSV export: include case type names.

### Legacy data mapping (separate step, needs approval)
1. Generate a mapping table: each distinct legacy `case_type` value → proposed case type(s), plus any leftover note text.
2. The user (and the attorney, if needed) reviews the mapping.
3. Apply on dev: insert `account_contract_case_types` rows, and append leftover notes to `work_description`, not discarding them. Verify, then repeat on prod.
4. Values that can't be mapped stay visible in legacy `case_type` until someone fixes them.

## Attorney decisions (2026-11-01)
- **Approved** multi-select (Option B).
- **Seed list:** the current 25 plus the six requested, plus services found in legacy data: Court Representation, Motion to Terminate, Motion to Reopen, FBI/FOIA, Advance Parole, EAD, I-751, I-212, I-824, I-131F / Family Reunification Parole, Humanitarian Parole, Military Parole in Place, I-192. Retiring old types is deferred.
- **Renewals are separate types** (for example "DACA" vs "DACA Renewal", "TPS" vs "TPS Renewal"), so client invoices can tell them apart.
- **"No representation" variants are separate types** (for example "Adjustment of Status (No Representation)"), for the same reason.
- **Invoices list all case types** on the contract (assumed; confirm, since the user's reply said "q6 yes", probably meaning this question).

## Attorney decisions (2026-11-02)
- **NVC and consular are one type: "NVC & Consular Processing."** This replaces the existing "Consular Processing" entry and the planned separate "NVC" entry. It's usually paired with I-130. The rare consular-only one-off still uses this type, with a note in the work description. Legacy "NVC & CONSULAR INTERVIEW/PROCESSING/PREPARATION/APPOINTMENT", "CONSULAR PROCESSING" and similar values map here.
- **Derivative visas are their own types**, picked along with the principal type ("U Visa" + "U-2 Visa"). Seed only the derivatives in legacy use: U-2 Visa, U-4 Visa, T-2 Visa, T-4 Visa; add others on request. U-1/T-1 map to "U Visa"/"T Visa".
- **Case type is required** on save (at least one). The attorney said the 46 blank contracts are blank because no listed type fit. They have no legacy text to map, so staff fill them in when the contract is next edited.

## Case type list (approved 2026-11-08)

50 types, sorted alphabetically: Adjustment of Status · Adjustment of Status (No Representation) · Advance Parole · Asylum · BIA Appeal · Cancellation of Removal · Citizenship Inquiry · Court Representation · DACA · DACA Renewal · Deportation · EAD · EAD Renewal · FBI · FOIA · Humanitarian Parole · I-130 · I-131F / Family Reunification Parole · I-192 · I-212 · I-601 Waiver · I-601A · I-751 · I-824 · Inquiry · K Visa · Late Amnesty · Legalization · Letter · Military Parole in Place · Motion to Close · Motion to Reopen (was "MTR") · Motion to Terminate · N-400 · N-400 (No Representation) · NACARA · Non-Client Consult · NVC & Consular Processing (replaces "Consular Processing") · Review File · Suspension of Deportation · T Visa · T-2 Visa · T-4 Visa · TPS · TPS Renewal · U Visa · U-2 Visa · U-4 Visa · V Visa · VAWA

Approved as listed: "MTR" becomes "Motion to Reopen". I-918B and Motion to Recalendar are not added for now (add on request).

**Added 2026-11-15** (migration `20261115000000_case_types_i90_birth_certificate.sql`): I-90 and Birth Certificate Amendment, found in the legacy mapping. Staff also entered a new I-90 contract on 2026-11-11. 52 types in total.

## Future
- **Family law (divorce, etc.):** the firm plans to add these case types eventually; not needed now. The design already handles it (they're just new rows in `case_types`). If the non-immigration list grows, a `category` column on `case_types` (immigration / family) could group or filter the dropdown.

## Remaining internal questions
- Contracts covering several people, for example "I-130'S FOR LEONEL & OSKAR MANZO": probably one type, with the extra people in the notes.

## Implementation notes (2026-11-08)
- The display everywhere uses `case_types_label`: picked types, comma-joined and alphabetical, or the legacy text if none are picked yet. The list search and sort use it too, so searching "I-601A" finds both new and legacy contracts.
- Contract form: `ReferenceArrayInput` + `AutocompleteArrayInput` on `case_types` (active only), required. Legacy text shows as helper text ("Old system: ...") until types are picked.
- Removed the unused `caseTypes` config (`defaultConfiguration.ts`, `ConfigurationContext.tsx`, `CRM.tsx`) and the hardcoded list in `ContractInputs.tsx`.
- FakeRest: `dataGenerator/case_types.ts` (copy of the seed list). Contracts get 1-2 random types; a `beforeSave` callback recomputes names/label.
- Verified on dev as the `authenticated` role, in a rolled-back transaction: link/unlink, view label, search, payment schedule label, and the FK blocking deletion of an in-use type. **Not yet clicked through in the browser.**
- Not done: a dedicated case-type filter on the contract list (search covers it for now); legacy mapping; prod deploy.

## Legacy contract mapping (2026-11-15)
- Each hand-typed `case_type` value from the old system was mapped to one or more types from the list. 282 contracts, 142 distinct values. The attorney reviewed every value that wasn't already an exact match (ignoring case) and approved the list, including the 15 rows flagged for confirmation.
- Script: `migration/apply_legacy_case_types.sql`. It only inserts links into `account_contract_case_types`, skips contracts that already have case types from the new form, and can be run again safely. Work descriptions and the legacy `case_type` column are untouched.
- Result: 368 links on 282 contracts, 77 of them with more than one type.
- Also linked by hand: two contracts created on prod 2026-11-09/11 with no case type, where the type was typed in the work description: 14101601A → DACA Renewal, 23120601B → I-90. Probably a browser tab still running the pre-2026-11-08 form, where case type was optional. Not confirmed.
- The legacy `case_type` column can be dropped in a later migration once nothing reads it.
