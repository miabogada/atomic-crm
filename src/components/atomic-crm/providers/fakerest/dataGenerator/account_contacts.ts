import { address, datatype, internet, name, phone, random } from "faker/locale/en_US";

import type { AccountContact } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

export const generateAccountContacts = (db: Db): AccountContact[] => {
  const contacts: AccountContact[] = [];
  let id = 0;

  for (const account of db.accounts) {
    const count = datatype.number({ min: 1, max: 4 });
    for (let i = 0; i < count; i++) {
      const first_name = name.firstName();
      const last_name = name.lastName();
      const isBilling = i === 0;

      if (isBilling) {
        account.billing_contact_name = `${first_name} ${last_name}`;
      }
      account.nb_contacts = (account.nb_contacts ?? 0) + 1;

      contacts.push({
        id: id++,
        account_id: account.id,
        contact_type_id: random.arrayElement(db.contact_types).id,
        is_billing_contact: isBilling,
        first_name,
        last_name,
        email: internet.email(first_name, last_name),
        phone: phone.phoneNumber(),
        address_street: address.streetAddress(),
        address_city: address.city(),
        address_state: address.stateAbbr(),
        address_postal_code: address.zipCode(),
        address_country: "USA",
        created_at: randomDate(new Date(account.created_at)).toISOString(),
        user_id: account.user_id,
      });
    }
  }

  return contacts;
};
