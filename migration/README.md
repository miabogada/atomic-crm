# OutlookForms → Atomic CRM Migration

Extracts client records from the legacy OutlookForms CRM and generates
ready-to-run SQL for the Atomic CRM local Supabase instance.

---

## Source Systems

| System | Access method | Data |
|---|---|---|
| Exchange 2003 public folders | WebDAV SEARCH (HTTP Basic Auth) | Contacts, tasks, activities, contracts (metadata) |
| `billing_be.mdb` (Access split backend) | `mdb-export` via mdbtools | Clients, contracts, payments |

The two systems are linked by **account number** (`tblClients.Account`), which also appears as the Exchange `ConversationTopic` MAPI property on every item in the Account Tracking public folder.

---

## Prerequisites

```bash
sudo apt-get install mdbtools
pip install requests
cp migration/.env.example migration/.env   # fill in credentials
```

---

## Usage

```bash
# Extract one specific account (for testing)
python3 migration/fetch_sample.py --account 14011101

# Auto-select up to 5 accounts meeting the sample criteria
python3 migration/fetch_sample.py
```

**Before running**, apply all Supabase migrations so the ID lookups work:

```bash
npx supabase migration up
```

**After running**, apply the generated SQL:

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f migration/output/sample_import.sql
```

Then open http://localhost:5173 and verify the accounts appear with contracts,
payments, tasks, and activities.

---

## Output Files

All written to `migration/output/` (gitignored):

| File | Contents |
|---|---|
| `debug_accounts.json` | Raw Access DB records for selected accounts |
| `debug_exchange.json` | Raw Exchange WebDAV item properties |
| `sample_import.sql` | Ready-to-run SQL wrapped in a transaction |

---

## Schema Map

### `accounts` ← `tblClients` + Exchange `IPM.Post.Account info`

| Legacy source | Field | Atomic CRM column |
|---|---|---|
| `tblClients.Account` | account number | `account_number` |
| Exchange `IPM.Post.Account info` subject (stripped of trailing account number) | client name | `name` |
| `tblClients.DateOpen` | date opened | `date_opened` |
| `tblClients.DateConsult` | first consult date | `date_first_consult` |
| `tblClients.Categories` | status/category | `categories` |
| `tblClients.ReferredBy` | referral source | `referred_by` |
| (first admin user from Supabase) | — | `attorney_id`, `law_clerk_id`, `legal_assistant_id`, `user_id` |
| — | — | `archived = FALSE` |

**Note:** `tblClients` stores almost no personal data (no first/last name columns).
The client name comes from the Exchange `IPM.Post.Account info` item subject, which
is formatted as `"LAST, FIRST ACCOUNTNUMBER"`. The trailing account number is stripped.

---

### `account_contacts` ← Exchange `IPM.Contact.Account Contact`

Exchange message class: `IPM.Contact.Account Contact` (capital C — case-sensitive).

| Exchange WebDAV property | Atomic CRM column |
|---|---|
| `urn:schemas:contacts:cn` (FullName / common name) | used to derive `first_name` + `last_name` |
| `urn:schemas:contacts:sn` (surname) | `last_name` |
| `urn:schemas:contacts:givenname` | `first_name` (often empty — see Notes) |
| `urn:schemas:contacts:email1` | `email` |
| `urn:schemas:contacts:businessphone` | `phone` (falls back to `homephone`) |
| `urn:schemas:contacts:workstreet/city/state/postalcode/country` | `address_*` |
| (first contact item) | `is_billing_contact = TRUE` |
| (first admin user from Supabase) | `contact_type_id` (petitioner) |

**Notes:**
- `givenname` is frequently empty on these contacts. The script uses `cn` (full name)
  and strips the trailing surname to derive `first_name`.
- If no Exchange contact exists, falls back to `tblClients` data (usually sparse).
- The VBScript form identifies billing contacts via `JobTitle = "BILLING CONTACT"`,
  but that field is not reliably populated; we use position (first contact) instead.

---

### `account_contracts` ← `tblContracts`

| Legacy field | Atomic CRM column |
|---|---|
| `tblContracts.Contract` | `contract_number` (full number, e.g. `14011101A1`) |
| `tblContracts.CaseType` | `case_type` |
| `tblContracts.DateOpen` | `date_opened` |
| `tblContracts.Fee` | `fee` |
| `tblContracts.Retainer` | `retainer` |
| `tblContracts.Payment` | `monthly_payment` |
| `tblContracts.NumPayments` | `num_payments` |
| `tblContracts.FinalPayment` | `final_payment` |
| `tblContracts.DateRetainer` | `date_retainer` |
| `tblContracts.DateFirstPayment` | `date_first_payment` |
| (inferred) | `status = 'In progress'` |

**Note:** `tblContracts.Contract` already contains the full contract number
(e.g. `14011101A1`). The VBScript generates it as
`ConversationTopic + CaseLetters + SequenceNumber` and stores it in `Item.Subject`,
which Access writes to the `Contract` column. Do not prepend the account number.

---

### `account_payments` ← `tblPaymentsReceived`

| Legacy field | Atomic CRM column |
|---|---|
| `tblPaymentsReceived.Account` | `account_id` (FK lookup by account number) |
| `tblPaymentsReceived.Contract` | `contract_id` (FK lookup by contract number; NULL if blank) |
| `tblPaymentsReceived.DateRecd` | `date_received` |
| `tblPaymentsReceived.AmtRecd` | `amount` |
| `tblPaymentsReceived.PaymentMethod` | `payment_method` |
| `tblPaymentsReceived.CheckNumber` | `reference_number` |

---

### `tasks` ← Exchange `IPM.Task.Account task`

| Exchange WebDAV property | Atomic CRM column |
|---|---|
| `urn:schemas:httpmail:subject` | `text` |
| `urn:schemas:httpmail:date` (message creation date) | `due_date` (see Notes) |
| `http://schemas.microsoft.com/exchange/tasks/datecompleted` | `done_date` |
| `http://schemas.microsoft.com/exchange/tasks/status` | `status` (`"Done"` if status=2 or pct=1, else `"To do"`) |
| ConversationTopic → account number | `account_id` (FK lookup) |

