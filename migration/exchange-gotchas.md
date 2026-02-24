# Migration: Exchange WebDAV Gotchas

Reference: `migration/README.md` has the full schema map and usage docs.
Script: `migration/fetch_sample.py`

---

## Contract payment terms live in Exchange, not Access

The VBScript (`Account contract.vbs`) only writes 5 columns to `tblContracts`:
`Account, Contract, CaseType, DateOpen, Fee`

The full payment terms are stored as **Outlook UserProperties** on the
`IPM.Post.Account contract` Exchange item:

| UserProperty name           | Atomic CRM column       |
|-----------------------------|-------------------------|
| `curRetainer`               | `retainer`              |
| `txtDateRetainer`           | `date_retainer`         |
| `curPayment`                | `monthly_payment`       |
| `txtNumPayments`            | `num_payments`          |
| `txtDateFirstPayment`       | `date_first_payment`    |
| `curFinalPayment`           | `final_payment`         |
| `txtContractWorkDescription`| `work_description`      |

**How to fetch:** PROPFIND allprop on the contract item href, then regex extract.
Do NOT use WebDAV SEARCH SELECT for these — see namespace issue below.

---

## Contract UserProperty namespace breaks Python XML parser

These UserProperties live in the MAPI PS_PUBLIC_STRINGS namespace:
`http://schemas.microsoft.com/mapi/string/{00020329-0000-0000-C000-000000000046}/`

The `{GUID}` in the URI contains literal `{` and `}`, which are **invalid XML
namespace name characters**. When this namespace appears in any Exchange response
(SEARCH or PROPFIND), Python's `xml.etree.ElementTree` (expat) raises:
```
ParseError: syntax error: line 1, column 21
```

**Workaround:** Do NOT include `_NS_CONTRACT` properties in the main SEARCH
SELECT (`ALL_PROPS`). Instead:
1. Identify contract items from the main SEARCH by `message_class = IPM.Post.Account contract`
2. PROPFIND each contract item's href with `<allprop/>`
3. Extract values with regex: `re.findall(r'<tagname[^>]*>([^<]+)</tagname>', text)`

---

## Task properties: wrong namespace for public folders

Exchange public folder task items (`IPM.Task.Account task`) do NOT respond to
`urn:schemas:tasks:` — all properties return empty.

Use: `http://schemas.microsoft.com/exchange/tasks/`
- `status` → value `2` = Completed
- `percentcomplete` → value `1.` (note trailing dot) = 100% done
- `datecompleted` → done date
- `duedate` → always empty in public folders; fall back to `urn:schemas:httpmail:date`

Confirmed by inspecting OWA hidden inputs: `name="http://schemas.microsoft.com/exchange/tasks/percentcomplete"`

---

## Billing contacts are in a separate folder

Billing contacts are in `/public/Billing Contacts/` (a separate public folder),
NOT inside Account Tracking. Account Tracking contact items are sparse.

The script issues a second WebDAV SEARCH against `Billing Contacts` per account,
then falls back to Account Tracking contacts if none found.

Address fields use **HOME** properties (not work/biz), and names are **case-sensitive**:
`homeStreet`, `homeCity`, `homeState`, `homePostalCode`, `homeCountry`

---

## Exchange WebDAV general gotchas

- **SCOPE URL:** use a literal space, not `%20`, in the DAV SQL SCOPE string
  (the HTTP request URL uses `%20` normally — two separate variables in the script)
- **Message class comparison:** always `.lower()` — Exchange returns mixed case
  (`IPM.Contact.Account Contact` with capital C)
- **`givenname` empty in Account Tracking:** use `cn` (FullName) and strip surname;
  Billing Contacts folder items correctly populate `givenname`
- **Access DB dates:** format `MM/DD/YY HH:MM:SS` — split on space then parse
- **Exchange dates:** ISO 8601 `2018-04-30T16:42:23.377Z` — split on `T` then parse
- **Access DB encoding:** cp1252 (Windows-1252), not UTF-8; strip `\x00` NUL bytes

---

## Supabase: use the Secret key, not Publishable

`contact_types` and `users` tables only grant SELECT to `authenticated` role.
With the publishable (anon) key, both return 0 rows.

Get the secret key: `npx supabase status` → `Service role key`
Set in `migration/.env` as `SUPABASE_SERVICE_KEY`.

---

## Diagnosing unknown Exchange properties

When a property returns empty or wrong values:
1. GET the OWA HTML form for the item: `requests.get(item_href, auth=auth)`
2. Search the HTML for hidden inputs: `<input name="namespace/property" value="...">`
3. The `name` attribute gives the exact property URI to use in WebDAV SEARCH

This is how the tasks namespace fix was discovered (OWA shows
`name="http://schemas.microsoft.com/exchange/tasks/percentcomplete"`).
