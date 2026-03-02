"""
Identify actively billed accounts from billing_be.mdb.

Replicates the rptInvoices logic from the legacy Access billing system,
substituting "DateDue in next 90 days" for the unavailable
tblOutlookClients.Title = "BILLING CONTACT" filter.

See migration/active-accounts-analysis.md for full documentation.

Usage:
    python3 migration/fetch_active_accounts.py [--days 90]

Output:
    migration/output/active_accounts.csv
"""

import argparse
import csv
import io
import os
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta

DB = os.path.join(
    os.path.dirname(__file__),
    "../../outlookforms/accessdb/billing_be.mdb"
)
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def export_table(db_path, table):
    result = subprocess.run(
        ["mdb-export", "-D", "%Y-%m-%d", db_path, table],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"mdb-export failed for {table}: {result.stderr.decode()}")
    text = result.stdout.decode("cp1252", errors="replace").replace("\x00", "")
    return list(csv.DictReader(io.StringIO(text)))


def parse_date(s):
    s = (s or "").strip().split(" ")[0]
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Include accounts with DateDue within this many days (default: 90)",
    )
    args = parser.parse_args()

    today = datetime.today()
    future_cutoff = today + timedelta(days=args.days)

    print(f"Loading tables from {DB}...")
    schedule = export_table(DB, "tblPaymentSchedule")
    contracts = export_table(DB, "tblContracts")
    clients = export_table(DB, "tblClients")
    print(f"  tblPaymentSchedule: {len(schedule)} rows")
    print(f"  tblContracts:       {len(contracts)} rows")
    print(f"  tblClients:         {len(clients)} rows")

    # Index contracts
    fee_by_contract = {}
    account_by_contract = {}
    casetype_by_contract = {}
    for r in contracts:
        fee_by_contract[r["Contract"]] = float(r.get("Fee") or 0)
        account_by_contract[r["Contract"]] = r["Account"]
        casetype_by_contract[r["Contract"]] = r.get("CaseType", "")

    # Index clients
    name_by_account = {}
    categories_by_account = {}
    for r in clients:
        name_by_account[r["Account"]] = r.get("SpouseName", "")  # closest to a name field
        categories_by_account[r["Account"]] = r.get("Categories", "")

    # Build qryBalance equivalent: sum AmtRecd per contract from schedule
    sum_recd_by_contract = defaultdict(float)
    for r in schedule:
        try:
            sum_recd_by_contract[r["Contract"]] += float(r.get("AmtRecd") or 0)
        except (ValueError, KeyError):
            pass

    # Find matching rows
    matched_accounts = {}  # account -> best (earliest upcoming) row

    for r in schedule:
        # Condition: AmtRecd = 0 or NULL
        if float(r.get("AmtRecd") or 0) > 0:
            continue

        # Condition: DateDue in range [today, today+days]
        date_due = parse_date(r.get("DateDue"))
        if date_due is None or date_due < today or date_due > future_cutoff:
            continue

        contract = r["Contract"]
        fee = fee_by_contract.get(contract, 0)
        balance = fee - sum_recd_by_contract.get(contract, 0)

        # Condition: outstanding balance > 0
        if balance <= 0:
            continue

        account = account_by_contract.get(contract, "")
        if not account:
            continue

        # Keep earliest upcoming due date per account
        if account not in matched_accounts or date_due < matched_accounts[account]["date_due"]:
            matched_accounts[account] = {
                "account": account,
                "contract": contract,
                "date_due": date_due,
                "date_due_str": date_due.strftime("%Y-%m-%d"),
                "amt_due": r.get("AmtDue", ""),
                "balance": f"{balance:.2f}",
                "case_type": casetype_by_contract.get(contract, ""),
                "categories": categories_by_account.get(account, ""),
            }

    rows = sorted(matched_accounts.values(), key=lambda r: (r["date_due_str"], r["account"]))

    # Write CSV
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, "active_accounts.csv")
    fieldnames = ["account", "contract", "date_due_str", "amt_due", "balance", "case_type", "categories"]
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nFound {len(rows)} active accounts (DateDue next {args.days} days)")
    print(f"Written to: {out_path}")

    # Print summary table
    print(f"\n{'Account':<12} {'Next Due':<12} {'Balance':>10}  Case Type")
    print("-" * 70)
    for r in rows:
        print(f"{r['account']:<12} {r['date_due_str']:<12} {r['balance']:>10}  {r['case_type'][:35]}")


if __name__ == "__main__":
    main()
