# PDF Invoice Generation Plan

## Context

The law office currently generates invoices from a legacy Access/OutlookForms system. As the CRM migration progresses, invoice generation needs to move into Atomic CRM. Invoices are printed monthly and mailed to clients — they serve as both a payment reminder (tear-off top section) and a full account history statement.

**Goal**: Replicate the existing invoice layout as a PDF using `@react-pdf/renderer`, with two delivery modes:
1. **CLI batch script** — generate all invoices at once (run monthly from workstation or server)
2. **CRM UI button** — attorney generates/prints a single invoice from the browser

## Invoice Layout (from legacy PDF)

### Page 1
```
┌─────────────────────────────────────────────────────────────────┐
│ Law Offices of Linnette Taño Clark          Account [########] │
│ 715 S. Victory Blvd., Burbank, CA 91502                        │
│ (213) 943-4550                     Please pay this amount:     │
│                                    Por favor envíe esta         │
│                                    cantidad:    [$AMOUNT]       │
│                                    before / antes de [DATE]     │
│                                    (payment instructions)       │
│                                                                 │
│   CLIENT NAME                                                   │
│   STREET ADDRESS                                                │
│   CITY, STATE ZIP                                               │
│                                                                 │
│ ┄┄┄ Please detach this section / Por favor separe ┄┄┄          │
├─────────────────────────────────────────────────────────────────┤
│ Contract Summary                                                │
│   Date    Contract Number    Description           │ Fee │      │
│   ...     ...                ...                   │ ... │      │
├─────────────────────────────────────────────────────────────────┤
│ Account History [########]                                      │
│              Payments Due              Payments Received        │
│   Date  ScheduleID  Label    Amt  |  Date  Amt  Method  Ref    │
│   ...   ...         ...      ...  |  ...   ...  ...     ...    │
│                                                                 │
│                          Account Balance:   $X,XXX.XX           │
└─────────────────────────────────────────────────────────────────┘
```

### Continuation Pages
- Header and contract summary appear on first page only
- Subsequent pages continue the Account History section
- Account Balance appears only on the final page, after the last history entry

### Amount Due Calculation
- Sum of all **overdue** schedule lines (past due_date, not fully paid) **plus** the **current** unpaid schedule line (next upcoming due_date)
- Due date = the current unpaid schedule line's due_date

## Technology

- **`@react-pdf/renderer`** — React components that render to PDF (works in both Node.js and browser)
- **No additional server required** — CLI uses `renderToFile()`, browser uses `<BlobProvider>`

## Data Sources

All data comes from existing Supabase tables/views:

| Invoice Field | Source |
|---|---|
| Account number | `accounts.account_number` |
| Client name | `accounts.name` |
| Client address | `account_contacts` where `is_billing_contact = true` |
| Amount due | Computed from `contract_payment_schedule_view` (overdue + current) |
| Due date | Next unpaid schedule line's `due_date` |
| Contract summary | `account_contracts` for the account |
| Payments due | `contract_payment_schedule` rows |
| Payments received | `account_payments` rows (type='payment') |
| Account balance | `accounts_summary.balance_due` |

## Implementation Plan

### Phase 1: PDF Component + CLI Script

#### Step 1: Install dependency
```bash
npm install @react-pdf/renderer
```

#### Step 2: Create invoice data types
**File**: `src/components/atomic-crm/invoices/types.ts`

Define TypeScript interfaces for the invoice data shape:
- `InvoiceData` — top-level: account info, amount due, due date, contracts, history, balance
- `ContractSummaryItem` — date, contract_number, description, fee
- `PaymentDueItem` — date, schedule_id, label (Retainer/Payment N/Final Payment), amount
- `PaymentReceivedItem` — date, amount, method, reference_number
- `AccountHistoryEntry` — union of due/received, sorted chronologically

#### Step 3: Build the PDF component
**File**: `src/components/atomic-crm/invoices/InvoiceDocument.tsx`

