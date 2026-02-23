#!/usr/bin/env python3
"""
fetch_sample.py — Extract 5 sample accounts from the legacy OutlookForms CRM
and generate a ready-to-run SQL import file for Atomic CRM.

Data sources:
  - Access DB (billing_be.mdb) via mdbtools:  accounts, contracts, payments
  - Exchange 2003 public folders via WebDAV:  contacts, tasks, activities

Output:
  migration/output/debug_accounts.json   Raw Access DB records for selected accounts
  migration/output/debug_exchange.json   Raw Exchange WebDAV item properties
  migration/output/sample_import.sql     Ready-to-run SQL INSERT file

Usage:
  python3 migration/fetch_sample.py

Prerequisites:
  sudo apt-get install mdbtools
  pip install requests
  cp migration/config.example.py migration/config.py   # then fill in credentials
"""

import csv
import io
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
from urllib.parse import quote

# ---------------------------------------------------------------------------
# Config — loaded from migration/.env (gitignored)
# ---------------------------------------------------------------------------

def _load_env(env_path: str) -> dict:
    """Parse a .env file and return key/value pairs (no dependency on python-dotenv)."""
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

def _require(key: str) -> str:
    val = _env.get(key) or os.environ.get(key, "")
    if not val:
        print(f"ERROR: {key} is not set.")
        print(f"  Copy migration/.env.example → migration/.env and fill in values.")
        sys.exit(1)
    return val

MDB_PATH             = _require("MDB_PATH")
EXCHANGE_URL         = _require("EXCHANGE_URL")
EXCHANGE_USER        = _require("EXCHANGE_USER")
EXCHANGE_PASS        = _require("EXCHANGE_PASS")
SUPABASE_REST_URL    = _require("SUPABASE_REST_URL")
SUPABASE_SERVICE_KEY = _require("SUPABASE_SERVICE_KEY")

# Derived Exchange folder URLs (not in .env — computed from EXCHANGE_URL)
EXCHANGE_FOLDER       = EXCHANGE_URL.rstrip("/") + "/public/Account%20Tracking/"
EXCHANGE_FOLDER_SCOPE = EXCHANGE_URL.rstrip("/") + "/public/Account Tracking/"

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library not installed.")
    print("  pip install requests")
    sys.exit(1)

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

EXCHANGE_AUTH = (EXCHANGE_USER, EXCHANGE_PASS)

# ---------------------------------------------------------------------------
# WebDAV property URIs
# ---------------------------------------------------------------------------
#
# Exchange 2003 WebDAV represents MAPI properties as XML elements where the
# element namespace + localname reconstructs the property URI.
#
# Full URI                                             NS                                       local
# urn:schemas:httpmail:subject                  →  {urn:schemas:httpmail:}subject
# http://schemas.microsoft.com/mapi/proptag/x001a001e  →  {http://schemas.microsoft.com/mapi/proptag/}x001a001e

_NS_MAPI      = "http://schemas.microsoft.com/mapi/proptag/"
_NS_HTTPMAIL  = "urn:schemas:httpmail:"
_NS_CALENDAR  = "urn:schemas:calendar:"
_NS_TASKS     = "urn:schemas:tasks:"
_NS_CONTACTS  = "urn:schemas:contacts:"

# Full property URI strings (used in the WebDAV SQL SELECT and WHERE clauses)
PROP_MESSAGE_CLASS    = f"{_NS_MAPI}x001a001e"
PROP_CONV_TOPIC       = f"{_NS_MAPI}x0070001e"
PROP_SUBJECT          = f"{_NS_HTTPMAIL}subject"
PROP_BODY             = f"{_NS_HTTPMAIL}textdescription"
PROP_DATE             = f"{_NS_HTTPMAIL}date"
PROP_DTSTART          = f"{_NS_CALENDAR}dtstart"
PROP_TASK_DUE         = f"{_NS_TASKS}duedate"
PROP_TASK_COMPLETED   = f"{_NS_TASKS}datecompleted"
PROP_TASK_STATUS      = f"{_NS_TASKS}status"
PROP_GIVEN_NAME       = f"{_NS_CONTACTS}givenname"
PROP_SURNAME          = f"{_NS_CONTACTS}sn"
PROP_FULL_NAME        = f"{_NS_CONTACTS}cn"          # FullName / common name
PROP_EMAIL1           = f"{_NS_CONTACTS}email1"
PROP_HOME_PHONE       = f"{_NS_CONTACTS}homephone"   # HomeTelephoneNumber
PROP_BIZ_PHONE        = f"{_NS_CONTACTS}businessphone"
PROP_BIZ_STREET       = f"{_NS_CONTACTS}workstreet"
PROP_BIZ_CITY         = f"{_NS_CONTACTS}workcity"
PROP_BIZ_STATE        = f"{_NS_CONTACTS}workstate"
PROP_BIZ_ZIP          = f"{_NS_CONTACTS}workpostalcode"
PROP_BIZ_COUNTRY      = f"{_NS_CONTACTS}workcountry"
PROP_JOURNAL_TYPE     = f"{_NS_CONTACTS}journaltype"

