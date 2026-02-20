import { datatype, name, phone, random } from "faker/locale/en_US";

import { defaultAccountCategories } from "../../../root/defaultConfiguration";
import type { Account } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

export const generateAccounts = (db: Db, size = 20): Account[] => {
  return Array.from(Array(size).keys()).map((id) => {
    const year = 2020 + datatype.number({ min: 0, max: 5 });
    const seq = String(id + 1).padStart(3, "0");
    const created_at = randomDate(
      new Date(`${year}-01-01`),
      new Date(),
    ).toISOString();
    const attorney = random.arrayElement(db.users);

    return {
      id,
      account_number: `${year}-${seq}`,
      name: `${name.lastName()}, ${name.firstName()}`,
      phone: phone.phoneNumber(),
      attorney_id: attorney.id,
      law_clerk_id: null,
      legal_assistant_id: null,
      date_opened: created_at,
      categories: random.arrayElement(defaultAccountCategories),
      referred_by: random.arrayElement([
        "Walk-in",
        "Referral",
        "Website",
        "Community Outreach",
        undefined,
        undefined,
      ]),
      archived: false,
      created_at,
      updated_at: created_at,
      user_id: attorney.id,
      nb_contacts: 0,
      nb_contracts: 0,
      nb_open_tasks: 0,
    };
  });
};
