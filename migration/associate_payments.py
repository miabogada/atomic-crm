#!/usr/bin/env python3
"""
associate_payments.py — Phase 2: Auto-link unlinked payments to contracts.

Rules (priority order):
  1. Single-contract accounts — all payments → that contract
  2. Date-range matching — sequential contracts, [date_opened, next.date_opened)
  3. Amount matching — concurrent contracts, match against monthly_payment
  4. Unresolved — leave NULL, log for manual review

Usage:
  python3 migration/associate_payments.py           # dry run: generate CSV + SQL
  python3 migration/associate_payments.py --apply   # generate + apply SQL via docker psql

Output:
  migration/output/associate_payments_report.csv
  migration/output/associate_payments_contract_summary.csv
  migration/output/associate_payments.sql
"""

import csv
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Optional

# Reuse shared infrastructure from fetch_sample.py
sys.path.insert(0, str(Path(__file__).parent))
from fetch_sample import OUTPUT_DIR, _supabase_get, sql_str


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def _supabase_get_all(path: str, params: dict, page_size: int = 999) -> list:
    """Paginate through Supabase REST API to fetch all rows."""
    all_rows = []
    offset = 0
    while True:
        p = dict(params)
        p["limit"] = str(page_size)
        p["offset"] = str(offset)
        rows = _supabase_get(path, p)
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return all_rows


def fetch_unlinked_payments() -> list:
    """Fetch all payments with contract_id IS NULL."""
    return _supabase_get_all("account_payments", {
        "select": "id,account_id,date_received,amount,type,contract_id",
        "contract_id": "is.null",
        "type": "eq.payment",
        "order": "date_received",
    })


def fetch_linked_payments() -> list:
    """Fetch all payments that already have a contract_id (retainers)."""
    return _supabase_get_all("account_payments", {
        "select": "id,account_id,amount,contract_id",
        "contract_id": "not.is.null",
        "type": "eq.payment",
    })


def fetch_contracts() -> list:
    """Fetch all contracts."""
    return _supabase_get_all("account_contracts", {
        "select": "id,account_id,contract_number,date_opened,fee,monthly_payment",
        "order": "date_opened",
    })


def fetch_accounts() -> list:
    """Fetch all accounts."""
    return _supabase_get_all("accounts", {
        "select": "id,account_number,name",
        "deleted_at": "is.null",
    })


# ---------------------------------------------------------------------------
# Classification and rule application — capacity-aware filling
# ---------------------------------------------------------------------------

