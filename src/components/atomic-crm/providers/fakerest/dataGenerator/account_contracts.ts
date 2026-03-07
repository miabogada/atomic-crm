import { datatype, lorem, random } from "faker/locale/en_US";

import {
  defaultCaseTypes,
  defaultContractStatuses,
} from "../../../root/defaultConfiguration";
import type { AccountContract } from "../../../types";
import type { Db } from "./types";
import { randomDate, randomFloat } from "./utils";

export const generateAccountContracts = (db: Db): AccountContract[] => {
  const contracts: AccountContract[] = [];
  let id = 0;

  for (const account of db.accounts) {
    const count = datatype.number({ min: 1, max: 2 });
    for (let i = 0; i < count; i++) {
      const created_at = randomDate(new Date(account.created_at)).toISOString();
      account.nb_contracts = (account.nb_contracts ?? 0) + 1;

      const fee = randomFloat(1500, 8000);
      const retainer = randomFloat(500, Math.min(3000, fee * 0.4));
      const monthly = randomFloat(200, 800);
      const numPayments = datatype.number({ min: 1, max: 12 });
      // Final payment absorbs the remainder (may differ from monthly)
      const remaining = fee - retainer;
      const finalPayment = parseFloat(
        (remaining - monthly * (numPayments - 1)).toFixed(2),
      );

      contracts.push({
        id: id++,
        account_id: account.id,
        contract_number: `${account.account_number}${String.fromCharCode(65 + i)}`,
        case_type: random.arrayElement(defaultCaseTypes),
        status: random.arrayElement(defaultContractStatuses),
        fee,
        retainer,
        monthly_payment: monthly,
        num_payments: numPayments,
        final_payment: Math.abs(finalPayment - monthly) < 0.01 ? 0 : (finalPayment > 0 ? finalPayment : 0),
        date_opened: created_at,
        date_retainer: randomDate(new Date(created_at)).toISOString().slice(0, 10),
        date_first_payment: randomDate(new Date(created_at)).toISOString().slice(0, 10),
        work_description: lorem.sentence(),
        created_at,
        user_id: account.user_id,
      });
    }
  }

  return contracts;
};
