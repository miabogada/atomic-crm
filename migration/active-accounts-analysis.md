# Active Accounts Analysis — Migration Criteria

Determines which accounts from the legacy system should be migrated to Atomic CRM.

---

## Primary Signal: rptInvoices (Access billing report)

The attorney runs "Prepare Invoices" monthly from the Outlook billing toolbar
(`ModuleAddMenuBilling.bas → PrepareInvoicesHandler`). This calls
`DoCmd.OutputTo "rptInvoices"` with **no WhereCondition** — all filtering is
inside the query chain in `billing.mdb`.

### Query chain powering `rptInvoices`

```
rptInvoices
  └── qryPaymentsDueAndOneNotInvoiced30days
        ├── qryPaymentDue
        │     ├── tblPaymentSchedule
        │     └── tblContracts
        ├── qryBillAmountByContract
        │     └── tblPaymentSchedule (SUM AmtDue per Contract)
        ├── tblContracts
        ├── tblOutlookClients  ← linked table in billing.mdb; NOT in billing_be.mdb
        └── qryBalance
```

### WHERE conditions of `qryPaymentsDueAndOneNotInvoiced30days`

Extracted from `billing.mdb` binary (UTF-16LE, offset ~1074640):

```
(qryBalance!Fee - qryBalance!SumOfAmtRecd) <> 0
AND tblPaymentSchedule.DateDue <= DateAdd("d", 15, Now())
AND (tblPaymentSchedule.AmtRecd = 0 OR tblPaymentSchedule.AmtRecd IS NULL)
AND tblOutlookClients.[Message Class] = "IPM.Contact.Account Contact"
AND tblOutlookClients.Title = "BILLING CONTACT"
AND (tblPaymentSchedule.DateInvoiced <= DateAdd("m", -1, Now())
     OR tblPaymentSchedule.DateInvoiced IS NULL)
```

**AgeDays computed column:**
```
IIf(IsNull([DateRecd]),
    DateDiff("d", [DateDue], Now()),
    DateDiff("d", [DateDue], [DateRecd]))
```

Categorized as: NotInvoiced / InvoicedNotDue / 0to29Days / 30to59Days /
60to89Days / 90to119Days / 120Days.

### Why `DateInvoiced` is useless as a filter

`tblPaymentSchedule.DateInvoiced` was last populated **2002-08-13**.
The companion update query `qupdPaymentsInvoiced` was abandoned after that.
931 rows have a DateInvoiced; all are between 2001-10-23 and 2002-08-13.
For all practical purposes DateInvoiced IS NULL for everything since 2002,
so the `DateInvoiced <= last month OR NULL` condition is always TRUE.

**The real active-account gatekeeper** is `tblOutlookClients.Title = "BILLING CONTACT"`.
Accounts archived in Outlook (moved to Archive 20XX folders) no longer appear
in the active Account Tracking folder and thus have no billing contact record
in `tblOutlookClients`.

`tblOutlookClients` is a **linked table** that exists only in `billing.mdb`
(the front-end). It is NOT in `billing_be.mdb` and cannot be queried with
mdbtools. Its data comes from the Outlook public folder store.

---

## Equivalent query on `billing_be.mdb`

Since `tblOutlookClients` is unavailable, use future `DateDue` as the proxy
for active accounts (an archived account would not have future payment schedule
entries pointing at it).

```python
# Python equivalent — see migration/fetch_active_accounts.py
# Criteria:
#   DateDue between today and today+90 days
#   AmtRecd = 0 or NULL
#   Fee - SumOfAmtRecd (per contract) > 0
#   tblClients.Categories != "Archive"  (optional additional filter)
```

**Result as of 2026-02-24: 77 accounts**

These are the primary migration candidates.

---

## How to reproduce this analysis

### Prerequisites

```bash
sudo apt-get install mdbtools python3
```

Both `billing.mdb` and `billing_be.mdb` must be present at:
```
/home/f4rrest/Documents/clarklaw-domain/outlookforms/accessdb/
```

### Extract the 77-account list

Run:
```bash
python3 migration/fetch_active_accounts.py
```

This outputs `migration/output/active_accounts.csv`.

### Extracting query SQL from billing.mdb (for reference)

`mdb-queries` is not available in mdbtools 0.7.1. Use the binary extraction
approach — Access stores query SQL as UTF-16LE strings inside the .mdb file:

```python
import re

with open("billing.mdb", "rb") as f:
    data = f.read()

select_bytes = b'S\x00E\x00L\x00E\x00C\x00T\x00'
pos = 0
while True:
    pos = data.find(select_bytes, pos)
    if pos == -1:
        break
    chunk = data[pos:pos+3000].decode('utf-16-le', errors='replace')
    clean = ''.join(c for c in chunk if ord(c) < 0x2000 or c in ' \r\n\t')
    print(clean[:500])
    pos += 2
```

