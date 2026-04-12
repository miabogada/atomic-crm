import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AccountHistoryRow,
  ContractSummaryItem,
  InvoiceData,
  PaymentDueItem,
  PaymentReceivedItem,
} from "./types";

/**
 * Build a payment label from the payment_number field.
 * 0 = "Retainer", N = "Payment N", special last = "Final Payment"
 */
function paymentLabel(
  paymentNumber: number,
  isFinal: boolean,
): string {
  if (paymentNumber === 0) return "Retainer";
  if (isFinal) return "Final Payment";
  return `Payment ${paymentNumber}`;
}


/**
 * Interleave payments due and received into chronological rows,
 * matching the legacy invoice layout where each date gets its own row
 * and due/received entries on the same date appear on separate rows.
 */
function buildAccountHistory(
  dues: PaymentDueItem[],
  receiveds: PaymentReceivedItem[],
): AccountHistoryRow[] {
  // Collect all entries with a sort key
  const entries: {
    date: string;
    side: "due" | "received";
    due?: PaymentDueItem;
    received?: PaymentReceivedItem;
  }[] = [];

  for (const d of dues) {
    entries.push({ date: d.date, side: "due", due: d });
  }
  for (const r of receiveds) {
    entries.push({ date: r.date, side: "received", received: r });
  }

  // Sort chronologically, with "due" before "received" on the same date
  entries.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    // "due" sorts before "received"
    if (a.side === "due" && b.side === "received") return -1;
    if (a.side === "received" && b.side === "due") return 1;
    return 0;
  });

  return entries.map((e) => ({
    date: e.date,
    due: e.due,
    received: e.received,
  }));
}