# All properties to request in the SEARCH SELECT
ALL_PROPS = [
    PROP_MESSAGE_CLASS, PROP_CONV_TOPIC, PROP_SUBJECT, PROP_BODY, PROP_DATE,
    PROP_DTSTART, PROP_TASK_DUE, PROP_TASK_COMPLETED, PROP_TASK_STATUS,
    PROP_GIVEN_NAME, PROP_SURNAME, PROP_FULL_NAME, PROP_EMAIL1,
    PROP_HOME_PHONE, PROP_BIZ_PHONE,
    PROP_BIZ_STREET, PROP_BIZ_CITY, PROP_BIZ_STATE, PROP_BIZ_ZIP,
    PROP_BIZ_COUNTRY, PROP_JOURNAL_TYPE,
]

# ---------------------------------------------------------------------------
# Step 1 — Export Access DB tables via mdbtools
# ---------------------------------------------------------------------------

def export_mdb_table(table_name: str) -> list:
    """Run mdb-export and return rows as a list of dicts."""
    try:
        result = subprocess.run(
            ["mdb-export", MDB_PATH, table_name],
            capture_output=True, check=True,
        )
        result.stdout = result.stdout.decode("cp1252", errors="replace").replace("\x00", "")
    except subprocess.CalledProcessError as e:
        print(f"  ERROR: mdb-export failed for {table_name}: {e.stderr.strip()}")
        return []
    except FileNotFoundError:
        print("  ERROR: mdbtools not found. Install with: sudo apt-get install mdbtools")
        sys.exit(1)

    reader = csv.DictReader(io.StringIO(result.stdout))
    return list(reader)


def load_access_tables():
    print("Exporting Access DB tables...")
    clients   = export_mdb_table("tblClients")
    contracts = export_mdb_table("tblContracts")
    payments  = export_mdb_table("tblPaymentsReceived")
    print(f"  tblClients:          {len(clients):>5} rows")
    print(f"  tblContracts:        {len(contracts):>5} rows")
    print(f"  tblPaymentsReceived: {len(payments):>5} rows")
    return clients, contracts, payments


# ---------------------------------------------------------------------------
# Step 2 — Select 5 sample accounts
# ---------------------------------------------------------------------------

def parse_date(s: str) -> Optional[date]:
    """Parse date strings from Access (M/D/YYYY, M/D/YY HH:MM:SS, YYYY-MM-DD, etc.)."""
    if not s or not str(s).strip():
        return None
    # Strip any trailing time component before trying date-only formats
    s = str(s).strip().split(" ")[0]
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def select_sample_accounts(clients, contracts, payments):
    """
    Select up to 5 accounts meeting all criteria:
      - Has at least one contract in tblContracts
      - Has at least one payment in tblPaymentsReceived
      - date_opened between 3 and 8 years ago
      - Most recent payment older than 12 months (not actively paying)
      - Not marked as Archive in Categories

    Sorted by last payment date ascending (oldest activity first).
    Falls back to relaxed selection if strict criteria yield < 5.
    """
    today = date.today()
    cutoff_start  = today - timedelta(days=8 * 365)
    cutoff_end    = today - timedelta(days=3 * 365)
    active_cutoff = today - timedelta(days=365)

    # Index contracts and payments by account number
    contracts_by_acct = {}
    for c in contracts:
        acct = (c.get("Account") or "").strip()
        if acct:
            contracts_by_acct.setdefault(acct, []).append(c)

    last_payment_by_acct = {}
    payments_by_acct = {}
    for p in payments:
        acct = (p.get("Account") or "").strip()
        if not acct:
            continue
        payments_by_acct.setdefault(acct, []).append(p)
        pdate = parse_date(p.get("DateRecd") or "")
        if pdate:
            prev = last_payment_by_acct.get(acct)
            if prev is None or pdate > prev:
                last_payment_by_acct[acct] = pdate

    candidates = []
    for client in clients:
        acct = (client.get("Account") or "").strip()
        if not acct:
            continue
        categories = client.get("Categories") or ""
        if "Archive" in categories:
            continue
        if acct not in contracts_by_acct:
            continue
        if acct not in payments_by_acct:
            continue
        date_opened = parse_date(client.get("DateOpen") or "")
        if date_opened is None:
            continue
        if not (cutoff_start <= date_opened <= cutoff_end):
            continue
        last_pmt = last_payment_by_acct.get(acct)
        if last_pmt is None or last_pmt >= active_cutoff:
            continue
        candidates.append((last_pmt, client, acct))

    candidates.sort(key=lambda x: x[0])
    selected = candidates[:5]

    if len(selected) < 5:
        print(f"  Strict criteria matched {len(selected)} accounts; relaxing date filters...")
        seen = {x[2] for x in selected}
        for client in clients:
            if len(selected) >= 5:
                break
            acct = (client.get("Account") or "").strip()
            if not acct or acct in seen:
                continue
            if "Archive" in (client.get("Categories") or ""):
                continue
            if acct not in contracts_by_acct:
                continue
            if acct not in payments_by_acct:
                continue
            last_pmt = last_payment_by_acct.get(acct, date(2000, 1, 1))
            selected.append((last_pmt, client, acct))
            seen.add(acct)

    account_numbers = [x[2] for x in selected]
    print(f"  Selected {len(account_numbers)} accounts: {account_numbers}")
    return account_numbers, [x[1] for x in selected]


