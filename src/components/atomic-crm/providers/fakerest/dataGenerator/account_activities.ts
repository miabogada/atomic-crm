import { datatype, lorem, random } from "faker/locale/en_US";

import { defaultActivityTypes } from "../../../root/defaultConfiguration";
import type { AccountActivity } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

export const generateAccountActivities = (db: Db): AccountActivity[] => {
  const activities: AccountActivity[] = [];
  let id = 0;

  for (const account of db.accounts) {
    const count = datatype.number({ min: 2, max: 4 });
    const accountContracts = db.account_contracts.filter(
      (c) => c.account_id === account.id,
    );

    for (let i = 0; i < count; i++) {
      const created_at = randomDate(new Date(account.created_at)).toISOString();
      const linkedContract =
        datatype.boolean() && accountContracts.length > 0
          ? random.arrayElement(accountContracts)
          : null;

      activities.push({
        id: id++,
        account_id: account.id,
        parent_type: linkedContract ? "account_contract" : undefined,
        parent_id: linkedContract ? linkedContract.id : undefined,
        type: random.arrayElement(defaultActivityTypes),
        subject: lorem.sentence(),
        body: datatype.boolean() ? lorem.paragraph() : undefined,
        date: created_at,
        created_at,
        user_id: account.user_id,
      });
    }
  }

  return activities;
};
