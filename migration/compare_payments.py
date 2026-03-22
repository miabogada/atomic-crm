#!/usr/bin/env python3
"""
compare_payments.py — Compare payments across Access DB, Exchange, and CRM
for a set of specific accounts.

Usage:
    python3 migration/compare_payments.py
"""

import csv
import io
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _load_env(env_path: str) -> dict:
    result = {}
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                result[key.strip()] = val.strip()
    except FileNotFoundError:
        pass
    return result

_env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
_env = _load_env(_env_file)

MDB_PATH         = _env.get("MDB_PATH") or os.environ.get("MDB_PATH", "")
EXCHANGE_URL     = _env.get("EXCHANGE_URL") or os.environ.get("EXCHANGE_URL", "")
EXCHANGE_USER    = _env.get("EXCHANGE_USER") or os.environ.get("EXCHANGE_USER", "")
EXCHANGE_PASS    = _env.get("EXCHANGE_PASS") or os.environ.get("EXCHANGE_PASS", "")

import requests

EXCHANGE_FOLDER       = EXCHANGE_URL.rstrip("/") + "/public/Account%20Tracking/"
EXCHANGE_FOLDER_SCOPE = EXCHANGE_URL.rstrip("/") + "/public/Account Tracking/"
EXCHANGE_AUTH         = (EXCHANGE_USER, EXCHANGE_PASS)

# MAPI property URIs
_NS_MAPI     = "http://schemas.microsoft.com/mapi/proptag/"
_NS_HTTPMAIL = "urn:schemas:httpmail:"
_NS_CONTRACT = "http://schemas.microsoft.com/mapi/string/{00020329-0000-0000-C000-000000000046}/"

PROP_MESSAGE_CLASS = f"{_NS_MAPI}x001a001e"
PROP_CONV_TOPIC    = f"{_NS_MAPI}x0070001e"
PROP_SUBJECT       = f"{_NS_HTTPMAIL}subject"
PROP_DATE          = f"{_NS_HTTPMAIL}date"

# Properties we can safely SELECT (no {GUID} in namespace)
SAFE_PROPS = [PROP_MESSAGE_CLASS, PROP_CONV_TOPIC, PROP_SUBJECT, PROP_DATE]

# Accounts to compare
ACCOUNTS = ['24091001', '25090501', '25091101', '07022201', '15030101', '14041501', '24031501']

# ---------------------------------------------------------------------------
# Access DB
# ---------------------------------------------------------------------------

def export_mdb_table(table_name: str) -> list:
    result = subprocess.run(
        ["mdb-export", MDB_PATH, table_name],
        capture_output=True, check=True,
    )
    result.stdout = result.stdout.decode("cp1252", errors="replace").replace("\x00", "")
    reader = csv.DictReader(io.StringIO(result.stdout))
    return list(reader)


def get_access_payments(account_numbers: list) -> dict:
    """Get payments from Access DB grouped by account number."""
    payments = export_mdb_table("tblPaymentsReceived")
    result = {acct: [] for acct in account_numbers}
    for p in payments:
        acct = (p.get("Account") or "").strip()
        if acct in account_numbers:
            date_str = (p.get("DateRecd") or "").strip()
            amount_str = (p.get("AmtRecd") or "").strip()
            method = (p.get("PaymentMethod") or "").strip()
            check_num = (p.get("CheckNumber") or "").strip()
            contract = (p.get("Contract") or "").strip()
            result[acct].append({
                "date": parse_date(date_str),
                "amount": parse_amount(amount_str),
                "method": method,
                "reference": check_num,
                "contract": contract,
                "raw_date": date_str,
            })
    # Sort each account's payments by date
    for acct in result:
        result[acct].sort(key=lambda p: p["date"] or date(1900, 1, 1))
    return result


# ---------------------------------------------------------------------------
# Exchange WebDAV
# ---------------------------------------------------------------------------

