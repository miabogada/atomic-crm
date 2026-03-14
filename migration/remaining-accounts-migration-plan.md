# Remaining Accounts Migration Plan

**Date:** 2026-03-14

## Overview

25 case accounts remain in Exchange/Access that have not been imported into Atomic CRM. This plan covers the full import, payment association, schedule linking, production deployment, and documentation.

## Accounts to migrate

| Name | Account # |
|------|-----------|
| Salli Santana | 25062601 |
| Jesus Moral | 26022701 |
| Heather Godfrey & Bruno Viana | 22012801 |
| Antonio Laurel | 20090802 |
| Lorena Carrera & Juan Ortiz | 19062701 |
| Felix Miranda | 22030701 |
| Ricardo Aceves | 25121901 |
| Gabriela Farias & Jose Luis Mendoza | 21082401 |
| Noe Carvajal | 26022601 |
| Paola Barios | 22100401 |
| Norma & Hugo Mazariegos | 06090901 |
| Oscar Miguel & Diana Abejarucos | 16082701 |
| Hector Lopez | 09040101 |
| Maria & Ricardo Leyva | 06122701 |
| Norma Alas & Vinicio | 07042104 |
| Maritza Aguilar | 23022801 |
| Jose Luis Leon | 21030801 |
| Jaime Encino & Hilda | 21031701 |
| Katherine Molina | 22021401 |
| Felix Camarena | 26021701 |
| Juan de la Cruz Valtierra | 21072301 |
| Anacleto Duarte | 20062301 |
| Jesus Carrillo | 20072201 |
| Edith Estanislao | 22012601 |
| Maria Moran | 20072401 |

**Notes:**
- Original list had `220122801` for Heather Godfrey — assumed typo, corrected to `22012801`.
- `Juan Antonio de la Cruz Valtierra` (21072301) is a duplicate of `Juan de la Cruz Valtierra` — same account number, counted once.
- **Validated:** None of these 25 account numbers exist in the local Supabase `accounts` table.

---

## Phase 1: Bulk Import

1. Run `fetch_sample.py` with all 25 account numbers:
   ```bash
   python3 migration/fetch_sample.py --account \
     25062601 26022701 22012801 20090802 19062701 \
     22030701 25121901 21082401 26022601 22100401 \
     06090901 16082701 09040101 06122701 07042104 \
     23022801 21030801 21031701 22021401 26021701 \
     21072301 20062301 20072201 22012601 20072401
   ```
2. Review generated `migration/output/sample_import.sql`
3. Apply to local dev via docker psql
4. Verify in CRM UI — spot-check a few accounts

---

## Phase 2: Associate Payments to Contracts

1. **Dry run** — generates CSVs + SQL, no DB changes:
   ```bash
   python3 migration/associate_payments.py
   ```
2. **Review `associate_payments_report.csv`** — check per-payment rule/reason assignments
3. **Review `associate_payments_contract_summary.csv`** — check for overpaid contracts (balance < 0), confirm no exact-offset overpaid/underpaid pairs (which indicate mis-links)
4. **Spot-check** specific accounts in the payment report
5. **Apply to local**:
   ```bash
   python3 migration/associate_payments.py --apply
   ```
6. **Local validation** — verify in CRM UI

---

## Phase 3: Link Payments to Payment Schedule

1. **Dry run** — generates SQL:
   ```bash
   python3 migration/link_payment_schedule.py
   ```
2. **Review** generated `migration/output/link_payment_schedule.sql`
3. **Apply to local**:
   ```bash
   python3 migration/link_payment_schedule.py --apply
   ```
4. **Local validation** — verify in CRM UI

---

## Phase 4: Production Deployment

1. **Backup prod** before any changes:
   ```bash
   docker run --rm postgres:15 pg_dump \
     "postgresql://postgres:PASSWORD@10.0.10.228:5433/postgres" \
     > migration/backups/prod_data_2026-03-14.sql
   ```
2. **Apply Phase 1 SQL** (`sample_import.sql`) to prod:
   ```bash
   docker run --rm -i postgres:15 psql \
     "postgresql://postgres:PASSWORD@10.0.10.228:5433/postgres" \
     < migration/output/sample_import.sql
   ```
3. **Apply Phase 2 SQL** (`associate_payments.sql`) to prod
4. **Apply Phase 3 SQL** (`link_payment_schedule.sql`) to prod
5. **Prod validation:**
   - Row counts — compare local vs prod
   - Spot-check accounts in prod CRM UI
   - Compare payment/contract balances between local and prod

---

## Phase 5: Documentation

1. Update `CHANGELOG.md` with summary of what was imported and results
2. Save completion status to muninndb
