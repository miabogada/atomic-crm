---
name: PDF Invoice feature status
description: Invoice generation — CLI + CRM UI complete, allocation fix for adjustments, known issue with amount due vs unallocated discounts
type: project
---

PDF invoice generation is fully implemented (plan: `docs/plan-pdf-invoices.md`, all steps complete).

## Components
- **CLI script**: `scripts/generate-invoices.ts` — batch generate via `npx tsx`, connects to any Supabase instance via `--url`
- **Single invoice**: `InvoiceButton` in AccountAside (below Edit Account) — dialog with Download/Print
- **Batch page**: `/invoices` route (admin-only, User Menu > Invoices) — fetches all accounts with balance > 0, renders combined PDF via `InvoiceBatchDocument`, checkboxes for selection
- **PDF component**: `src/components/atomic-crm/invoices/InvoiceDocument.tsx` — `InvoiceDocument` (single) + `InvoiceBatchDocument` (multi, page breaks between accounts)

## Amount Due calculation
- Sums `balance_remaining` from overdue + current/next schedule lines (from `contract_payment_schedule_view`)
- **Critical**: this does NOT account for unallocated adjustments (discounts, write-offs). If a discount isn't allocated to schedule lines, amount due will be inflated. This is intentional — it surfaces allocation gaps.
- Fix: allocate adjustments to schedule lines via the contract Payment Schedule > Allocate dropdown (which now includes discount/write_off types, fixed 2026-04-11)

## Layout notes
- Billing address: 12pt, uppercase
- Detach line: centered text above a row of text hyphens (not CSS dashed border — printers don't render it)
- Fonts: Times-Roman family (built into @react-pdf/renderer)

**Why:** Replaces legacy Access/OutlookForms invoice generation. Monthly batch print workflow.

**How to apply:** When touching invoice rendering, payment allocation, or the schedule view, be aware of the amount due dependency on allocated adjustments.
