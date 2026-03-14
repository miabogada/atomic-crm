# Associate Payments Algorithm

## Problem

After the Phase 1 bulk import, 1,091 of 1,234 payments (88%) have `contract_id = NULL` because the legacy Access/Exchange system doesn't associate payments with contracts. The 143 already-linked payments are retainers (matched during import by `date_received = contract.date_opened`).

## Algorithm: Capacity-Aware Filling

Payments are processed **per-account in chronological order**, tracking a running total per contract. A contract is considered "full" once its running total reaches its fee. This prevents overpaying a contract and spilling excess into the wrong bucket.

### Rules (priority order)

#### Rule 1: Single-contract

If an account has exactly one contract, all payments go to it. No ambiguity.

- **634 payments** matched this rule.

#### Rule 2: Date-range with capacity

For sequential multi-contract accounts, assign to the contract whose date range `[date_opened, next.date_opened)` contains the payment date — **unless that contract is already full**, in which case spill forward or backward.

Sub-rules:

| Sub-rule | When | Count |
|----------|------|-------|
| `date-range` | Payment falls in range, contract has capacity | 442 |
| `boundary-payoff` | Payment lands on next contract's `date_opened` but exactly fills prior contract's remaining capacity | 1 |
| `capacity-spill-back` | Date-range contract is full, payment fits in prior contract | 2 |
| `capacity-spill-fwd` | Date-range contract is full, spill to next contract with capacity | 1 |

#### Rule 3: Amount matching with capacity

For concurrent contracts (same `date_opened`), match `payment.amount` against `contract.monthly_payment`. Skip contracts that are already full.

| Sub-rule | When | Count |
|----------|------|-------|
| `amount-match` | Amount matches exactly one concurrent contract's `monthly_payment` | 8 |
| `concurrent-capacity` | No amount match; assign to concurrent contract with most remaining capacity | 3 |

#### Rule 4: Unresolved

Payments that can't be matched are left with `contract_id = NULL` for manual review. **0 payments** were unresolved in the current dataset.

### Why capacity-aware matters

The naive date-range algorithm produced **5 overpaid contracts**, 3 of which were algorithm errors:

| Account | Error | Root cause | Fix |
|---------|-------|-----------|-----|
| 12081101 | A2 over $300, A1 under $300 | Concurrent contracts: A2 (fee=$700) received 10×$100 payments but only had room for 6 after retainer. 3 payments should have gone to A1. | `capacity-spill-back` stops filling A2 once full |
| 07022201 | A1 over $300, A4 under $300 | Sequential contracts: A1 (fee=$2000) received payments past its fee that belonged to the next period | `capacity-spill-fwd` moves excess to A4 |
| 15030101 | A5 over $512, AB4 under $512 | $512 payment on A5's `date_opened` was actually the final payoff for AB4 (remaining capacity = exactly $512) | `boundary-payoff` assigns to prior contract |

### Remaining overpaid (genuine, not algorithm errors)

| Contract | Overage | Explanation |
|----------|---------|-------------|
| 20030701 A2 | $200 | Last payment was $300 (vs usual $200 monthly) — a lump sum that pushed past the fee. Split-payment scenario. |
| 24103001 AB1 | $25 | $125 partial payment slightly overshot remaining capacity. |

Neither has an exact-offset underpaid counterpart, confirming these are real-world payment irregularities.

## Usage

```bash
# Dry run — generates CSV reports + SQL, no DB changes
python3 migration/associate_payments.py

# Apply to local DB
python3 migration/associate_payments.py --apply
```

## Output files

| File | Content |
|------|---------|
| `output/associate_payments_report.csv` | Per-payment: id, account, date, amount, proposed contract, rule, reason, contract fee/total/balance |
| `output/associate_payments_contract_summary.csv` | Per-contract: contract number, account, fee, total linked, balance, payment count, status |
| `output/associate_payments.sql` | UPDATE statements in a BEGIN/COMMIT transaction |

## Verification workflow

1. Run dry: review both CSVs
2. Check for overpaid contracts in the summary CSV (balance < 0)
3. Confirm no exact-offset pairs (which indicate mis-links)
4. Spot-check specific accounts in the payment report CSV
5. Apply to local, verify in CRM UI
6. Apply SQL to prod