# ---------------------------------------------------------------------------
# Step 3 — Fetch Exchange items via WebDAV SEARCH
# ---------------------------------------------------------------------------

def build_search_xml(account_number: str) -> str:
    """Build a WebDAV SEARCH request body scoped to one account number."""
    select_cols = ",\n      ".join(f'"{p}"' for p in ALL_PROPS)
    return f"""<?xml version="1.0"?>
<searchrequest xmlns="DAV:">
  <sql>
    SELECT
      "DAV:href",
      {select_cols}
    FROM SCOPE('shallow traversal of "{EXCHANGE_FOLDER_SCOPE}"')
    WHERE "{PROP_CONV_TOPIC}" = '{account_number}'
  </sql>
</searchrequest>"""


def _element_tag_to_uri(tag: str) -> str:
    """
    Convert an ElementTree tag {namespace}localname back to a full property URI.

    Exchange property URIs end with the separator already, e.g.:
      {urn:schemas:httpmail:}subject  →  urn:schemas:httpmail:subject
      {http://schemas.microsoft.com/mapi/proptag/}x001a001e  →  http://schemas.microsoft.com/mapi/proptag/x001a001e
    """
    if tag.startswith("{"):
        close = tag.index("}")
        return tag[1:close] + tag[close + 1:]
    return tag


def parse_search_response(xml_text: str, account_number: str) -> list:
    """Parse a WebDAV multistatus response and return a list of item dicts."""
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"    Warning: XML parse error for {account_number}: {e}")
        return items

    for response_el in root.iter("{DAV:}response"):
        href_el = response_el.find("{DAV:}href")
        href = (href_el.text or "").strip() if href_el is not None else ""

        # Collect all property values keyed by full URI
        prop_values = {}
        for prop_el in response_el.iter("{DAV:}prop"):
            for child in prop_el:
                uri = _element_tag_to_uri(child.tag)
                text = (child.text or "").strip()
                if text:
                    prop_values[uri] = text

        def get(uri: str) -> str:
            return prop_values.get(uri, "")

        item = {
            "href":           href,
            "message_class":  get(PROP_MESSAGE_CLASS),
            "conv_topic":     get(PROP_CONV_TOPIC),
            "subject":        get(PROP_SUBJECT),
            "body":           get(PROP_BODY),
            "date":           get(PROP_DATE),
            "dtstart":        get(PROP_DTSTART),
            "task_due":       get(PROP_TASK_DUE),
            "task_completed": get(PROP_TASK_COMPLETED),
            "task_status":    get(PROP_TASK_STATUS),
            "given_name":     get(PROP_GIVEN_NAME),
            "surname":        get(PROP_SURNAME),
            "full_name":      get(PROP_FULL_NAME),
            "email1":         get(PROP_EMAIL1),
            "home_phone":     get(PROP_HOME_PHONE),
            "biz_phone":      get(PROP_BIZ_PHONE),
            "biz_street":     get(PROP_BIZ_STREET),
            "biz_city":       get(PROP_BIZ_CITY),
            "biz_state":      get(PROP_BIZ_STATE),
            "biz_zip":        get(PROP_BIZ_ZIP),
            "biz_country":    get(PROP_BIZ_COUNTRY),
            "journal_type":   get(PROP_JOURNAL_TYPE),
            # Preserve all raw props for debugging
            "_raw": prop_values,
        }
        items.append(item)

    return items