export async function fetchInvoiceData(
  supabase: SupabaseClient,
  accountId: number,
): Promise<InvoiceData> {
  // 1. Fetch account summary (includes billing contact + balance)
  const { data: account, error: accountErr } = await supabase
    .from("accounts_summary")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accountErr || !account) {
    throw new Error(
      `Failed to fetch account ${accountId}: ${accountErr?.message}`,
    );
  }

  // 2. Fetch contracts
  const { data: contracts, error: contractsErr } = await supabase
    .from("account_contracts")
    .select("*")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("date_opened", { ascending: true });

  if (contractsErr) {
    throw new Error(`Failed to fetch contracts: ${contractsErr.message}`);
  }

  // 3. Fetch payment schedule (via view for computed fields)
  const { data: schedule, error: scheduleErr } = await supabase
    .from("contract_payment_schedule_view")
    .select("*")
    .eq("account_id", accountId)
    .order("due_date", { ascending: true })
    .order("payment_number", { ascending: true });

  if (scheduleErr) {
    throw new Error(`Failed to fetch schedule: ${scheduleErr.message}`);
  }

  // 4. Fetch payments received
  const { data: payments, error: paymentsErr } = await supabase
    .from("account_payments")
    .select("*")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("date_received", { ascending: true });

  if (paymentsErr) {
    throw new Error(`Failed to fetch payments: ${paymentsErr.message}`);
  }

  // --- Build contract summary ---
  const contractSummary: ContractSummaryItem[] = (contracts ?? []).map(
    (c: Record<string, unknown>) => ({
      date: (c.date_opened as string) ?? "",
      contractNumber: `${(c.contract_number as string) ?? ""}`,
      description: (c.case_type as string) ?? "",
      fee: (c.fee as number) ?? 0,
    }),
  );

  // --- Build payments due list ---
  // Group schedule by contract_id to find the last payment in each contract
  const maxPaymentByContract = new Map<number, number>();
  for (const s of schedule ?? []) {
    const cid = s.contract_id as number;
    const pn = s.payment_number as number;
    const cur = maxPaymentByContract.get(cid) ?? 0;
    if (pn > cur) maxPaymentByContract.set(cid, pn);
  }

  const paymentsDue: PaymentDueItem[] = (schedule ?? []).map(
    (s: Record<string, unknown>) => {
      const contractId = s.contract_id as number;
      const paymentNumber = s.payment_number as number;
      const maxPayment = maxPaymentByContract.get(contractId) ?? 0;
      const isFinal = paymentNumber > 0 && paymentNumber === maxPayment;

      return {
        date: (s.due_date as string) ?? "",
        scheduleId: (s.contract_number as string) ?? "",
        label: paymentLabel(paymentNumber, isFinal),
        amount: (s.amount as number) ?? 0,
      };
    },
  );

  // --- Build payments received list ---
  const paymentsReceived: PaymentReceivedItem[] = (payments ?? [])
    .filter((p: Record<string, unknown>) => p.type === "payment")
    .map((p: Record<string, unknown>) => ({
      date: (p.date_received as string) ?? "",
      amount: (p.amount as number) ?? 0,
      method: ((p.payment_method as string) ?? "").toUpperCase(),
      referenceNumber: (p.reference_number as string) ?? "",
    }));

  // --- Compute amount due: overdue + current ---
  const today = new Date().toISOString().split("T")[0];
  let amountDue = 0;
  let dueDate = "";
  const accountBalance: number = account.balance_due ?? 0;

  for (const s of schedule ?? []) {
    const balanceRemaining = (s.balance_remaining as number) ?? 0;
    if (balanceRemaining <= 0) continue;

    const scheduleDueDate = (s.due_date as string) ?? "";
    // Include overdue (past due) and the current/next upcoming
    if (scheduleDueDate <= today) {
      // Overdue or due today
      amountDue += balanceRemaining;
      if (!dueDate || scheduleDueDate > dueDate) {
        dueDate = scheduleDueDate;
      }
    } else {
      // First upcoming — include it and stop
      amountDue += balanceRemaining;
      dueDate = scheduleDueDate;
      break;
    }
  }

  // --- Build interleaved history ---
  // Include adjustment entries (write-offs, discounts, refunds) as special received items
  const adjustments: PaymentReceivedItem[] = (payments ?? [])
    .filter((p: Record<string, unknown>) => p.type !== "payment")
    .map((p: Record<string, unknown>) => ({
      date: (p.date_received as string) ?? "",
      amount:
        (p.type as string) === "refund"
          ? (p.amount as number) ?? 0
          : -((p.amount as number) ?? 0),
      method: ((p.type as string) ?? "").replace("_", " ").toUpperCase(),
      referenceNumber: (p.reference_number as string) ?? "",
    }));

  const allReceived = [...paymentsReceived, ...adjustments].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const history = buildAccountHistory(paymentsDue, allReceived);

  // --- Client address ---
  const clientCityParts = [
    account.billing_city,
    account.billing_state,
  ].filter(Boolean);
  const cityState = clientCityParts.join(", ");
  const clientCityStateZip = [cityState, account.billing_postal_code]
    .filter(Boolean)
    .join(" ");

  return {
    accountNumber: account.account_number ?? "",
    amountDue,
    dueDate: dueDate || today,
    clientName: account.name ?? "",
    clientStreet: account.billing_street ?? "",
    clientCityStateZip: clientCityStateZip || "",
    contracts: contractSummary,
    history,
    accountBalance,
  };
}

/**
 * Fetch invoice data for all accounts with a positive balance.
 * Returns an array of { accountId, data } objects.
 */
export async function fetchAllInvoiceData(
  supabase: SupabaseClient,
): Promise<{ accountId: number; data: InvoiceData }[]> {
  // Get all accounts with balance > 0
  const { data: accounts, error } = await supabase
    .from("accounts_summary")
    .select("id")
    .gt("balance_due", 0)
    .is("deleted_at", null)
    .order("account_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch accounts: ${error.message}`);
  }

  const results: { accountId: number; data: InvoiceData }[] = [];
  for (const account of accounts ?? []) {
    const data = await fetchInvoiceData(supabase, account.id);
    results.push({ accountId: account.id, data });
  }

  return results;
}