def fetch_exchange_payments(account_numbers: list) -> dict:
    """Fetch all Exchange items for each account, filter to payment items."""
    result = {acct: [] for acct in account_numbers}

    select_cols = ",\n      ".join(f'"{p}"' for p in SAFE_PROPS)

    for acct in account_numbers:
        print(f"  Exchange: fetching {acct}...")
        search_body = f"""<?xml version="1.0"?>
<searchrequest xmlns="DAV:">
  <sql>
    SELECT
      "DAV:href",
      {select_cols}
    FROM SCOPE('shallow traversal of "{EXCHANGE_FOLDER_SCOPE}"')
    WHERE "{PROP_CONV_TOPIC}" = '{acct}'
  </sql>
</searchrequest>"""

        try:
            resp = requests.request(
                method="SEARCH",
                url=EXCHANGE_FOLDER,
                data=search_body.encode("utf-8"),
                auth=EXCHANGE_AUTH,
                headers={"Content-Type": "text/xml", "Depth": "0"},
                timeout=30,
            )
            if resp.status_code not in (200, 207):
                print(f"    HTTP {resp.status_code}")
                continue

            items = parse_search_response(resp.text)
            # Filter to payment items and count all by class
            by_class = {}
            for it in items:
                mc = it.get("message_class", "")
                by_class.setdefault(mc, 0)
                by_class[mc] += 1

            payment_items = [
                it for it in items
                if "payment" in (it.get("message_class") or "").lower()
            ]

            detail = ", ".join(f"{mc.split('.')[-1]}={n}" for mc, n in sorted(by_class.items()))
            print(f"    {len(items)} items ({detail}), {len(payment_items)} payments")

            # For each payment item, fetch UserProperties via PROPFIND
            for pit in payment_items:
                href = pit.get("href", "")
                if href:
                    props = fetch_payment_user_props(href)
                    pit.update(props)

            result[acct] = payment_items

        except requests.RequestException as e:
            print(f"    Error: {e}")

    return result


def fetch_payment_user_props(href: str) -> dict:
    """PROPFIND a payment item to extract UserProperties (curPayment, txtDatePayment, etc.)."""
    propfind_body = '<?xml version="1.0"?><propfind xmlns="DAV:"><allprop/></propfind>'
    try:
        resp = requests.request(
            method="PROPFIND",
            url=href,
            data=propfind_body.encode("utf-8"),
            auth=EXCHANGE_AUTH,
            headers={"Content-Type": "text/xml", "Depth": "0"},
            timeout=30,
        )
        if resp.status_code not in (200, 207):
            return {}
        text = resp.text
        # Extract UserProperties using regex (namespace has {GUID} which breaks expat)
        props = {}
        for prop_name in ["curPayment", "txtDatePayment", "txtPmtMethod", "txtCheckNumber"]:
            m = re.search(rf'<[^>]*{prop_name}[^>]*>([^<]+)</', text)
            if m:
                props[prop_name] = m.group(1).strip()
        return props
    except requests.RequestException:
        return {}


def parse_search_response(xml_text: str) -> list:
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"    XML parse error: {e}")
        return items

    for response_el in root.iter("{DAV:}response"):
        href_el = response_el.find("{DAV:}href")
        href = (href_el.text or "").strip() if href_el is not None else ""

        prop_values = {}
        for prop_el in response_el.iter("{DAV:}prop"):
            for child in prop_el:
                tag = child.tag
                if tag.startswith("{"):
                    close = tag.index("}")
                    uri = tag[1:close] + tag[close + 1:]
                else:
                    uri = tag
                text = (child.text or "").strip()
                if text:
                    prop_values[uri] = text

        item = {
            "href": href,
            "message_class": prop_values.get(PROP_MESSAGE_CLASS, ""),
            "subject": prop_values.get(PROP_SUBJECT, ""),
            "date": prop_values.get(PROP_DATE, ""),
        }
        items.append(item)
    return items


# ---------------------------------------------------------------------------
# CRM (local Supabase)
# ---------------------------------------------------------------------------

def get_crm_payments(account_numbers: list) -> dict:
    """Get payments from local CRM database."""
    acct_list = ",".join(f"'{a}'" for a in account_numbers)
    query = f"""
    SELECT a.account_number, ap.date_received, ap.amount, ap.payment_method,
           ap.reference_number, ap.type, ac.contract_number
    FROM account_payments ap
    JOIN accounts a ON a.id = ap.account_id
    LEFT JOIN account_contracts ac ON ac.id = ap.contract_id
    WHERE a.account_number IN ({acct_list})
      AND ap.deleted_at IS NULL
    ORDER BY a.account_number, ap.date_received;
    """
    result_text = subprocess.run(
        ["docker", "exec", "supabase_db_atomic-crm-demo",
         "psql", "-U", "postgres", "-t", "-A", "-F", "|", "-c", query],
        capture_output=True, text=True, check=True,
    ).stdout.strip()

    result = {acct: [] for acct in account_numbers}
    for line in result_text.split("\n"):
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) < 6:
            continue
        acct = parts[0].strip()
        if acct in result:
            result[acct].append({
                "date": parse_date(parts[1].strip()),
                "amount": parse_amount(parts[2].strip()),
                "method": parts[3].strip(),
                "reference": parts[4].strip(),
                "type": parts[5].strip(),
                "contract": parts[6].strip() if len(parts) > 6 else "",
            })
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_date(s: str):
    if not s or not str(s).strip():
        return None
    s = str(s).strip().split(" ")[0].split("T")[0]
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_amount(s: str):
    if not s:
        return None
    s = s.strip().replace("$", "").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------