**Notes:**
- Task items in Exchange public folders do **not** populate `duedate`. The script
  uses the message creation date (`urn:schemas:httpmail:date`) as a proxy — this
  is the "Created" column shown in Outlook's Account Tracking column view.
- Task status/completion properties require the `http://schemas.microsoft.com/exchange/tasks/`
  namespace. The `urn:schemas:tasks:` namespace is ignored for items in public
  folders (returns empty for all properties). Status value `2` = Completed;
  percent complete `1.` = 100% done.
- Each task modification generates an `IPM.Post` audit entry ("modified by User")
  in the same folder. These contain no actionable data and are not imported.

---

### `account_activities` ← Exchange `IPM.Activity.Account activity`

| Exchange WebDAV property | Atomic CRM column |
|---|---|
| `urn:schemas:httpmail:subject` | `subject` |
| `urn:schemas:httpmail:textdescription` | `body` |
| `urn:schemas:calendar:dtstart` (falls back to `urn:schemas:httpmail:date`) | `date` |
| `urn:schemas:contacts:journaltype` | `type` (e.g. `"Note"`, `"Phone call"`) |
| ConversationTopic → account number | `account_id` (FK lookup) |

---

## Sample Account Selection Criteria (auto mode)

When run without `--account`, the script selects up to 5 accounts from `tblClients`:

- Has at least one contract in `tblContracts`
- Has at least one payment in `tblPaymentsReceived`
- `date_opened` between 3–8 years ago
- Most recent payment older than 12 months (not actively paying)
- Not marked `"Archive"` in `Categories`

Sorted by last payment date ascending (least-recently-active first).
Falls back to relaxed date filters if fewer than 5 strict matches exist.

---

## Known Issues and Gotchas

### Access DB encoding
`mdb-export` output is Windows-1252 (cp1252), not UTF-8. The script decodes
accordingly and strips NUL bytes (`\x00`) that appear in Access Unicode fields.

### Access DB date format
Dates from `mdb-export` include a time component: `01/11/14 00:00:00`.
The script strips the time by splitting on space before parsing.
Exchange dates use ISO 8601 with a `T` separator (`2018-04-30T16:42:23.377Z`);
the parser also splits on `T` to handle both formats.

### Exchange SCOPE URL
The WebDAV SQL `SCOPE` string must use a **literal space**, not `%20`:
```
SCOPE('shallow traversal of "http://10.0.0.12/public/Account Tracking/"')
```
The HTTP request URL uses `%20` as normal. `config.py` has two separate variables
(`EXCHANGE_FOLDER` for the HTTP request, `EXCHANGE_FOLDER_SCOPE` for the SQL).

### Exchange message class case
The contact message class is `IPM.Contact.Account Contact` (capital C).
All message class comparisons in the script use `.lower()` to avoid this.

### Contact `givenname` property
`urn:schemas:contacts:givenname` returns empty for most contacts.
Use `urn:schemas:contacts:cn` (common name / FullName) instead and strip
the trailing surname to derive `first_name`.

### `user_id` / `contact_type_id` NULLs
These are looked up from the local Supabase instance at runtime. If the database
is empty (migrations not yet applied), they will be NULL in the generated SQL.
Run `npx supabase migration up` before generating the final import.

### Exchange task namespace for public folders
Task items stored in Exchange public folders (not the standard Tasks folder) do
**not** respond to the `urn:schemas:tasks:` WebDAV namespace. All task-specific
properties (`status`, `percentcomplete`, `datecompleted`, `duedate`) return empty
with that namespace. Use `http://schemas.microsoft.com/exchange/tasks/` instead —
confirmed by inspecting the OWA HTML form, which embeds hidden inputs with that
namespace (e.g. `name="http://schemas.microsoft.com/exchange/tasks/percentcomplete"`).

### Supabase key must be the Secret key
The `SUPABASE_SERVICE_KEY` in `.env` must be the **Secret** key from
`npx supabase status`, not the Publishable key. The `contact_types` and `users`
tables only grant SELECT to the `authenticated` role; the secret key bypasses RLS
and can read them without an auth session.
