#!/usr/bin/env python3
"""
link_payment_schedule.py — Allocate account_payments to contract_payment_schedule rows.

For each contract, walks payments chronologically and allocates each to the
earliest unmatched schedule row(s) via the payment_allocations junction table.
A single payment can satisfy multiple schedule rows (lump sums), and a single
schedule row can receive allocations from multiple payments (split payments).

Usage:
  python3 migration/link_payment_schedule.py                    # dry run, incremental
  python3 migration/link_payment_schedule.py --apply            # incremental + apply
  python3 migration/link_payment_schedule.py --full-rebuild     # delete all + rebuild
  python3 migration/link_payment_schedule.py --full-rebuild --apply  # full rebuild + apply

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
        "select": "id,contract_id,account_id,payment_number,due_date,amount",
        "order": "contract_id,payment_number",
    })


def fetch_payments() -> list:
    return _supabase_get_all("account_payments", {
        "select": "id,account_id,contract_id,date_received,amount,type",
        "contract_id": "not.is.null",
        "type": "eq.payment",
        "order": "date_received",
    })


def fetch_existing_allocations() -> list:
    return _supabase_get_all("payment_allocations", {
        "select": "id,payment_id,schedule_id,amount_applied",
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


def find_affected_contracts(
    payments: list, existing_allocs: list, schedule: list
) -> dict:
    """Identify contracts where unallocated payments require reflow.

    A contract needs reflow only when an unallocated payment is chronologically
    EARLIER than an already-allocated payment on the same contract. If the
    unallocated payment comes after all existing allocations, it can simply be
    appended without disturbing existing allocations.

    Returns dict: contract_id -> cutoff_date (earliest unallocated payment date
    that precedes an existing allocation). Only contracts needing reflow are
    included.
    """
    existing_by_payment = defaultdict(float)
    for e in existing_allocs:
        existing_by_payment[e["payment_id"]] += float(e["amount_applied"] or 0)

    # Find the latest allocated payment date per contract
    payment_lookup = {p["id"]: p for p in payments}
    latest_allocated_date = {}  # contract_id -> latest date_received among allocated payments
    for p in payments:
        p_amount = float(p["amount"] or 0)
        if p_amount < 0:
            continue
        already_used = existing_by_payment.get(p["id"], 0.0)
        if already_used < 0.01:
            continue
        # This payment has allocations
        contract_id = p["contract_id"]
        p_date = parse_date_str(p["date_received"])
        if p_date is None:
            continue
        if contract_id not in latest_allocated_date or p_date > latest_allocated_date[contract_id]:
            latest_allocated_date[contract_id] = p_date

    # Find unallocated payments that precede existing allocations
    affected = {}  # contract_id -> earliest unallocated payment date needing reflow
    for p in payments:
        p_amount = float(p["amount"] or 0)
        if p_amount < 0:
            continue
        already_used = existing_by_payment.get(p["id"], 0.0)
        if p_amount - already_used < 0.01:
            continue
        # This payment is unallocated
        contract_id = p["contract_id"]
        p_date = parse_date_str(p["date_received"])
        if p_date is None:
            continue
        # Only reflow if this unallocated payment is earlier than
        # the latest allocated payment on the same contract
        latest = latest_allocated_date.get(contract_id)
        if latest is None or p_date >= latest:
            continue
        if contract_id not in affected or p_date < affected[contract_id]:
            affected[contract_id] = p_date

    return affected


def filter_existing_for_reflow(
    existing_allocs: list, schedule: list, affected_contracts: dict,
    payments: list,
) -> tuple:
    """Remove existing allocations that fall in the reflow window.

    For affected contracts, finds the earliest schedule row (by payment_number)
    where an allocation's payment is dated >= the cutoff. Then clears all
    allocations from that schedule row onward for the contract. This ensures
    the chronological re-allocation starts at the right point regardless of
    whether schedule due_dates align exactly with payment dates.

    Returns (filtered_existing, delete_targets) where delete_targets is a dict
    of contract_id -> (cutoff_date, set_of_schedule_ids_to_clear).
    """
    payment_lookup = {p["id"]: p for p in payments}

    # Group allocations by schedule_id
    allocs_by_schedule = defaultdict(list)
    for e in existing_allocs:
        allocs_by_schedule[e["schedule_id"]].append(e)

    # Group schedule by contract
    sched_by_contract = defaultdict(list)
    for s in schedule:
        sched_by_contract[s["contract_id"]].append(s)

    delete_targets = {}
    all_sched_ids_to_remove = set()

    for contract_id, cutoff_date in affected_contracts.items():
        contract_scheds = sorted(
            sched_by_contract.get(contract_id, []),
            key=lambda s: s["payment_number"],
        )

        # Find the earliest payment_number where an allocation's payment
        # date >= cutoff (i.e., a later payment occupying an earlier slot)
        reflow_from_pnum = None
        for s in contract_scheds:
            for alloc in allocs_by_schedule.get(s["id"], []):
                p = payment_lookup.get(alloc["payment_id"])
                if p:
                    p_date = parse_date_str(p["date_received"])
                    if p_date and p_date >= cutoff_date:
                        if reflow_from_pnum is None or s["payment_number"] < reflow_from_pnum:
                            reflow_from_pnum = s["payment_number"]

        if reflow_from_pnum is None:
            continue

        # Clear all schedule rows from reflow_from_pnum onward
        sched_ids = set()
        for s in contract_scheds:
            if s["payment_number"] >= reflow_from_pnum:
                sched_ids.add(s["id"])

        if sched_ids:
            delete_targets[contract_id] = (cutoff_date, sched_ids)
            all_sched_ids_to_remove.update(sched_ids)

    filtered = [
        e for e in existing_allocs
        if e["schedule_id"] not in all_sched_ids_to_remove
    ]

    return filtered, delete_targets


def allocate_payments(schedule: list, payments: list, existing: list) -> tuple:
    """Match payments to schedule rows per contract using amount-based allocation.

    Strategy: for each contract, process payments chronologically.
    Each payment consumes schedule rows in order, tracking exact dollar amounts.
    This handles:
    - Exact 1:1 matches (payment amount = schedule amount)
    - Lump sums (one payment covers multiple schedule rows)
    - Partial payments (payment < schedule amount — partially covers)
    - Split payments (multiple payments on same schedule row)
    - Overpayments beyond schedule (extra payments with no schedule row)

    Returns (allocations, stats) where allocations is a list of
    (schedule_id, payment_id, amount_applied) triples.
    """

    # Build set of already-allocated (payment_id, schedule_id) pairs
    existing_pairs = set()
    existing_by_schedule = defaultdict(float)  # schedule_id -> total already applied
    existing_by_payment = defaultdict(float)   # payment_id -> total already applied
    for e in existing:
        existing_pairs.add((e["payment_id"], e["schedule_id"]))
        existing_by_schedule[e["schedule_id"]] += float(e["amount_applied"] or 0)
        existing_by_payment[e["payment_id"]] += float(e["amount_applied"] or 0)

    # Group by contract
    sched_by_contract = defaultdict(list)
    for s in schedule:
        sched_by_contract[s["contract_id"]].append(s)

    payments_by_contract = defaultdict(list)
    for p in payments:
        payments_by_contract[p["contract_id"]].append(p)

    allocations = []
    stats = {"allocated": 0, "no_schedule_row": 0, "negative_skipped": 0, "already_allocated": 0}

    for contract_id, contract_sched in sched_by_contract.items():
        # Sort schedule by payment_number
        contract_sched.sort(key=lambda s: s["payment_number"])
        contract_payments = payments_by_contract.get(contract_id, [])
        contract_payments.sort(
            key=lambda p: parse_date_str(p["date_received"]) or date.min
        )

        sched_idx = 0  # pointer into schedule rows
        sched_remaining = 0.0  # remaining amount on current schedule row

        # Initialize sched_remaining accounting for existing allocations
        if contract_sched:
            s = contract_sched[0]
            s_amount = float(s["amount"] or 0)
            already = existing_by_schedule.get(s["id"], 0.0)
            sched_remaining = max(0.0, s_amount - already)

        for p in contract_payments:
            p_amount = float(p["amount"] or 0)

            # Skip negative amounts (refunds/corrections)
            if p_amount < 0:
                stats["negative_skipped"] += 1
                continue

            # Subtract what's already allocated from this payment
            already_used = existing_by_payment.get(p["id"], 0.0)
            remaining = max(0.0, p_amount - already_used)

            if remaining < 0.01:
                stats["already_allocated"] += 1
                continue

            while remaining > 0.01 and sched_idx < len(contract_sched):
                s = contract_sched[sched_idx]
                s_amount = float(s["amount"] or 0)

                if sched_remaining <= 0.01:
                    already = existing_by_schedule.get(s["id"], 0.0)
                    sched_remaining = max(0.0, s_amount - already)

                if sched_remaining <= 0.01:
                    sched_idx += 1
                    continue

                # Check if this pair already exists
                if (p["id"], s["id"]) in existing_pairs:
                    # Already allocated — advance
                    if remaining >= sched_remaining - 0.01:
                        remaining -= sched_remaining
                        sched_remaining = 0.0
                        sched_idx += 1
                    else:
                        sched_remaining -= remaining
                        remaining = 0.0
                    continue

                # Calculate allocation amount
                apply_amount = min(remaining, sched_remaining)
                apply_amount = round(apply_amount, 2)

                allocations.append((s["id"], p["id"], apply_amount))
                stats["allocated"] += 1

                if remaining >= sched_remaining - 0.01:
                    # Payment covers this schedule row
                    remaining -= sched_remaining
                    sched_remaining = 0.0
                    sched_idx += 1
                else:
                    # Payment only partially covers this schedule row
                    sched_remaining -= remaining
                    remaining = 0.0

            if remaining > 0.01:
                stats["no_schedule_row"] += 1

    return allocations, stats


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def generate_sql(
    allocations: list,
    full_rebuild: bool = False,
    delete_targets: dict = None,
) -> str:
    lines = [
        "-- link_payment_schedule.py — allocate payments to schedule rows",
        "",
        "BEGIN;",
        "",
    ]

    if full_rebuild:
        lines.append("-- Full rebuild: clear all allocations before re-inserting")
        lines.append("DELETE FROM payment_allocations;")
        lines.append("")
    elif delete_targets:
        lines.append("-- Reflow affected contracts from cutoff date onward")
        for contract_id, (cutoff, sched_ids) in sorted(delete_targets.items()):
            sched_id_list = ",".join(str(sid) for sid in sorted(sched_ids))
            lines.append(
                f"-- Contract {contract_id}: reflow from {cutoff}"
            )
            lines.append(
                f"DELETE FROM payment_allocations WHERE schedule_id IN ({sched_id_list});"
            )
        lines.append("")

    for sched_id, payment_id, amount in allocations:
        lines.append(
            f"INSERT INTO payment_allocations (payment_id, schedule_id, amount_applied) "
            f"VALUES ({payment_id}, {sched_id}, {amount}) "
            f"ON CONFLICT (payment_id, schedule_id) DO UPDATE SET amount_applied = EXCLUDED.amount_applied;"
        )

    lines.extend([
        "",
        "-- Verify",
        "SELECT",
        "  count(*) AS total_allocations,",
        "  sum(amount_applied) AS total_applied",
        "FROM payment_allocations;",
        "",
        "SELECT status, count(*) FROM contract_payment_schedule_view GROUP BY status ORDER BY 1;",
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
        description="Allocate payments to contract payment schedule rows"
    )
    parser.add_argument("--apply", action="store_true",
                        help="Apply SQL directly via docker psql")
    parser.add_argument("--full-rebuild", action="store_true",
                        help="Delete all existing allocations and rebuild from scratch. "
                             "Default is incremental (only add new allocations).")
    args = parser.parse_args()

    full_rebuild = args.full_rebuild
    mode_label = "full rebuild" if full_rebuild else "incremental"

    print("=" * 60)
    print("Allocate Payments to Schedule")
    print(f"Mode: {mode_label}")
    print("=" * 60)
    print()

    print("Fetching data...")
    schedule = fetch_schedule()
    payments = fetch_payments()
    print(f"  {len(schedule)} schedule rows")
    print(f"  {len(payments)} payments with contract_id")

    delete_targets = None

    if full_rebuild:
        existing = []
    else:
        existing_allocs = fetch_existing_allocations()
        print(f"  {len(existing_allocs)} existing allocations")

        # Find contracts with unallocated payments that need reflow
        affected = find_affected_contracts(payments, existing_allocs, schedule)
        if affected:
            existing, delete_targets = filter_existing_for_reflow(
                existing_allocs, schedule, affected, payments
            )
            n_deleted = sum(len(sids) for _, sids in delete_targets.values())
            print(f"  {len(affected)} contracts need reflow ({n_deleted} schedule rows):")
            for cid, cutoff in sorted(affected.items()):
                print(f"    contract {cid}: from {cutoff}")
        else:
            existing = existing_allocs

    print()

    print(f"Allocating payments to schedule rows ({mode_label})...")
    allocations, stats = allocate_payments(schedule, payments, existing=existing)
    print(f"  {stats['allocated']} new allocations")
    print(f"  {stats['already_allocated']} payments already fully allocated")
    print(f"  {stats['negative_skipped']} negative payments skipped")
    print(f"  {stats['no_schedule_row']} payments with no remaining schedule row")
    print()

    if not allocations:
        print("Nothing to do — all payments are already allocated.")
        return

    sql = generate_sql(
        allocations, full_rebuild=full_rebuild, delete_targets=delete_targets
    )
    sql_path = OUTPUT_DIR / "link_payment_schedule.sql"
    with open(sql_path, "w") as f:
        f.write(sql)
    print(f"Wrote {sql_path} ({len(allocations)} INSERTs)")
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