def fetch_exchange_items(account_numbers: list) -> dict:
    """
    Issue one WebDAV SEARCH per account number.
    Returns dict: account_number → list of item dicts.
    Gracefully handles connection errors (Exchange may be unreachable).
    """
    results = {}
    for acct in account_numbers:
        print(f"  Fetching Exchange items for {acct}...")
        search_body = build_search_xml(acct)
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
                print(f"    Warning: HTTP {resp.status_code} — no items fetched")
                results[acct] = []
                continue
            items = parse_search_response(resp.text, acct)
            # Partition by message class for reporting
            by_class = {}
            for it in items:
                mc = it.get("message_class") or "unknown"
                by_class.setdefault(mc, 0)
                by_class[mc] += 1
            detail = ", ".join(f"{mc.split('.')[-1]}×{n}" for mc, n in by_class.items())
            print(f"    {len(items)} items  ({detail})")
            results[acct] = items
        except requests.exceptions.ConnectionError as e:
            print(f"    Warning: Cannot reach Exchange ({e}); skipping Exchange items for {acct}")
            results[acct] = []
        except requests.RequestException as e:
            print(f"    Warning: Request failed for {acct}: {e}")
            results[acct] = []

    return results


# ---------------------------------------------------------------------------
# Step 4 — Look up Supabase IDs (admin user, contact type)
# ---------------------------------------------------------------------------

def _supabase_get(path: str, params: dict) -> list:
    """GET from Supabase REST API with service key auth."""
    headers = {
        "apikey":          SUPABASE_SERVICE_KEY,
        "Authorization":   f"Bearer {SUPABASE_SERVICE_KEY}",
        "Accept":          "application/json",
    }
    url = f"{SUPABASE_REST_URL}/rest/v1/{path}"
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"  Warning: Supabase request failed ({path}): {e}")
        return []


def fetch_admin_user_id() -> Optional[int]:
    rows = _supabase_get("users", {"administrator": "eq.true", "limit": "1"})
    if rows:
        u = rows[0]
        print(f"  Admin user: {u.get('first_name')} {u.get('last_name')} (id={u.get('id')})")
        return u["id"]
    print("  Warning: No admin user found in Supabase")
    return None


def fetch_contact_type_id(name: str = "petitioner") -> Optional[int]:
    rows = _supabase_get("contact_types", {"name": f"eq.{name}", "limit": "1"})
    if rows:
        return rows[0]["id"]
    print(f"  Warning: contact_type '{name}' not found in Supabase")
    return None


# ---------------------------------------------------------------------------
# SQL value helpers
# ---------------------------------------------------------------------------

def sql_str(val) -> str:
    """Render a Python value as a SQL string literal or NULL."""
    if val is None or str(val).strip() == "":
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def sql_date(val) -> str:
    """Render a date value as a SQL date literal or NULL."""
    if val is None or str(val).strip() == "":
        return "NULL"
    d = parse_date(str(val))
    return f"'{d.isoformat()}'" if d else "NULL"


def sql_num(val) -> str:
    """Render a numeric value as a SQL numeric literal or NULL."""
    if val is None:
        return "NULL"
    s = str(val).strip().replace(",", "").replace("$", "")
    if s in ("", "0", "0.0", "0.00"):
        return "NULL"
    try:
        f = float(s)
        # Format without trailing zeros up to 2 decimal places
        return f"{f:.2f}"
    except ValueError:
        return "NULL"


def sql_int(val) -> str:
    """Render an integer value as a SQL integer literal or NULL."""
    if val is None or str(val).strip() == "":
        return "NULL"
    try:
        return str(int(float(str(val).strip())))
    except ValueError:
        return "NULL"


def sql_uid(admin_user_id: Optional[int]) -> str:
    return str(admin_user_id) if admin_user_id is not None else "NULL"


# ---------------------------------------------------------------------------
# Step 5 — Transform data to SQL INSERT statements
# ---------------------------------------------------------------------------

