#!/usr/bin/env python3
"""
Undelete soft-deleted records in the CRM database.

Restoring an account will automatically restore all cascade-deleted children
(contacts, contracts, payments, tasks, activities) via database triggers.

Restoring a contract will automatically restore its cascade-deleted children
(payments, tasks, activities). Same for tasks (restores child activities).

Usage:
    # List all soft-deleted records
    python scripts/undelete.py --list

    # Restore a soft-deleted account (cascades to all children)
    python scripts/undelete.py accounts 7

    # Restore a single contract (cascades to its children)
    python scripts/undelete.py account_contracts 9

    # Restore a single contact, payment, task, or activity
    python scripts/undelete.py account_contacts 8
    python scripts/undelete.py account_payments 43
    python scripts/undelete.py tasks 12
    python scripts/undelete.py account_activities 55

    # Use --prod flag for production database
    python scripts/undelete.py --prod accounts 7

Environment:
    Connects to local Supabase by default (via docker exec).
    Use --prod to connect to production (requires PROD_DB_PASSWORD env var
    or will prompt interactively).
"""

import argparse
import getpass
import os
import subprocess
import sys

SOFT_DELETE_TABLES = [
    "accounts",
    "account_contacts",
    "account_contracts",
    "account_payments",
    "account_activities",
    "tasks",
]

# Columns to display per table in --list output
LIST_COLUMNS = {
    "accounts": "id, account_number, name, deleted_at",
    "account_contacts": "id, account_id, first_name, last_name, deleted_at",
    "account_contracts": "id, account_id, contract_number, deleted_at",
    "account_payments": "id, account_id, contract_id, amount, type, deleted_at",
    "account_activities": "id, account_id, type, deleted_at",
    "tasks": "id, account_id, text, deleted_at",
}


