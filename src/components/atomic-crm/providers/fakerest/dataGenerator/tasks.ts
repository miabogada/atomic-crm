import { datatype, lorem, random } from "faker/locale/en_US";

import { defaultTaskTypes } from "../../../root/defaultConfiguration";
import type { Task } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

export const generateTasks = (db: Db) => {
  return Array.from(Array(60).keys()).map<Task>((id) => {
    const account = random.arrayElement(db.accounts);
    const accountContracts = db.account_contracts.filter(
      (c) => c.account_id === account.id,
    );
    const contract =
      accountContracts.length > 0
        ? random.arrayElement(accountContracts)
        : null;

    account.nb_open_tasks = (account.nb_open_tasks ?? 0) + 1;

    return {
      id,
      account_id: account.id,
      parent_type: contract ? "account_contract" : null,
      parent_id: contract ? contract.id : null,
      contact_id: null,
      type: random.arrayElement(defaultTaskTypes),
      text: lorem.sentence(),
      due_date: randomDate(
        new Date(),
        new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      ).toISOString(),
      done_date: undefined,
      status: "To do",
      user_id: account.user_id as number,
    };
  });
};