def account_name_from_exchange(acct_num: str, exchange_items: list) -> Optional[str]:
    """Extract account name from IPM.Post.Account info subject, stripping trailing account number."""
    for item in exchange_items:
        if "IPM.Post.Account info" in (item.get("message_class") or ""):
            subj = (item.get("subject") or "").strip()
            # Subject format: "LAST, FIRST 14011101" — strip trailing account number
            if subj.endswith(acct_num):
                subj = subj[: -len(acct_num)].strip()
            if subj:
                return subj
    return None


def transform_accounts(clients_map: dict, exchange_by_acct: dict, uid: str) -> list:
    lines = []
    for acct_num, client in clients_map.items():
        # Prefer Exchange name (richer); fall back to tblClients fields
        name = account_name_from_exchange(acct_num, exchange_by_acct.get(acct_num, []))
        if not name:
            last  = (client.get("LastName")  or "").strip()
            first = (client.get("FirstName") or "").strip()
            name  = f"{last}, {first}" if last and first else last or first or acct_num

        phone       = (client.get("Phone")          or "").strip() or None
        email       = (client.get("Email")          or "").strip() or None
        date_opened = sql_date(client.get("DateOpen") or "")
        date_consult = sql_date(client.get("DateFirstConsult") or "")
        categories  = (client.get("Categories") or "In Process").strip() or "In Process"
        referred_by = (client.get("ReferredBy") or "").strip() or None

        lines.append(
            "INSERT INTO accounts "
            "(account_number, name, phone, email, "
            "attorney_id, law_clerk_id, legal_assistant_id, "
            "date_opened, date_first_consult, categories, referred_by, archived, user_id) "
            "VALUES ("
            f"{sql_str(acct_num)}, {sql_str(name)}, {sql_str(phone)}, {sql_str(email)}, "
            f"{uid}, {uid}, {uid}, "
            f"{date_opened}, {date_consult}, "
            f"{sql_str(categories)}, {sql_str(referred_by)}, FALSE, {uid}"
            ") ON CONFLICT (account_number) DO NOTHING;"
        )
    return lines


def transform_contacts(
    acct_num: str,
    exchange_items: list,
    client: dict,
    uid: str,
    type_id: str,
) -> list:
    lines = []

    # Case-insensitive match — Exchange returns "IPM.Contact.Account Contact" (capital C)
    contact_items = [
        it for it in exchange_items
        if "ipm.contact.account contact" in (it.get("message_class") or "").lower()
    ]

    if contact_items:
        for i, item in enumerate(contact_items):
            is_billing = "TRUE" if i == 0 else "FALSE"
            first = (item.get("given_name") or "").strip()
            last  = (item.get("surname")    or "").strip()
            if not first:
                # Try cn (FullName / common name) first
                full = (item.get("full_name") or "").strip()
                if full and last and full.endswith(last):
                    first = full[: -len(last)].strip() or full
                elif full:
                    first = full
                else:
                    # Fall back to subject: "FIRSTNAME LASTNAME" or "FIRST & SECOND LASTNAME"
                    subj = (item.get("subject") or "").strip()
                    if last and subj.endswith(last):
                        first = subj[: -len(last)].strip() or subj
                    else:
                        first = subj or "Unknown"
            # Use home phone if biz phone is absent (VBScript uses HomeTelephoneNumber)
            phone = (item.get("biz_phone") or item.get("home_phone") or "").strip() or None
            lines.append(
                "INSERT INTO account_contacts "
                "(account_id, contact_type_id, is_billing_contact, first_name, last_name, "
                "email, phone, address_street, address_city, address_state, "
                "address_postal_code, address_country, user_id) "
                "VALUES ("
                f"(SELECT id FROM accounts WHERE account_number = {sql_str(acct_num)}), "
                f"{type_id}, {is_billing}, "
                f"{sql_str(first)}, {sql_str(last)}, "
                f"{sql_str(item.get('email1', ''))}, {sql_str(phone)}, "
                f"{sql_str(item.get('biz_street', ''))}, {sql_str(item.get('biz_city', ''))}, "
                f"{sql_str(item.get('biz_state', ''))}, "
                f"{sql_str(item.get('biz_zip', ''))}, {sql_str(item.get('biz_country', ''))}, "
                f"{uid}"
                ");"
            )
    else:
        # No Exchange contact found — create one from tblClients data
        first = (client.get("FirstName") or "").strip() or "Unknown"
        last  = (client.get("LastName")  or "").strip() or ""
        phone = (client.get("Phone")     or "").strip() or None
        email = (client.get("Email")     or "").strip() or None
        lines.append(
            "INSERT INTO account_contacts "
            "(account_id, contact_type_id, is_billing_contact, first_name, last_name, "
            "email, phone, user_id) "
            "VALUES ("
            f"(SELECT id FROM accounts WHERE account_number = {sql_str(acct_num)}), "
            f"{type_id}, TRUE, "
            f"{sql_str(first)}, {sql_str(last)}, "
            f"{sql_str(email)}, {sql_str(phone)}, {uid}"
            ");"
        )
    return lines