def compare_all():
    print("=" * 80)
    print("PAYMENT COMPARISON: Access DB vs Exchange vs CRM")
    print("=" * 80)

    print("\n1. Loading Access DB payments...")
    access = get_access_payments(ACCOUNTS)
    for acct in ACCOUNTS:
        print(f"   {acct}: {len(access[acct])} payments")

    print("\n2. Fetching Exchange payments (live)...")
    exchange = fetch_exchange_payments(ACCOUNTS)
    for acct in ACCOUNTS:
        print(f"   {acct}: {len(exchange[acct])} payment items")

    print("\n3. Loading CRM payments...")
    crm = get_crm_payments(ACCOUNTS)
    for acct in ACCOUNTS:
        print(f"   {acct}: {len(crm[acct])} payments")

    print("\n" + "=" * 80)
    print("DETAILED COMPARISON BY ACCOUNT")
    print("=" * 80)

    for acct in ACCOUNTS:
        print(f"\n{'─' * 70}")
        print(f"ACCOUNT: {acct}")
        print(f"  Access: {len(access[acct])} | Exchange: {len(exchange[acct])} | CRM: {len(crm[acct])}")
        print(f"{'─' * 70}")

        # Build sets for comparison (date + amount as key)
        access_set = set()
        access_list = []
        for p in access[acct]:
            if p["date"] and p["amount"] is not None:
                key = (p["date"], p["amount"])
                access_set.add(key)
                access_list.append(p)

        crm_set = set()
        crm_list = []
        for p in crm[acct]:
            if p["date"] and p["amount"] is not None:
                key = (p["date"], p["amount"])
                crm_set.add(key)
                crm_list.append(p)

        # Exchange payments (from UserProperties)
        exchange_set = set()
        exchange_list = []
        for p in exchange[acct]:
            pdate = parse_date(p.get("txtDatePayment", ""))
            pamount = parse_amount(p.get("curPayment", ""))
            if pdate and pamount is not None:
                key = (pdate, pamount)
                exchange_set.add(key)
                exchange_list.append({
                    "date": pdate,
                    "amount": pamount,
                    "method": p.get("txtPmtMethod", ""),
                    "reference": p.get("txtCheckNumber", ""),
                    "subject": p.get("subject", ""),
                })

        # Find differences
        in_access_not_crm = access_set - crm_set
        in_crm_not_access = crm_set - access_set
        in_exchange_not_crm = exchange_set - crm_set
        in_crm_not_exchange = crm_set - exchange_set

        if in_access_not_crm:
            print(f"\n  ** IN ACCESS BUT NOT IN CRM ({len(in_access_not_crm)}):")
            for d, amt in sorted(in_access_not_crm):
                # Find matching Access record for details
                matching = [p for p in access_list if p["date"] == d and p["amount"] == amt]
                for m in matching:
                    print(f"     {d}  ${amt:>10.2f}  {m['method']:<15s} ref={m['reference']}")

        if in_exchange_not_crm:
            print(f"\n  ** IN EXCHANGE BUT NOT IN CRM ({len(in_exchange_not_crm)}):")
            for d, amt in sorted(in_exchange_not_crm):
                matching = [p for p in exchange_list if p["date"] == d and p["amount"] == amt]
                for m in matching:
                    print(f"     {d}  ${amt:>10.2f}  {m['method']:<15s} ref={m['reference']}  subj={m['subject'][:40]}")

        if in_crm_not_access:
            print(f"\n  ** IN CRM BUT NOT IN ACCESS ({len(in_crm_not_access)}):")
            for d, amt in sorted(in_crm_not_access):
                matching = [p for p in crm_list if p["date"] == d and p["amount"] == amt]
                for m in matching:
                    print(f"     {d}  ${amt:>10.2f}  {m['method']:<15s} type={m['type']}")

        if not in_access_not_crm and not in_exchange_not_crm and not in_crm_not_access:
            print(f"\n  ✓ All sources match!")

        # Summary totals
        access_total = sum(p["amount"] for p in access_list if p["amount"])
        crm_total = sum(p["amount"] for p in crm_list if p["amount"])
        exchange_total = sum(p["amount"] for p in exchange_list if p["amount"])
        print(f"\n  Totals — Access: ${access_total:,.2f} | Exchange: ${exchange_total:,.2f} | CRM: ${crm_total:,.2f}")

    print("\n" + "=" * 80)
    print("DONE")
    print("=" * 80)


if __name__ == "__main__":
    compare_all()