def parse_date_str(d) -> Optional[date]:
    """Parse a date string (YYYY-MM-DD or ISO datetime) to a date object."""
    if not d:
        return None
    s = str(d)[:10]
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def classify_and_link(payments: list, contracts: list,
                      linked_payments: Optional[list] = None) -> list:
    """Apply capacity-aware rules to link each payment to a contract.

    Processes payments per-account in chronological order, tracking a running
    total per contract. A contract is "full" once its running total >= fee,
    and subsequent payments spill to the next contract.

    Rules (priority order):
      1. Single-contract — all payments → that contract
      2. Date-range with capacity cap — assign to date-range contract unless
         full, then spill forward
      3. Amount matching with capacity — concurrent contracts, prefer the
         amount-matched contract that still has remaining capacity
      4. Unresolved — leave NULL
    """

    # Group contracts and payments by account
    contracts_by_acct = defaultdict(list)
    for c in contracts:
        contracts_by_acct[c["account_id"]].append(c)
    for acct_id in contracts_by_acct:
        contracts_by_acct[acct_id].sort(
            key=lambda c: parse_date_str(c["date_opened"]) or date.min
        )

    payments_by_acct = defaultdict(list)
    for p in payments:
        payments_by_acct[p["account_id"]].append(p)

    # Initialize running totals from already-linked payments
    running_total = defaultdict(float)  # contract_id → sum of linked amounts
    if linked_payments:
        for p in linked_payments:
            cid = p.get("contract_id")
            if cid:
                running_total[cid] += float(p["amount"] or 0)

    results = []

    for acct_id, acct_payments in payments_by_acct.items():
        acct_contracts = contracts_by_acct.get(acct_id, [])

        # Sort payments chronologically within each account
        acct_payments.sort(
            key=lambda p: parse_date_str(p["date_received"]) or date.min
        )

        for p in acct_payments:
            p_date = parse_date_str(p["date_received"])
            p_amount = float(p["amount"] or 0)

            result = {
                "payment_id": p["id"],
                "account_id": acct_id,
                "date_received": p["date_received"],
                "amount": p_amount,
                "proposed_contract_id": None,
                "proposed_contract_number": None,
                "rule": None,
                "reason": None,
            }

            if not acct_contracts:
                result["rule"] = "none"
                result["reason"] = "no contracts for account"
                results.append(result)
                continue

            # Rule 1: Single-contract account
            if len(acct_contracts) == 1:
                c = acct_contracts[0]
                result["proposed_contract_id"] = c["id"]
                result["proposed_contract_number"] = c["contract_number"]
                result["rule"] = "single-contract"
                result["reason"] = f"only contract {c['contract_number']}"
                running_total[c["id"]] += p_amount
                results.append(result)
                continue

            # Multi-contract: capacity-aware matching
            matched_contract, rule, reason = _match_with_capacity(
                p_date, p_amount, acct_contracts, running_total
            )

            if matched_contract:
                result["proposed_contract_id"] = matched_contract["id"]
                result["proposed_contract_number"] = matched_contract["contract_number"]
                result["rule"] = rule
                result["reason"] = reason
                running_total[matched_contract["id"]] += p_amount
            else:
                result["rule"] = rule or "unresolved"
                result["reason"] = reason or "no matching contract"

            results.append(result)

    return results


def _remaining_capacity(contract: dict, running_total: dict) -> float:
    """How much more a contract can absorb before exceeding its fee."""
    fee = float(contract.get("fee") or 0)
    filled = running_total.get(contract["id"], 0.0)
    return fee - filled


def _is_full(contract: dict, running_total: dict) -> bool:
    """True if contract's running total >= fee (no remaining capacity)."""
    return _remaining_capacity(contract, running_total) < 0.01