def transform_contracts(acct_num: str, contracts: list, uid: str) -> list:
    lines = []
    for c in contracts:
        # Contract column already contains the full number (e.g. "14011101A1")
        contract_number = str(c.get("Contract") or "").strip()
        if not contract_number:
            continue
        case_type        = (c.get("CaseType") or "").strip() or None
        date_opened      = sql_date(c.get("DateOpen") or "")
        fee              = sql_num(c.get("Fee") or "")
        retainer         = sql_num(c.get("Retainer") or "")
        monthly          = sql_num(c.get("Payment") or "")
        num_payments     = sql_int(c.get("NumPayments") or "")
        final_payment    = sql_num(c.get("FinalPayment") or "")
        date_retainer    = sql_date(c.get("DateRetainer") or "")
        date_first_pmt   = sql_date(c.get("DateFirstPayment") or "")

        lines.append(
            "INSERT INTO account_contracts "
            "(account_id, contract_number, case_type, status, fee, retainer, "
            "monthly_payment, num_payments, final_payment, "
            "date_opened, date_retainer, date_first_payment, user_id) "
            "VALUES ("
            f"(SELECT id FROM accounts WHERE account_number = {sql_str(acct_num)}), "
            f"{sql_str(contract_number)}, {sql_str(case_type)}, 'In progress', "
            f"{fee}, {retainer}, {monthly}, {num_payments}, {final_payment}, "
            f"{date_opened}, {date_retainer}, {date_first_pmt}, {uid}"
            ");"
        )
    return lines


def transform_payments(acct_num: str, payments: list, uid: str) -> list:
    lines = []
    for p in payments:
        date_recd = sql_date(p.get("DateRecd") or "")
        if date_recd == "NULL":
            continue
        amount = sql_num(p.get("AmtRecd") or "")
        if amount == "NULL":
            continue

        method      = ((p.get("PaymentMethod") or "").strip().upper()) or "CHECK"
        check_num   = (p.get("CheckNumber") or "").strip() or None
        # Contract column already contains the full number (e.g. "14011101A1")
        contract_number = str(p.get("Contract") or "").strip()
        if contract_number:
            contract_subquery = f"(SELECT id FROM account_contracts WHERE contract_number = {sql_str(contract_number)})"
        else:
            contract_subquery = "NULL"

        lines.append(
            "INSERT INTO account_payments "
            "(account_id, contract_id, date_received, amount, payment_method, reference_number, user_id) "
            "VALUES ("
            f"(SELECT id FROM accounts WHERE account_number = {sql_str(acct_num)}), "
            f"{contract_subquery}, "
            f"{date_recd}, {amount}, {sql_str(method)}, {sql_str(check_num)}, {uid}"
            ");"
        )
    return lines


def transform_tasks(acct_num: str, exchange_items: list, uid: str) -> list:
    lines = []
    task_items = [
        it for it in exchange_items
        if "IPM.Task.Account task" in (it.get("message_class") or "")
    ]
    for item in task_items:
        text     = (item.get("subject") or "Task").strip() or "Task"
        due_date = sql_date(item.get("task_due") or "")
        if due_date == "NULL":
            due_date = "'2099-12-31'"  # placeholder for tasks with no due date

        done_date = sql_date(item.get("task_completed") or "")

        ex_status = (item.get("task_status") or "").strip().lower()
        if done_date != "NULL" or "complet" in ex_status:
            status = "Done"
        else:
            status = "To do"

        lines.append(
            "INSERT INTO tasks "
            "(account_id, type, text, due_date, done_date, status, user_id) "
            "VALUES ("
            f"(SELECT id FROM accounts WHERE account_number = {sql_str(acct_num)}), "
            f"'None', {sql_str(text)}, "
            f"{due_date}, {done_date}, {sql_str(status)}, {uid}"
            ");"
        )
    return lines


