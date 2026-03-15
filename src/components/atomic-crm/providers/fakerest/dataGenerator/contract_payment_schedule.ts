import type { ContractPaymentSchedule } from "../../../types";
import type { Db } from "./types";

/** Add months to a date string (YYYY-MM-DD), preserving day of month. */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

/** Compute status at generation time for demo data. */
function computeStatus(
  dueDate: string,
  amountPaid: number,
  amountDue: number,
): ContractPaymentSchedule["status"] {
  if (amountPaid >= amountDue) return "paid";
  if (amountPaid > 0) return "partial";
  const today = new Date().toISOString().split("T")[0];
  if (dueDate < today) return "late";
  if (dueDate === today) return "due";
  return "upcoming";
}

export const generateContractPaymentSchedule = (
  db: Db,
): ContractPaymentSchedule[] => {
  const schedule: ContractPaymentSchedule[] = [];
  let id = 0;

  for (const contract of db.account_contracts) {
    const account = db.accounts.find((a) => a.id === contract.account_id);
    if (!account) continue;

    const retainer = Number(contract.retainer ?? 0);
    const monthly = Number(contract.monthly_payment ?? 0);
    const numPayments = Number(contract.num_payments ?? 0);
    const finalPayment =
      contract.final_payment != null
        ? Number(contract.final_payment)
        : monthly;

    // Normalise date strings to YYYY-MM-DD
    const dateRetainer = contract.date_retainer
      ? contract.date_retainer.slice(0, 10)
      : null;
    const dateFirstPayment = contract.date_first_payment
      ? contract.date_first_payment.slice(0, 10)
      : null;

    // Retainer row (payment_number = 0)
    if (retainer > 0 && dateRetainer) {
      schedule.push({
        id: id++,
        contract_id: contract.id,
        account_id: account.id,
        payment_number: 0,
        due_date: dateRetainer,
        amount: retainer,
        amount_paid: 0,
        balance_remaining: retainer,
        created_at: contract.created_at,
        contract_number: contract.contract_number,
        case_type: contract.case_type,
        account_name: account.name,
        account_number: account.account_number,
        status: computeStatus(dateRetainer, 0, retainer),
      });
    }

    // Installment rows (payment_number = 1..N)
    if (monthly > 0 && numPayments > 0 && dateFirstPayment) {
      for (let i = 1; i <= numPayments; i++) {
        const dueDate = addMonths(dateFirstPayment, i - 1);
        const amount = i === numPayments ? finalPayment : monthly;
        schedule.push({
          id: id++,
          contract_id: contract.id,
          account_id: account.id,
          payment_number: i,
          due_date: dueDate,
          amount,
          amount_paid: 0,
          balance_remaining: amount,
          created_at: contract.created_at,
          contract_number: contract.contract_number,
          case_type: contract.case_type,
          account_name: account.name,
          account_number: account.account_number,
          status: computeStatus(dueDate, 0, amount),
        });
      }
    }
  }

  return schedule;
};