def _match_with_capacity(
    p_date: Optional[date],
    p_amount: float,
    contracts: list,
    running_total: dict,
) -> tuple:
    """Match a payment to a contract using date-range + capacity + amount.

    Returns (contract_or_None, rule_str, reason_str).
    """
    if not p_date:
        return None, "unresolved", "no payment date"

    # Identify the date-range contract (ignoring capacity)
    date_match_idx = _find_date_range_idx(p_date, contracts)

    # Check for concurrent contracts at the matched period
    if date_match_idx is not None:
        match_date = parse_date_str(contracts[date_match_idx]["date_opened"])
        concurrent = [
            (i, c) for i, c in enumerate(contracts)
            if parse_date_str(c["date_opened"]) == match_date
        ]
    else:
        concurrent = []

    # --- Non-concurrent: date-range with capacity spill ---
    if len(concurrent) <= 1:
        if date_match_idx is None:
            return None, "unresolved", "payment date outside all contract ranges"

        c = contracts[date_match_idx]
        c_date = parse_date_str(c["date_opened"])

        # Boundary payoff: payment lands exactly on this contract's date_opened
        # and exactly fills the prior contract's remaining capacity → prior contract
        if date_match_idx > 0 and c_date and p_date == c_date and p_amount > 0:
            prev = contracts[date_match_idx - 1]
            prev_remaining = _remaining_capacity(prev, running_total)
            if prev_remaining > 0.01 and abs(p_amount - prev_remaining) < 0.01:
                return prev, "boundary-payoff", (
                    f"${p_amount:.2f} on {c['contract_number']} boundary "
                    f"exactly fills remaining "
                    f"${prev_remaining:.2f} on {prev['contract_number']}"
                )

        # If date-range contract still has capacity, use it
        if not _is_full(c, running_total):
            return c, "date-range", (
                f"falls in range for {c['contract_number']} "
                f"(opened {c['date_opened']})"
            )

        # Contract is full — try previous contract if it has capacity
        if date_match_idx > 0:
            prev = contracts[date_match_idx - 1]
            prev_remaining = _remaining_capacity(prev, running_total)
            if prev_remaining >= p_amount - 0.01:
                return prev, "capacity-spill-back", (
                    f"{c['contract_number']} full, "
                    f"${p_amount:.2f} fits remaining "
                    f"${prev_remaining:.2f} on {prev['contract_number']}"
                )

        # Try spilling forward to next contract with capacity
        for j in range(date_match_idx + 1, len(contracts)):
            fwd = contracts[j]
            if not _is_full(fwd, running_total):
                return fwd, "capacity-spill-fwd", (
                    f"{c['contract_number']} full, "
                    f"spilled forward to {fwd['contract_number']}"
                )

        # All contracts full — assign to date-range contract anyway
        return c, "date-range-overflow", (
            f"all contracts full, assigned to date-range match "
            f"{c['contract_number']}"
        )

    # --- Concurrent contracts: amount matching with capacity ---
    # Filter to concurrent contracts that still have capacity
    available = [(i, c) for i, c in concurrent if not _is_full(c, running_total)]

    if not available:
        # All concurrent contracts full — spill forward
        last_concurrent_idx = max(i for i, _ in concurrent)
        for j in range(last_concurrent_idx + 1, len(contracts)):
            fwd = contracts[j]
            if not _is_full(fwd, running_total):
                return fwd, "capacity-spill-fwd", (
                    f"concurrent contracts full, "
                    f"spilled forward to {fwd['contract_number']}"
                )
        # Truly full — assign to first concurrent
        c = concurrent[0][1]
        return c, "concurrent-overflow", (
            f"all contracts full, assigned to {c['contract_number']}"
        )

    # Amount matching among available concurrent contracts
    monthly_matches = []
    for i, c in available:
        mp = float(c.get("monthly_payment") or 0)
        if mp > 0 and abs(p_amount - mp) < 0.01:
            monthly_matches.append((i, c))

    if len(monthly_matches) == 1:
        c = monthly_matches[0][1]
        return c, "amount-match", (
            f"amount ${p_amount:.2f} matches monthly_payment "
            f"of {c['contract_number']}"
        )

    if len(monthly_matches) > 1:
        # Multiple amount matches — prefer the one with more remaining capacity
        best = max(monthly_matches,
                   key=lambda ic: _remaining_capacity(ic[1], running_total))
        c = best[1]
        return c, "amount-match-capacity", (
            f"amount ${p_amount:.2f} matches multiple, "
            f"picked {c['contract_number']} (most capacity)"
        )

    # No amount match — pick available contract with most remaining capacity
    best = max(available,
               key=lambda ic: _remaining_capacity(ic[1], running_total))
    c = best[1]
    return c, "concurrent-capacity", (
        f"no amount match, assigned to {c['contract_number']} "
        f"(most remaining capacity)"
    )


def _find_date_range_idx(p_date: date, contracts: list) -> Optional[int]:
    """Find the index of the contract whose date range contains p_date.

    Range is [date_opened, next_different_date_opened). Last group gets all
    subsequent payments. Payments before the first contract go to index 0.
    """
    # Build list of unique date boundaries
    boundaries = []  # [(date, first_contract_idx)]
    seen = set()
    for i, c in enumerate(contracts):
        d = parse_date_str(c["date_opened"])
        if d and d not in seen:
            seen.add(d)
            boundaries.append((d, i))
    boundaries.sort()

    if not boundaries:
        return None

    # Payment before first contract
    if p_date < boundaries[0][0]:
        return boundaries[0][1]

    # Find which boundary period
    for k in range(len(boundaries)):
        bd, idx = boundaries[k]
        if k + 1 < len(boundaries):
            next_bd = boundaries[k + 1][0]
            if bd <= p_date < next_bd:
                return idx
        else:
            if p_date >= bd:
                return idx

    return None


# ---------------------------------------------------------------------------
# Balance validation & reporting
# ---------------------------------------------------------------------------

