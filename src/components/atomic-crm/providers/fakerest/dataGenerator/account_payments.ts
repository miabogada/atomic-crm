import { datatype, random } from "faker/locale/en_US";

import { defaultPaymentMethods } from "../../../root/defaultConfiguration";
import type { AccountPayment } from "../../../types";
import type { Db } from "./types";
import { randomDate, randomFloat } from "./utils";

export const generateAccountPayments = (db: Db): AccountPayment[] => {
  const payments: AccountPayment[] = [];
  let id = 0;

  for (const contract of db.account_contracts) {
    const count = datatype.number({ min: 0, max: 4 });
    for (let i = 0; i < count; i++) {
      const amount = randomFloat(200, Number(contract.monthly_payment ?? 500));
      const date_received = randomDate(
        new Date(contract.created_at),
      )
        .toISOString()
        .slice(0, 10);
      const payment_method = random.arrayElement(defaultPaymentMethods);

      // Accumulate totals on the parent account for FakeRest queries
      const account = db.accounts.find((a) => a.id === contract.account_id);
      if (account) {
        account.total_received = (account.total_received ?? 0) + amount;
        account.balance_due =
          (account.total_contracted ?? 0) - account.total_received;
      }

      payments.push({
        id: id++,
        account_id: contract.account_id,
        contract_id: contract.id,
        date_received,
        amount,
        payment_method,
        reference_number:
          payment_method === "CHECK"
            ? String(datatype.number({ min: 1000, max: 9999 }))
            : payment_method === "CASH"
              ? String(datatype.number({ min: 100000, max: 999999 }))
              : String(datatype.number({ min: 10000000, max: 99999999 })),
        notes: undefined,
        user_id: contract.user_id ?? undefined,
        created_at: new Date(date_received).toISOString(),
        updated_at: new Date(date_received).toISOString(),
      });
    }
  }

  // Set total_contracted on accounts now that we have all contracts
  for (const account of db.accounts) {
    const contractFees = db.account_contracts
      .filter((c) => c.account_id === account.id)
      .reduce((sum, c) => sum + Number(c.fee ?? 0), 0);
    account.total_contracted = parseFloat(contractFees.toFixed(2));
    account.balance_due = parseFloat(
      (account.total_contracted - (account.total_received ?? 0)).toFixed(2),
    );
  }

  return payments;
};