def transform_activities(acct_num: str, exchange_items: list, uid: str) -> list:
    lines = []
    activity_items = [
        it for it in exchange_items
        if "IPM.Activity.Account activity" in (it.get("message_class") or "")
    ]
    for item in activity_items:
        subject      = (item.get("subject") or "Activity").strip() or "Activity"
        body         = (item.get("body") or "").strip() or None
        journal_type = (item.get("journal_type") or "Note").strip() or "Note"

        # Prefer dtstart (journal start time), fall back to message date
        raw_date = (item.get("dtstart") or item.get("date") or "").strip()
        if raw_date:
            try:
                # Parse ISO 8601 or RFC 2822-ish strings from Exchange
                dt_str = raw_date.rstrip("Z").replace("T", " ")
                dt = datetime.fromisoformat(dt_str)
                activity_date_sql = f"'{dt.isoformat()}'"
            except ValueError:
                activity_date_sql = "NULL"
        else:
            activity_date_sql = "NULL"

        lines.append(
            "INSERT INTO account_activities "
            "(account_id, type, subject, body, date, user_id) "
            "VALUES ("
            f"(SELECT id FROM accounts WHERE account_number = {sql_str(acct_num)}), "
            f"{sql_str(journal_type)}, {sql_str(subject)}, {sql_str(body)}, "
            f"{activity_date_sql}, {uid}"
            ");"
        )
    return lines


# ---------------------------------------------------------------------------
# Step 6 — Generate sample_import.sql
# ---------------------------------------------------------------------------