def compute_balance_data(
    results: list,
    linked_payments: list,
    contracts: list,
    accounts: list,
) -> tuple:
    """Compute per-contract totals and enrich results with balance columns.
    Returns (enriched_results, contract_summaries)."""

    acct_map = {a["id"]: a for a in accounts}
    contract_map = {c["id"]: c for c in contracts}

    # Sum already-linked payments per contract
    existing_totals = defaultdict(float)
    existing_counts = defaultdict(int)
    for p in linked_payments:
        cid = p["contract_id"]
        if cid:
            existing_totals[cid] += float(p["amount"] or 0)
            existing_counts[cid] += 1

    # Sum proposed-linked payments per contract
    proposed_totals = defaultdict(float)
    proposed_counts = defaultdict(int)
    for r in results:
        cid = r["proposed_contract_id"]
        if cid:
            proposed_totals[cid] += float(r["amount"] or 0)
            proposed_counts[cid] += 1

    # Enrich each result row with contract balance info
    enriched = []
    for r in results:
        cid = r["proposed_contract_id"]
        if cid and cid in contract_map:
            c = contract_map[cid]
            fee = float(c.get("fee") or 0)
            total_linked = existing_totals[cid] + proposed_totals[cid]
            balance = fee - total_linked
            r["contract_fee"] = fee
            r["contract_total_linked"] = round(total_linked, 2)
            r["contract_balance"] = round(balance, 2)
        else:
            r["contract_fee"] = ""
            r["contract_total_linked"] = ""
            r["contract_balance"] = ""
        enriched.append(r)

    # Build per-contract summary
    contract_summaries = []
    for c in contracts:
        cid = c["id"]
        fee = float(c.get("fee") or 0)
        total = existing_totals[cid] + proposed_totals[cid]
        balance = fee - total
        count = existing_counts[cid] + proposed_counts[cid]
        acct = acct_map.get(c["account_id"], {})

        status = "paid" if abs(balance) < 0.01 else ("underpaid" if balance > 0 else "overpaid")

        contract_summaries.append({
            "contract_number": c["contract_number"],
            "account_number": acct.get("account_number", ""),
            "account_name": acct.get("name", ""),
            "fee": fee,
            "total_linked": round(total, 2),
            "balance": round(balance, 2),
            "payment_count": count,
            "status": status,
        })

    return enriched, contract_summaries


# ---------------------------------------------------------------------------
# Output generation
# ---------------------------------------------------------------------------

def write_payment_report(results: list, accounts: list, path: Path):
    """Write per-payment CSV report."""
    acct_map = {a["id"]: a for a in accounts}
    fieldnames = [
        "payment_id", "account_number", "account_name", "date_received",
        "amount", "proposed_contract_number", "rule", "reason",
        "contract_fee", "contract_total_linked", "contract_balance",
    ]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in results:
            acct = acct_map.get(r["account_id"], {})
            w.writerow({
                "payment_id": r["payment_id"],
                "account_number": acct.get("account_number", ""),
                "account_name": acct.get("name", ""),
                "date_received": r["date_received"],
                "amount": r["amount"],
                "proposed_contract_number": r["proposed_contract_number"] or "",
                "rule": r["rule"],
                "reason": r["reason"],
                "contract_fee": r["contract_fee"],
                "contract_total_linked": r["contract_total_linked"],
                "contract_balance": r["contract_balance"],
            })


def write_contract_summary(summaries: list, path: Path):
    """Write per-contract CSV summary."""
    fieldnames = [
        "contract_number", "account_number", "account_name",
        "fee", "total_linked", "balance", "payment_count", "status",
    ]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for s in summaries:
            w.writerow(s)


