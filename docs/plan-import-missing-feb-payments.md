# Plan: Import 7 Missing February 2026 Payments

## Context

Users reported 7 payments from mid-February 2026 that are missing from the CRM. These payments exist in both the Access DB and Exchange server but were never imported — they were entered in the legacy system after the last migration batch.

Production is a few days ahead of dev, so we sync prod to local first, apply the fix on dev, verify, then apply to prod.

### Payments to import

| # | Account | Name | Date | Amount | Ref | Active Contract | Contract ID |
|---|---------|------|------|--------|-----|-----------------|-------------|
| 1 | 24091001 | MEDINA, EDGAR | 2026-02-16 | $350.00 | MrQu | 24091001A2 | 244 |
| 2 | 25090501 | MARTINEZ, CALIXTO | 2026-02-16 | $500.00 | PF5a | 25090501A1 | 277 |
| 3 | 25091101 | SERNA, JORGE | 2026-02-16 | $400.00 | ynRq | 25091101A1 | 278 |
| 4 | 07022201 | CRUZ, SANTOS | 2026-02-16 | $400.00 | bHtK | 07022201A4 | 157 |
| 5 | 15030101 | LOPEZ, EDGAR & ANA SORIANO | 2026-02-16 | $400.00 | C1sR | 1503010 1AB7 | 177 |
| 6 | 14041501 | AVILA, ANA | 2026-02-18 | $150.00 | y7GB | 14041501A5 | 170 |
| 7 | 24031501 | OLIVERA, EDUARDA & FELIPE ZUNIGA | 2026-02-18 | $500.00 | 99yD | 24031501AB1 | 233 |

All ref numbers are non-numeric, so per `fetch_sample.py` line 935 logic, payment_method = `CREDIT CARD` (not CHECK).

## Steps

### Step 1: Sync prod to local

Run `scripts/db-sync-prod-to-local.sh` to bring dev up to date with production. Requires prod DB password.

### Step 2: Verify payments are still missing on dev

After sync, confirm none of these 7 payments exist:

```sql
SELECT a.account_number, ap.date_received, ap.amount, ap.reference_number
FROM account_payments ap
JOIN accounts a ON a.id = ap.account_id
WHERE a.account_number IN ('24091001','25090501','25091101','07022201','15030101','14041501','24031501')
  AND ap.date_received IN ('2026-02-16','2026-02-18')
  AND ap.deleted_at IS NULL;
```

Expected: 0 rows. If any exist (meaning prod already has some), adjust the INSERT list.

### Step 3: Generate and apply INSERT SQL on dev

Generate `migration/output/import_feb_payments.sql` with 7 INSERT statements. Contract IDs are determined from the most recent payment on each account (all verified above). Format follows existing pattern from `import_missing_payments.sql`:

```sql
INSERT INTO account_payments
  (account_id, contract_id, date_received, amount, payment_method, reference_number, type)
VALUES
  ((SELECT id FROM accounts WHERE account_number = '24091001'), 244, '2026-02-16', 350.00, 'CREDIT CARD', 'MrQu', 'payment');
-- ... 6 more
```

Apply to dev via `docker exec supabase_db_atomic-crm-demo psql`.

### Step 4: Run link_payment_schedule.py on dev

Allocate the new payments to schedule rows:

```bash
python3 migration/link_payment_schedule.py --apply
```

This does a full clear+rebuild of `payment_allocations`, so all existing allocations are recalculated too.

### Step 5: Verify on dev

1. Confirm 7 new payments exist with correct amounts, dates, methods, and contract links
2. Check that payment schedule view shows them as allocated
3. Spot-check one or two accounts in the CRM UI at `http://localhost:5173/`

### Step 6: Apply to prod

After user approval of dev results:
1. Ask for prod DB password
2. Run the same 7 INSERT statements against prod (`10.0.10.228:5433`)
3. Run `link_payment_schedule.py` against prod (it supports `--prod` or direct connection)

### Step 7: Verify on prod

Re-run the verification query on prod to confirm all 7 payments are present.

## Files involved

- `migration/output/import_feb_payments.sql` — generated INSERT SQL (new file)
- `scripts/db-sync-prod-to-local.sh` — sync tool
- `migration/link_payment_schedule.py` — payment allocation
- `migration/compare_payments.py` — comparison script created during this investigation (can be deleted or kept)

## Verification

- Query `account_payments` for these 7 accounts and confirm Feb payments exist
- Query `contract_payment_schedule_view` for the 7 contracts and confirm the new payments are allocated
- Check CRM UI for one account to confirm the payment shows in the Payments tab

---

## Round 2: 11 Additional Missing February 2026 Payments (2026-04-01)

### Context

After the first 7 payments were imported, a full comparison of Access DB (`billing_be.mdb`, refreshed 2026-03-28) against production found 11 more February 2026 payments missing from the CRM. These were entered in Access after the last migration batch.

### Payments to import

| # | Account | Name | Date | Amount | Method | Ref | Active Contract | Contract ID |
|---|---------|------|------|--------|--------|-----|-----------------|-------------|
| 1 | 07010604 | NORIEGA, YUBANI | 2026-02-20 | $350.00 | CHECK | htUc | 07010604A4 | 153 |
| 2 | 18091401 | VICTORINO, JAVIER & DEANNA | 2026-02-27 | $350.00 | CHECK | pXOZ | 18091401A1 | 186 |
| 3 | 20120901 | AGUINAGA, ROSA | 2026-02-23 | $250.00 | CHECK | dalk | 20120901A2 | 200 |
| 4 | 23022301 | MANZANARES, MARCIA | 2026-02-24 | $400.00 | CHECK | qh5u | 23022301A3 | 219 |
| 5 | 24020501 | CORTEZ, NELSON & GLENDA MARTINEZ CORTEZ | 2026-02-18 | $100.00 | MONEY ORDER | 109383911329 | 24020501A1 | 226 |
| 6 | 24091002 | SALAZAR, GUADALUPE | 2026-02-18 | $350.00 | CHECK | zusi | 24091002A1 | 245 |
| 7 | 24100103 | CANDIDO NICOLAS, JUAN | 2026-02-24 | $500.00 | CHECK | tl9h | 24100103A1 | 246 |
| 8 | 25050201 | MATEO, GUSTAVO | 2026-02-16 | $400.00 | CHECK | AaJH | 25050201A1 | 265 |
| 9 | 25071701 | MENESES VELAZQUEZ, ADRIAN | 2026-02-21 | $400.00 | CHECK | 240 | 25071701A1 | 270 |
| 10 | 25073001 | NORIEGA, AZARI & RAFAELA | 2026-02-21 | $350.00 | CHECK | 8uoe | 25073001A1 | 274 |
| 11 | 25091601 | GONZALEZ, ALMA ROSA | 2026-02-18 | $400.00 | CHECK | Fcsn | 25091601A1 | 279 |

**Total: $3,850.00**

Note: Access DB lists all as "CHECK". Ref "109383911329" (row 5) is numeric → MONEY ORDER. Ref "240" (row 9) is numeric but short — listed as CHECK in Access, keeping as CHECK.

### Steps

Same workflow as Round 1 (Steps 1–7 above), generating new INSERT SQL into `migration/output/import_feb_payments_round2.sql`.