Key query names found in `billing.mdb`:
- `qryInvoices` — joins `qryPaymentDue` + `qryBillAmountByContract`
- `qryPaymentsDueAndOneNotInvoiced30days` — main report source (WHERE clause above)
- `qryPaymentDueNotInvoiced30days` — older/alternate version
- `qryPaymentDue` — base: unpaid schedule rows joined with contract/balance data
- `qryBillAmountByContract` — SUM(AmtDue) per contract
- `qryBalance` — Fee minus SumOfAmtRecd per contract
- `qupdPaymentsInvoiced` — update query that SHOULD set DateInvoiced (abandoned 2002)
- `qryPaymentsDueAndReceived` — union of payments due + received (used in other reports)

---

## Account list (2026-02-24 snapshot)

> **PII — stored in `migration/output/active-accounts-snapshot.md` (gitignored)**
>
> Run `python3 migration/fetch_active_accounts.py` to regenerate, or see the
> attorney review document at `migration/proposed-migration-accounts.md`.

<!-- Account table removed — account numbers, balances, and case types are
     client-confidential. Data stored in migration/output/ (gitignored).
     Regenerate with: python3 migration/fetch_active_accounts.py -->

---

## Additional migration signals (Exchange-based)

This list (77 accounts) covers the primary billing signal. Combine with:

- **Open tasks with future due dates** (Exchange `IPM.Task.Account task`):
  due date > today. Bound: ignore tasks created before 2020 with no due date.
- **Recent activities/notes** (Exchange `IPM.Activity.Account activity`):
  created within last 18 months.
- **Active contracts** (inferred): last payment activity within 18 months.
  No contract end date is stored — this is a known gap.
  → Feature request: add key dates / deadlines to contracts in Atomic CRM.

The 77 billing accounts are a subset of the full migration list.
Exchange activity signals will add accounts that are being worked on
but are not yet on a payment schedule (e.g., recently opened, flat-fee paid).

---

## Balance calculation — critical data source issue

### Problem (identified 2026-03-08)

`tblPaymentSchedule.AmtRecd` is **almost never updated** after the initial
retainer payment. The actual payments are recorded in `tblPaymentsReceived`,
where most entries have a **blank Contract field** (linked only by account number).

Using `tblPaymentSchedule.AmtRecd` for balance overstated balances by thousands
of dollars on 75 out of 82 migration accounts.

### Correct balance formula

```
balance = sum(Fee across all contracts for account) - sum(tblPaymentsReceived.AmtRecd)
```

`fetch_active_accounts.py` was fixed (2026-03-08) to use `tblPaymentsReceived`.

### Access vs Exchange discrepancies

A QA spot-check of account 22121601 revealed that `tblPaymentsReceived` (Access)
and `IPM.Post.Account payment` items (Exchange) can disagree:

- Exchange captures payment reversals (negative amounts) that Access does not
- Recent payments may exist in Exchange but not yet in Access
- In the 22121601 example: Access shows $12,600 received, Exchange shows $12,000
  (due to an unrecorded $300 reversal and a recent $400 payment)

**Exchange is the authoritative source** for payment history. The VBScript
`Account payment` form triggers the Access insert, but corrections/reversals
done in Exchange may not propagate back to Access.

See `migration/migration-workflow.md` for the reconciliation procedure.

---

## Payment-to-contract association gap

Most rows in `tblPaymentsReceived` have a **blank `Contract` field**. The
client makes one payment per month that may cover installments across multiple
active contracts. The billing system tracks received amounts at the account
level, not per-contract.

### Known complications for migration

1. **Single-contract accounts** — safe to auto-associate all payments
2. **Multi-contract with one active** — associate payments dated after the
   active contract's open date
3. **Multi-contract with stacked payments** — monthly payment amounts may be
   the sum of two or more contract installments. Splitting requires comparing
   against `tblPaymentSchedule` amounts and dates.
4. **Lump sum payments** — client pays more than a single scheduled installment.
   The existing balance formula handles this (balance = fee - total received),
   but the payment schedule rows won't match 1:1 with actual payment records.

### Future: split payment support

Atomic CRM currently assigns each payment to at most one contract. A future
feature is needed to split a single payment across multiple contracts (e.g.,
one $800 check covering $400 to contract A and $400 to contract B).

---

## Files referenced

| File | Location |
|------|----------|
| `billing.mdb` (front-end, queries/reports) | `outlookforms/accessdb/billing.mdb` |
| `billing_be.mdb` (back-end, all data) | `outlookforms/accessdb/billing_be.mdb` |
| Billing VBA module | `outlookforms/ModuleAddMenuBilling.bas` |
| Migration fetch script | `migration/fetch_sample.py` |
| Exchange gotchas | `migration/exchange-gotchas.md` |