def generate_sql(results: list) -> str:
    """Generate SQL UPDATE statements wrapped in a transaction."""
    lines = [
        "-- associate_payments.py — auto-link payments to contracts",
        "-- Phase 2 of migration workflow",
        "",
        "BEGIN;",
        "",
    ]

    count = 0
    for r in results:
        cid = r["proposed_contract_id"]
        if not cid:
            continue
        pid = r["payment_id"]
        lines.append(
            f"UPDATE account_payments SET contract_id = {cid} "
            f"WHERE id = {pid} AND contract_id IS NULL;"
        )
        count += 1

    lines.extend([
        "",
        "-- Verify: count linked vs unlinked",
        "SELECT",
        "  count(*) FILTER (WHERE contract_id IS NOT NULL) AS linked,",
        "  count(*) FILTER (WHERE contract_id IS NULL) AS unlinked",
        "FROM account_payments",
        "WHERE type = 'payment';",
        "",
        "COMMIT;",
        "",
    ])

    return "\n".join(lines), count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Phase 2: Auto-link payments to contracts"
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Apply the generated SQL directly via docker psql",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Associate Payments — Phase 2")
    print("=" * 60)
    print()

    # Fetch data
    print("Fetching data from Supabase...")
    unlinked = fetch_unlinked_payments()
    linked = fetch_linked_payments()
    contracts = fetch_contracts()
    accounts = fetch_accounts()
    print(f"  {len(unlinked)} unlinked payments")
    print(f"  {len(linked)} already-linked payments")
    print(f"  {len(contracts)} contracts")
    print(f"  {len(accounts)} accounts")
    print()

    if not unlinked:
        print("No unlinked payments found. Nothing to do.")
        return

    # Classify and link (capacity-aware: needs linked payments for running totals)
    print("Applying rules (capacity-aware)...")
    results = classify_and_link(unlinked, contracts, linked_payments=linked)

    # Count by rule
    rule_counts = defaultdict(int)
    for r in results:
        rule_counts[r["rule"]] += 1

    for rule in sorted(rule_counts.keys()):
        print(f"  {rule}: {rule_counts[rule]}")
    print()

    # Balance validation
    print("Computing balance data...")
    enriched, contract_summaries = compute_balance_data(
        results, linked, contracts, accounts
    )

    # Balance summary
    paid = sum(1 for s in contract_summaries if s["status"] == "paid")
    underpaid = sum(1 for s in contract_summaries if s["status"] == "underpaid")
    overpaid = sum(1 for s in contract_summaries if s["status"] == "overpaid")
    print(f"  Contracts: {paid} paid, {underpaid} underpaid, {overpaid} overpaid")
    if overpaid:
        print("  ** Overpaid contracts may indicate mis-linked payments:")
        for s in contract_summaries:
            if s["status"] == "overpaid":
                print(
                    f"     {s['contract_number']} ({s['account_number']}): "
                    f"fee=${s['fee']:.2f}, linked=${s['total_linked']:.2f}, "
                    f"balance=${s['balance']:.2f}"
                )
    print()

    # Write CSV reports
    report_path = OUTPUT_DIR / "associate_payments_report.csv"
    summary_path = OUTPUT_DIR / "associate_payments_contract_summary.csv"
    write_payment_report(enriched, accounts, report_path)
    write_contract_summary(contract_summaries, summary_path)
    print(f"Wrote {report_path}")
    print(f"Wrote {summary_path}")

    # Generate SQL
    sql, update_count = generate_sql(results)
    sql_path = OUTPUT_DIR / "associate_payments.sql"
    with open(sql_path, "w") as f:
        f.write(sql)
    print(f"Wrote {sql_path} ({update_count} UPDATEs)")
    print()

    linked_count = sum(1 for r in results if r["proposed_contract_id"])
    unresolved_count = sum(1 for r in results if not r["proposed_contract_id"])
    print(f"Summary: {linked_count} linked, {unresolved_count} unresolved out of {len(results)} payments")
    print()

    if args.apply:
        import subprocess
        print("Applying SQL via docker psql...")
        result = subprocess.run(
            ["docker", "exec", "-i", "supabase_db_atomic-crm-demo",
             "psql", "-U", "postgres", "-f", "-"],
            input=sql.encode(),
            capture_output=True,
        )
        print(result.stdout.decode())
        if result.returncode != 0:
            print("STDERR:", result.stderr.decode())
            sys.exit(1)
        print("Done.")
    else:
        print("Next steps:")
        print(f"  1. Review  {report_path}")
        print(f"  2. Review  {summary_path}")
        print(f"  3. Review  {sql_path}")
        print(f"  4. Apply:  python3 migration/associate_payments.py --apply")


if __name__ == "__main__":
    main()
