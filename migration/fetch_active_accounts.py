"""
Identify actively billed accounts from billing_be.mdb.

Replicates the rptInvoices logic from the legacy Access billing system,
substituting "DateDue in next 90 days" for the unavailable
tblOutlookClients.Title = "BILLING CONTACT" filter.

See migration/active-accounts-analysis.md for full documentation.

Balance calculation uses tblPaymentsReceived (actual payments), NOT
tblPaymentSchedule.AmtRecd (which is rarely updated after retainer).
Balance = sum(Fee across all contracts for account) - sum(tblPaymentsReceived.AmtRecd).

Usage:
    python3 migration/fetch_active_accounts.py [--days 90]
    python3 migration/fetch_active_accounts.py --update-proposed

Output:
    migration/output/active_accounts.csv
    migration/output/proposed-migration-accounts.csv (with --update-proposed)
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


def load_db_tables(db_path):
    """Load all tables needed for balance and active-account calculations."""
    print(f"Loading tables from {db_path}...")
    tables = {
        "schedule": export_table(db_path, "tblPaymentSchedule"),
        "contracts": export_table(db_path, "tblContracts"),
        "clients": export_table(db_path, "tblClients"),
        "payments": export_table(db_path, "tblPaymentsReceived"),
    }
    for name, rows in tables.items():
        print(f"  {name}: {len(rows)} rows")
    return tables


def build_account_balances(tables):
    """Compute balance per account using tblPaymentsReceived (actual payments).

    Balance = sum(Fee for all contracts on account) - sum(PaymentsReceived).
    This matches the real-world balance the attorney sees, unlike the
    tblPaymentSchedule.AmtRecd approach which is almost never updated.
    """
    contracts = tables["contracts"]
    payments = tables["payments"]

    # Total fee per account (sum across all contracts)
    fee_by_account = defaultdict(float)
    for c in contracts:
        fee_by_account[c["Account"]] += float(c.get("Fee") or 0)

    # Total received per account from tblPaymentsReceived
    received_by_account = defaultdict(float)
    for p in payments:
        received_by_account[p.get("Account", "")] += float(p.get("AmtRecd") or 0)

    # Balance = fee - received
    balance_by_account = {}
    all_accounts = set(fee_by_account.keys()) | set(received_by_account.keys())
    for acct in all_accounts:
        balance_by_account[acct] = fee_by_account.get(acct, 0) - received_by_account.get(acct, 0)

    return balance_by_account, fee_by_account, received_by_account


def find_active_accounts(tables, days):
    """Find accounts with upcoming unpaid schedule rows (active billing)."""
    today = datetime.today()
    future_cutoff = today + timedelta(days=days)
    schedule = tables["schedule"]
    contracts = tables["contracts"]

    balance_by_account, _, _ = build_account_balances(tables)

    # Index contracts
    account_by_contract = {}
    casetype_by_contract = {}
    for c in contracts:
        account_by_contract[c["Contract"]] = c["Account"]
        casetype_by_contract[c["Contract"]] = c.get("CaseType", "")

    # Index clients
    categories_by_account = {}
    for c in tables["clients"]:
        categories_by_account[c["Account"]] = c.get("Categories", "")

    matched_accounts = {}

    for r in schedule:
        # Condition: AmtRecd = 0 or NULL (unpaid schedule row)
        if float(r.get("AmtRecd") or 0) > 0:
            continue

        # Condition: DateDue in range [today, today+days]
        date_due = parse_date(r.get("DateDue"))
        if date_due is None or date_due < today or date_due > future_cutoff:
            continue

        contract = r["Contract"]
        account = account_by_contract.get(contract, "")
        if not account:
            continue

        # Condition: outstanding account balance > 0
        balance = balance_by_account.get(account, 0)
        if balance <= 0:
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

    return sorted(matched_accounts.values(), key=lambda r: (r["date_due_str"], r["account"]))


def update_proposed_csv(tables):
    """Re-read proposed-migration-accounts.csv and update Balance column
    using tblPaymentsReceived-based balances."""
    proposed_path = os.path.join(OUTPUT_DIR, "proposed-migration-accounts.csv")
    if not os.path.exists(proposed_path):
        print(f"ERROR: {proposed_path} not found")
        return

    balance_by_account, fee_by_account, received_by_account = build_account_balances(tables)

    rows = []
    with open(proposed_path, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            acct = row["Account"]
            bal = balance_by_account.get(acct)
            if bal is not None:
                old_bal = row["Balance"]
                row["Balance"] = f"${bal:,.0f}" if bal >= 0 else f"-${abs(bal):,.0f}"
                if old_bal != row["Balance"]:
                    print(f"  {acct}: {old_bal} -> {row['Balance']}  "
                          f"(fee={fee_by_account.get(acct, 0):,.0f}, "
                          f"received={received_by_account.get(acct, 0):,.0f})")
            rows.append(row)

    # Write back
    with open(proposed_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nUpdated {len(rows)} rows in {proposed_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Include accounts with DateDue within this many days (default: 90)",
    )
    parser.add_argument(
        "--update-proposed",
        action="store_true",
        help="Update Balance column in proposed-migration-accounts.csv",
    )
    args = parser.parse_args()

    tables = load_db_tables(DB)

    if args.update_proposed:
        update_proposed_csv(tables)
        return

    rows = find_active_accounts(tables, args.days)

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
