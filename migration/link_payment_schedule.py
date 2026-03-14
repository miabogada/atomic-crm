#!/usr/bin/env python3
"""
link_payment_schedule.py — Link account_payments to contract_payment_schedule rows.

For each contract, walks payments chronologically and matches each to the
earliest unmatched schedule row(s). A single payment can satisfy multiple
schedule rows (lump sums), and schedule rows for future installments remain
unlinked.

Usage:
  python3 migration/link_payment_schedule.py           # dry run: generate SQL
  python3 migration/link_payment_schedule.py --apply   # generate + apply

Output:
  migration/output/link_payment_schedule.sql
"""

import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))
from fetch_sample import OUTPUT_DIR, _supabase_get


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def _supabase_get_all(path: str, params: dict, page_size: int = 999) -> list:
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


def fetch_schedule() -> list:
    return _supabase_get_all("contract_payment_schedule", {
        "select": "id,contract_id,account_id,payment_number,due_date,amount,payment_id",
        "order": "contract_id,payment_number",
    })


def fetch_payments() -> list:
    return _supabase_get_all("account_payments", {
        "select": "id,account_id,contract_id,date_received,amount,type",
        "contract_id": "not.is.null",
        "type": "eq.payment",
        "order": "date_received",
    })


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------

def parse_date_str(d) -> Optional[date]:
    if not d:
        return None
    s = str(d)[:10]
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def link_schedule(schedule: list, payments: list) -> list:
    """Match payments to schedule rows per contract.

    Strategy: for each contract, process payments chronologically.
    Each payment consumes schedule rows in order until the payment
    amount is fully allocated. This handles:
    - Exact 1:1 matches (payment amount = schedule amount)
    - Lump sums (one payment covers multiple schedule rows)
    - Partial payments (payment < schedule amount — still links, partially covers)
    - Overpayments beyond schedule (extra payments with no schedule row)

    Returns list of (schedule_id, payment_id) pairs.
    """

    # Group by contract
    sched_by_contract = defaultdict(list)
    for s in schedule:
        sched_by_contract[s["contract_id"]].append(s)

    payments_by_contract = defaultdict(list)
    for p in payments:
        payments_by_contract[p["contract_id"]].append(p)

    links = []
    stats = {"linked": 0, "no_schedule_row": 0, "negative_skipped": 0}

    for contract_id, contract_sched in sched_by_contract.items():
        # Sort schedule by payment_number
        contract_sched.sort(key=lambda s: s["payment_number"])
        contract_payments = payments_by_contract.get(contract_id, [])
        contract_payments.sort(
            key=lambda p: parse_date_str(p["date_received"]) or date.min
        )

        sched_idx = 0  # pointer into schedule rows
        sched_remaining = 0.0  # remaining amount on current schedule row

        for p in contract_payments:
            p_amount = float(p["amount"] or 0)

            # Skip negative amounts (refunds/corrections)
            if p_amount < 0:
                stats["negative_skipped"] += 1
                continue

            remaining = p_amount

            while remaining > 0.01 and sched_idx < len(contract_sched):
                s = contract_sched[sched_idx]
                s_amount = float(s["amount"] or 0)

                if sched_remaining <= 0.01:
                    sched_remaining = s_amount

                # Link this payment to this schedule row
                links.append((s["id"], p["id"]))
                stats["linked"] += 1

                if remaining >= sched_remaining - 0.01:
                    # Payment covers this schedule row (fully or exactly)
                    remaining -= sched_remaining
                    sched_remaining = 0.0
                    sched_idx += 1
                else:
                    # Payment only partially covers this schedule row
                    sched_remaining -= remaining
                    remaining = 0.0

            if remaining > 0.01:
                stats["no_schedule_row"] += 1

    return links, stats


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def generate_sql(links: list) -> str:
    lines = [
        "-- link_payment_schedule.py — link payments to schedule rows",
        "",
        "BEGIN;",
        "",
    ]

    for sched_id, payment_id in links:
        lines.append(
            f"UPDATE contract_payment_schedule "
            f"SET payment_id = {payment_id} "
            f"WHERE id = {sched_id} AND payment_id IS NULL;"
        )

    lines.extend([
        "",
        "-- Verify",
        "SELECT",
        "  count(*) FILTER (WHERE payment_id IS NOT NULL) AS linked,",
        "  count(*) FILTER (WHERE payment_id IS NULL) AS unlinked",
        "FROM contract_payment_schedule;",
        "",
        "COMMIT;",
        "",
    ])

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Link payments to contract payment schedule rows"
    )
    parser.add_argument("--apply", action="store_true",
                        help="Apply SQL directly via docker psql")
    args = parser.parse_args()

    print("=" * 60)
    print("Link Payment Schedule")
    print("=" * 60)
    print()

    print("Fetching data...")
    schedule = fetch_schedule()
    payments = fetch_payments()
    print(f"  {len(schedule)} schedule rows")
    print(f"  {len(payments)} payments with contract_id")
    print()

    print("Matching payments to schedule rows...")
    links, stats = link_schedule(schedule, payments)
    print(f"  {stats['linked']} schedule rows linked")
    print(f"  {stats['negative_skipped']} negative payments skipped")
    print(f"  {stats['no_schedule_row']} payments with no remaining schedule row")
    print(f"  {len(schedule) - stats['linked']} schedule rows remain unlinked (future)")
    print()

    sql = generate_sql(links)
    sql_path = OUTPUT_DIR / "link_payment_schedule.sql"
    with open(sql_path, "w") as f:
        f.write(sql)
    print(f"Wrote {sql_path} ({len(links)} UPDATEs)")
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
        print(f"  1. Review  {sql_path}")
        print(f"  2. Apply:  python3 migration/link_payment_schedule.py --apply")


if __name__ == "__main__":
    main()
