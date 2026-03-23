export interface ContractSummaryItem {
  date: string; // YYYY-MM-DD
  contractNumber: string;
  description: string;
  fee: number;
}

export interface PaymentDueItem {
  date: string; // YYYY-MM-DD
  scheduleId: string; // e.g. "07022201A1"
  label: string; // "Retainer", "Payment 1", "Final Payment", etc.
  amount: number;
}

export interface PaymentReceivedItem {
  date: string; // YYYY-MM-DD
  amount: number;
  method: string; // "CASH", "CHECK", "MONEY ORDER", etc.
  referenceNumber: string;
}

/**
 * A single row in the Account History section.
 * Payments due and received are interleaved chronologically.
 * Each row has either a "due" entry, a "received" entry, or both
 * (when they share the same date).
 */
export interface AccountHistoryRow {
  date: string;
  due?: PaymentDueItem;
  received?: PaymentReceivedItem;
}

export interface InvoiceData {
  // Header
  accountNumber: string;
  amountDue: number;
  dueDate: string; // YYYY-MM-DD

  // Client address
  clientName: string;
  clientStreet: string;
  clientCityStateZip: string;

  // Contract summary table
  contracts: ContractSummaryItem[];

  // Account history (interleaved chronologically)
  history: AccountHistoryRow[];

  // Footer
  accountBalance: number;
}