React component using `@react-pdf/renderer` primitives:
- `<Document>` → `<Page size="LETTER">`
- Firm header with bold italic font (Times-BoldItalic or similar serif)
- Account number in bordered box (top-right)
- Amount due and due date in bordered boxes
- Bilingual payment instructions
- Client address block
- Dashed detach line with bilingual text
- Contract Summary table with bordered Fee column
- Account History section with two-column layout (Payments Due | Payments Received)
- Interleaved chronological rows matching the legacy layout
- Account Balance at the bottom of the last page

Font notes: The legacy invoice uses a serif font (likely Times). `@react-pdf/renderer` includes Times-Roman, Times-Bold, Times-Italic, Times-BoldItalic built-in.

#### Step 4: Create the data-fetching query
**File**: `src/components/atomic-crm/invoices/fetchInvoiceData.ts`

Function that takes a Supabase client + account_id and returns `InvoiceData`:
1. Fetch account + billing contact from `accounts` + `account_contacts`
2. Fetch contracts from `account_contracts`
3. Fetch payment schedule from `contract_payment_schedule` (ordered by due_date)
4. Fetch payments from `account_payments` (ordered by date_received)
5. Compute amount due: sum of overdue + current schedule lines minus their allocations
6. Compute due date: next unpaid schedule line's due_date
7. Merge payments due + received into chronological account history
8. Get balance from `accounts_summary`

#### Step 5: CLI batch script
**File**: `scripts/generate-invoices.ts`

```
Usage: npx tsx scripts/generate-invoices.ts [--account <number>] [--output <dir>]
```

- Connects to Supabase using service role key (from env or `.env`)
- If `--account` specified, generate one invoice; otherwise generate all accounts with a balance > 0
- For each account: fetch data → render `<InvoiceDocument>` → write PDF to output dir
- Filename format: `invoice-{account_number}-{YYYY-MM}.pdf`
- Logs progress to stdout

### Phase 2: CRM UI Integration

#### Step 6: Invoice generation hook
**File**: `src/components/atomic-crm/invoices/useInvoiceGeneration.ts`

Custom hook that:
- Takes an account_id
- Fetches invoice data using the same `fetchInvoiceData` function
- Returns `{ data, loading, error }` for use by UI components

#### Step 7: Print/Download button on Account detail page
**File**: Modify the account detail view to add an "Invoice" button

- Button opens a dialog/drawer with `<BlobProvider document={<InvoiceDocument data={data} />}>`
- Two actions: "Download PDF" and "Print" (opens browser print dialog via `window.open` + `window.print()`)
- Loading state while PDF renders

#### Step 8: Batch generation UI (optional, future)
- Settings or dedicated page to trigger batch generation
- Select accounts, generate all, download as ZIP
- Lower priority — CLI covers this need initially

## File Structure

```
src/components/atomic-crm/invoices/
├── types.ts                  # Invoice data interfaces
├── InvoiceDocument.tsx        # @react-pdf/renderer component
├── InvoiceStyles.ts           # StyleSheet for the PDF
├── fetchInvoiceData.ts        # Supabase query + data assembly
├── useInvoiceGeneration.ts    # React hook for in-app use
└── InvoiceButton.tsx          # UI button + BlobProvider dialog

scripts/
└── generate-invoices.ts       # CLI batch generation script
```

## Verification

### CLI Script
1. Run `npx tsx scripts/generate-invoices.ts --account 07022201 --output ./tmp`
2. Open generated PDF and compare side-by-side with legacy invoice
3. Verify: header layout, boxed account/amount/date, address block, detach line, contract summary table, account history interleaving, balance at bottom

### CRM UI
1. Navigate to an account detail page
2. Click "Invoice" button
3. Verify PDF renders in browser and matches CLI output
4. Test "Print" action opens browser print dialog
5. Test "Download" saves PDF locally

### Edge Cases
- Account with no contracts (should show empty contract summary)
- Account with balance of $0 (amount due = $0, no due date)
- Account with many contracts/payments spanning multiple pages
- Account with payment adjustments (write-offs, discounts, refunds)
- Account with no billing contact address (flag or skip)
