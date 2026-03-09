#!/usr/bin/env python3
"""
fix_task_owners.py — One-time UPDATE to set correct user_id on tasks and
post-item activities based on Exchange task Owner and "modified by" names.

Fetches task items from Exchange for all accounts in the local DB, then
generates UPDATE SQL to fix user_id assignments.

Usage:
  python3 migration/fix_task_owners.py                # fetch from Exchange + generate SQL
  python3 migration/fix_task_owners.py --use-cache    # reuse cached Exchange data
  python3 migration/fix_task_owners.py --apply        # generate + apply directly via psql

Output:
  migration/output/fix_task_owners.sql
"""

import json
import sys
from pathlib import Path

# Reuse shared infrastructure from fetch_sample.py
sys.path.insert(0, str(Path(__file__).parent))
from fetch_sample import (
    OUTPUT_DIR,
    _supabase_get,
    fetch_exchange_items,
    fetch_users_map,
    resolve_user_id,
    sql_str,
)


def fetch_all_account_numbers() -> list:
    """Get all account numbers from the local Supabase DB."""
    rows = _supabase_get("accounts", {
        "select": "account_number",
        "order": "account_number",
        "limit": "10000",
        "deleted_at": "is.null",
    })
    return [r["account_number"] for r in rows if r.get("account_number")]


def generate_updates(exchange_by_acct: dict, users_map: dict, fallback_uid: str) -> list:
    """Generate UPDATE SQL for tasks and post-item activities."""
    lines = []
    task_updates = 0
    activity_updates = 0

    for acct_num, items in exchange_by_acct.items():
        # --- Tasks ---
        task_items = [
            it for it in items
            if "IPM.Task.Account task" in (it.get("message_class") or "")
        ]
        for item in task_items:
            text = (item.get("subject") or "").strip()
            owner_name = (item.get("task_owner") or "").strip()
            if not text or not owner_name:
                continue
            uid = resolve_user_id(owner_name, users_map, fallback_uid)
            if uid == fallback_uid:
                continue  # no change needed, already the default

            lines.append(
                f"UPDATE tasks SET user_id = {uid} "
                f"WHERE text = {sql_str(text)} "
                f"AND account_id = (SELECT id FROM accounts WHERE account_number = {sql_str(acct_num)}) "
                f"AND user_id != {uid};"
            )
            task_updates += 1

        # --- Post items (activities linked to tasks) ---
        post_items = [
            it for it in items
            if (it.get("message_class") or "") == "IPM.Post"
        ]
        for item in post_items:
            subject = (item.get("subject") or "").strip()
            if not subject or " modified by " not in subject:
                continue
            modifier_name = subject.split(" modified by ")[-1].strip()
            uid = resolve_user_id(modifier_name, users_map, fallback_uid)
            if uid == fallback_uid:
                continue

            lines.append(
                f"UPDATE account_activities SET user_id = {uid} "
                f"WHERE subject = {sql_str(subject)} "
                f"AND account_id = (SELECT id FROM accounts WHERE account_number = {sql_str(acct_num)}) "
                f"AND user_id != {uid};"
            )
            activity_updates += 1

    return lines, task_updates, activity_updates


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fix task/activity user_id from Exchange Owner field")
    parser.add_argument("--use-cache", action="store_true",
                        help="Load Exchange data from cached JSON instead of re-fetching")
    parser.add_argument("--apply", action="store_true",
                        help="Apply the generated SQL directly via docker psql")
    args = parser.parse_args()

    cache_path = OUTPUT_DIR / "cache_fix_exchange.json"

    print("=" * 60)
    print("Fix Task Owners — Exchange Owner → CRM user_id")
    print("=" * 60)
    print()

    # Get all account numbers from local DB
    print("Fetching account numbers from Supabase...")
    account_numbers = fetch_all_account_numbers()
    print(f"  {len(account_numbers)} accounts")
    print()

    # Fetch or load Exchange data
    if args.use_cache:
        if not cache_path.exists():
            print(f"ERROR: Cache file not found: {cache_path}")
            print("Run once without --use-cache first.")
            sys.exit(1)
        print("Loading Exchange data from cache...")
        with open(cache_path) as f:
            exchange_by_acct = json.load(f)
        total_items = sum(len(v) for v in exchange_by_acct.values())
        print(f"  {total_items} Exchange items loaded from cache")
    else:
        print("Fetching Exchange items (WebDAV SEARCH)...")
        exchange_by_acct = fetch_exchange_items(account_numbers)
        total_items = sum(len(v) for v in exchange_by_acct.values())
        print(f"  {total_items} Exchange items fetched")

        # Cache for reuse
        cache_data = {
            acct: [
                {k: v for k, v in it.items() if k != "_raw"}
                for it in items
            ]
            for acct, items in exchange_by_acct.items()
        }
        with open(cache_path, "w") as f:
            json.dump(cache_data, f, indent=2, default=str)
        print(f"  Cached to {cache_path}")
    print()

    # Build user name map
    print("Building user name → id map...")
    users_map = fetch_users_map()
    # Find admin user as fallback
    admin_rows = _supabase_get("users", {"administrator": "eq.true", "limit": "1"})
    fallback_uid = str(admin_rows[0]["id"]) if admin_rows else "NULL"
    print(f"  Fallback (admin) user_id: {fallback_uid}")
    print()

    # Generate UPDATE SQL
    print("Generating UPDATE statements...")
    update_lines, n_tasks, n_activities = generate_updates(
        exchange_by_acct, users_map, fallback_uid
    )

    if not update_lines:
        print("  No updates needed — all owners already match the fallback user.")
        return

    sql_lines = [
        "-- Fix task/activity user_id from Exchange Owner field",
        "-- One-time migration fix",
        "",
        "BEGIN;",
        "",
    ]
    sql_lines.extend(update_lines)
    sql_lines.extend([
        "",
        "-- Verify",
        "SELECT 'tasks' AS tbl, user_id, count(*) FROM tasks GROUP BY user_id ORDER BY user_id;",
        "SELECT 'activities' AS tbl, user_id, count(*) FROM account_activities GROUP BY user_id ORDER BY user_id;",
        "",
        "COMMIT;",
        "",
    ])

    sql = "\n".join(sql_lines)
    sql_path = OUTPUT_DIR / "fix_task_owners.sql"
    with open(sql_path, "w") as f:
        f.write(sql)

    print(f"  {n_tasks} task UPDATE statements")
    print(f"  {n_activities} activity UPDATE statements")
    print(f"  Wrote {sql_path}")
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
        print(f"  2. Apply:  docker exec -i supabase_db_atomic-crm-demo psql -U postgres < {sql_path}")
        print(f"  3. Or rerun with --apply to apply directly")


if __name__ == "__main__":
    main()