def generate_sql(
    clients_map: dict,
    contracts_by_acct: dict,
    payments_by_acct: dict,
    exchange_by_acct: dict,
    admin_user_id: Optional[int],
    petitioner_type_id: Optional[int],
) -> str:
    uid      = sql_uid(admin_user_id)
    type_id  = str(petitioner_type_id) if petitioner_type_id is not None else "NULL"
    account_numbers = list(clients_map.keys())

    lines = []

    def section(title: str):
        lines.append("")
        lines.append("-- " + "=" * 60)
        lines.append(f"-- {title}")
        lines.append("-- " + "=" * 60)

    lines.append("-- " + "=" * 60)
    lines.append("-- sample_import.sql  —  OutlookForms → Atomic CRM")
    lines.append(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"-- Accounts:  {', '.join(account_numbers)}")
    lines.append("-- " + "=" * 60)
    lines.append("")
    lines.append("BEGIN;")

    # 1. accounts
    section("1. Accounts")
    lines.extend(transform_accounts(clients_map, exchange_by_acct, uid))

    # 2. account_contacts
    section("2. Account Contacts")
    for acct_num in account_numbers:
        items  = exchange_by_acct.get(acct_num, [])
        client = clients_map[acct_num]
        lines.extend(transform_contacts(acct_num, items, client, uid, type_id))

    # 3. account_contracts
    section("3. Account Contracts")
    for acct_num in account_numbers:
        lines.extend(transform_contracts(acct_num, contracts_by_acct.get(acct_num, []), uid))

    # 4. account_payments
    section("4. Account Payments")
    for acct_num in account_numbers:
        lines.extend(transform_payments(acct_num, payments_by_acct.get(acct_num, []), uid))

    # 5. tasks
    section("5. Tasks (from Exchange)")
    for acct_num in account_numbers:
        lines.extend(transform_tasks(acct_num, exchange_by_acct.get(acct_num, []), uid))

    # 6. account_activities
    section("6. Account Activities (from Exchange)")
    for acct_num in account_numbers:
        lines.extend(transform_activities(acct_num, exchange_by_acct.get(acct_num, []), uid))

    # Row-count summary
    section("Row Count Summary")
    for tbl in [
        "accounts", "account_contacts", "account_contracts",
        "account_payments", "tasks", "account_activities",
    ]:
        lines.append(f"SELECT '{tbl}' AS tbl, count(*) AS n FROM {tbl};")

    lines.append("")
    lines.append("COMMIT;")
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="OutlookForms → Atomic CRM sample migration")
    parser.add_argument(
        "--account", metavar="ACCT", nargs="+",
        help="One or more account numbers to extract (skips auto-selection)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("OutlookForms → Atomic CRM  —  Sample Migration")
    print("=" * 60)
    print()

    # Step 1: Export Access DB
    clients, contracts, payments = load_access_tables()
    print()

    # Step 2: Select accounts
    if args.account:
        # Manual selection — look up each account in tblClients
        forced = [a.strip() for a in args.account]
        clients_by_acct = {(c.get("Account") or "").strip(): c for c in clients}
        selected_clients = []
        account_numbers = []
        for a in forced:
            if a in clients_by_acct:
                account_numbers.append(a)
                selected_clients.append(clients_by_acct[a])
            else:
                print(f"  Warning: account {a} not found in tblClients — will use placeholder")
                account_numbers.append(a)
                selected_clients.append({"Account": a})
        print(f"Manual account selection: {account_numbers}")
    else:
        print("Selecting sample accounts...")
        account_numbers, selected_clients = select_sample_accounts(
            clients, contracts, payments
        )
    print()

    if not account_numbers:
        print("ERROR: No accounts could be selected.")
        print("  Check MDB_PATH in config.py and verify mdbtools output.")
        sys.exit(1)
    print()

    # Build lookup maps restricted to selected accounts
    clients_map = {
        (c.get("Account") or "").strip(): c
        for c in selected_clients
        if (c.get("Account") or "").strip()
    }

    contracts_by_acct: dict = {}
    for c in contracts:
        acct = (c.get("Account") or "").strip()
        if acct in clients_map:
            contracts_by_acct.setdefault(acct, []).append(c)

    payments_by_acct: dict = {}
    for p in payments:
        acct = (p.get("Account") or "").strip()
        if acct in clients_map:
            payments_by_acct.setdefault(acct, []).append(p)

    # Save Access DB debug data
    debug_accounts = {
        acct: {
            "client":    clients_map[acct],
            "contracts": contracts_by_acct.get(acct, []),
            "payments":  payments_by_acct.get(acct, []),
        }
        for acct in account_numbers
    }
    debug_acct_path = OUTPUT_DIR / "debug_accounts.json"
    with open(debug_acct_path, "w") as f:
        json.dump(debug_accounts, f, indent=2, default=str)
    print(f"Wrote {debug_acct_path}")
    print()

    # Step 3: Fetch Exchange items
    print("Fetching Exchange items (WebDAV SEARCH)...")
    exchange_by_acct = fetch_exchange_items(account_numbers)
    total_items = sum(len(v) for v in exchange_by_acct.values())

    # Strip _raw from debug output to keep it readable
    debug_exchange = {
        acct: [
            {k: v for k, v in it.items() if k != "_raw"}
            for it in items
        ]
        for acct, items in exchange_by_acct.items()
    }
    debug_ex_path = OUTPUT_DIR / "debug_exchange.json"
    with open(debug_ex_path, "w") as f:
        json.dump(debug_exchange, f, indent=2, default=str)
    print(f"Wrote {debug_ex_path}  ({total_items} Exchange items total)")
    print()

    # Step 4: Look up Supabase IDs
    print("Looking up Supabase IDs...")
    admin_user_id      = fetch_admin_user_id()
    petitioner_type_id = fetch_contact_type_id("petitioner")
    if admin_user_id is None:
        print("  Warning: user_id will be NULL — update manually after import if needed")
    print()

    # Step 5: Generate SQL
    print("Generating SQL...")
    sql = generate_sql(
        clients_map,
        contracts_by_acct,
        payments_by_acct,
        exchange_by_acct,
        admin_user_id,
        petitioner_type_id,
    )
    sql_path = OUTPUT_DIR / "sample_import.sql"
    with open(sql_path, "w") as f:
        f.write(sql)
    print(f"Wrote {sql_path}")
    print()

    # Summary table
    print("=" * 70)
    print(f"{'Account':<12}  {'Name':<30}  {'Contr':>5}  {'Pmts':>5}  {'Exch':>5}")
    print("-" * 70)
    for acct in account_numbers:
        client = clients_map.get(acct, {})
        last   = (client.get("LastName")  or "").strip()
        first  = (client.get("FirstName") or "").strip()
        name   = f"{last}, {first}" if last else first or acct
        n_c    = len(contracts_by_acct.get(acct, []))
        n_p    = len(payments_by_acct.get(acct, []))
        n_e    = len(exchange_by_acct.get(acct, []))
        print(f"{acct:<12}  {name:<30}  {n_c:>5}  {n_p:>5}  {n_e:>5}")
    print("=" * 70)
    print()

    print("Next steps:")
    print(f"  1. Review  {sql_path}")
    print(f"  2. Apply:  psql postgresql://postgres:postgres@localhost:54322/postgres \\")
    print(f"               -f {sql_path}")
    print("  3. Verify: open http://localhost:5173 and check the 5 accounts")
    print()


if __name__ == "__main__":
    main()
