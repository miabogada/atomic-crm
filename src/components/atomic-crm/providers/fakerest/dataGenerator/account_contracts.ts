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

      contracts.push({
        id: id++,
        account_id: account.id,
        contract_number: `${account.account_number}${String.fromCharCode(65 + i)}`,
        case_type: random.arrayElement(defaultCaseTypes),
        status: random.arrayElement(defaultContractStatuses),
        fee: randomFloat(1500, 8000),
        retainer: randomFloat(500, 3000),
        monthly_payment: randomFloat(200, 800),
        num_payments: datatype.number({ min: 1, max: 12 }),
        date_opened: created_at,
        date_retainer: randomDate(new Date(created_at)).toISOString(),
        date_first_payment: randomDate(new Date(created_at)).toISOString(),
        work_description: lorem.sentence(),
        created_at,
        user_id: account.user_id,
      });
    }
  }

  return contracts;
};