def run_sql_local(sql: str) -> str:
    """Run SQL against local Supabase via docker exec."""
    container = os.environ.get(
        "SUPABASE_DB_CONTAINER", "supabase_db_atomic-crm-demo"
    )
    result = subprocess.run(
        ["docker", "exec", container, "psql", "-U", "postgres", "-c", sql],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Error: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def run_sql_prod(sql: str, password: str) -> str:
    """Run SQL against production database via dockerized psql client."""
    host = os.environ.get("PROD_DB_HOST", "10.0.10.228")
    port = os.environ.get("PROD_DB_PORT", "5433")
    user = os.environ.get("PROD_DB_USER", "supabase_admin")
    result = subprocess.run(
        [
            "docker", "run", "--rm",
            "-e", f"PGPASSWORD={password}",
            "postgres:15",
            "psql", "-h", host, "-p", port, "-U", user, "-d", "postgres", "-c", sql,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Error: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def list_deleted(run_sql):
    """List all soft-deleted records grouped by table."""
    found_any = False
    for table in SOFT_DELETE_TABLES:
        cols = LIST_COLUMNS[table]
        output = run_sql(
            f"SELECT {cols} FROM {table} WHERE deleted_at IS NOT NULL "
            f"ORDER BY deleted_at DESC;"
        )
        # Check if any rows were returned (look for "(0 rows)")
        if "(0 rows)" not in output:
            if not found_any:
                print("=== Soft-deleted records ===\n")
                found_any = True
            print(f"--- {table} ---")
            print(output)

    if not found_any:
        print("No soft-deleted records found.")


def undelete(run_sql, table: str, record_id: int):
    """Restore a soft-deleted record by setting deleted_at = NULL."""
    if table not in SOFT_DELETE_TABLES:
        print(
            f"Error: '{table}' is not a soft-delete table. "
            f"Valid tables: {', '.join(SOFT_DELETE_TABLES)}",
            file=sys.stderr,
        )
        sys.exit(1)

    # Check the record exists and is soft-deleted
    cols = LIST_COLUMNS[table]
    output = run_sql(
        f"SELECT {cols} FROM {table} WHERE id = {record_id};"
    )
    if "(0 rows)" in output:
        print(f"Error: No record found in {table} with id={record_id}.", file=sys.stderr)
        sys.exit(1)
    if "deleted_at" in output and "|" in output:
        # Parse to check if deleted_at is NULL
        lines = [l.strip() for l in output.strip().split("\n") if "|" in l and "deleted_at" not in l]
        if lines:
            last_col = lines[0].rsplit("|", 1)[-1].strip()
            if last_col == "" or last_col == "NULL":
                print(f"Record {table}.id={record_id} is not deleted (deleted_at is NULL).")
                sys.exit(0)

    # Show what will be restored
    print(f"Record to restore:\n{output}")

    # For accounts and contracts, show cascade children
    if table == "accounts":
        deleted_at_sql = (
            f"SELECT deleted_at FROM accounts WHERE id = {record_id}"
        )
        for child_table in ["account_contacts", "account_contracts", "account_payments", "tasks", "account_activities"]:
            child_cols = LIST_COLUMNS[child_table]
            child_output = run_sql(
                f"SELECT {child_cols} FROM {child_table} "
                f"WHERE account_id = {record_id} AND deleted_at = ({deleted_at_sql});"
            )
            if "(0 rows)" not in child_output:
                print(f"Will also restore (cascade) in {child_table}:")
                print(child_output)

    elif table == "account_contracts":
        deleted_at_sql = (
            f"SELECT deleted_at FROM account_contracts WHERE id = {record_id}"
        )
        for child_table, filter_col in [
            ("account_payments", "contract_id"),
            ("tasks", "parent_id"),
            ("account_activities", "parent_id"),
        ]:
            extra = ""
            if child_table in ("tasks", "account_activities"):
                extra = " AND parent_type IN ('account_contract', 'account_contracts')"
            child_cols = LIST_COLUMNS[child_table]
            child_output = run_sql(
                f"SELECT {child_cols} FROM {child_table} "
                f"WHERE {filter_col} = {record_id}{extra} "
                f"AND deleted_at = ({deleted_at_sql});"
            )
            if "(0 rows)" not in child_output:
                print(f"Will also restore (cascade) in {child_table}:")
                print(child_output)

    elif table == "tasks":
        deleted_at_sql = (
            f"SELECT deleted_at FROM tasks WHERE id = {record_id}"
        )
        child_output = run_sql(
            f"SELECT {LIST_COLUMNS['account_activities']} FROM account_activities "
            f"WHERE parent_type = 'tasks' AND parent_id = {record_id} "
            f"AND deleted_at = ({deleted_at_sql});"
        )
        if "(0 rows)" not in child_output:
            print(f"Will also restore (cascade) in account_activities:")
            print(child_output)

    # Confirm
    answer = input("Proceed with restore? [y/N] ").strip().lower()
    if answer != "y":
        print("Aborted.")
        sys.exit(0)

    # Restore — the cascade trigger handles children automatically
    output = run_sql(
        f"UPDATE {table} SET deleted_at = NULL WHERE id = {record_id} RETURNING id;"
    )
    print(f"Restored {table}.id={record_id}")
    if "UPDATE 0" in output:
        print("Warning: no rows were updated.", file=sys.stderr)
    else:
        print(output)


def main():
    parser = argparse.ArgumentParser(
        description="Undelete soft-deleted CRM records.",
        epilog="Examples:\n"
        "  python scripts/undelete.py --list\n"
        "  python scripts/undelete.py accounts 7\n"
        "  python scripts/undelete.py --prod account_contracts 9\n",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--list", action="store_true", help="List all soft-deleted records")
    parser.add_argument("--prod", action="store_true", help="Connect to production database")
    parser.add_argument("table", nargs="?", help="Table name (e.g. accounts, account_contracts)")
    parser.add_argument("id", nargs="?", type=int, help="Record ID to restore")

    args = parser.parse_args()

    # Build the SQL runner
    if args.prod:
        password = os.environ.get("PROD_DB_PASSWORD")
        if not password:
            password = getpass.getpass("Production database password: ")
        run_sql = lambda sql: run_sql_prod(sql, password)
    else:
        run_sql = run_sql_local

    if args.list:
        list_deleted(run_sql)
    elif args.table and args.id is not None:
        undelete(run_sql, args.table, args.id)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
