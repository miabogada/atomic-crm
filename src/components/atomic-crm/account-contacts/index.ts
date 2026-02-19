import type { AccountContact } from "../types";
import { ContactCreate } from "./ContactCreate";
import { ContactEdit } from "./ContactEdit";
import { ContactList } from "./ContactList";
import { ContactShow } from "./ContactShow";

export default {
  list: ContactList,
  show: ContactShow,
  edit: ContactEdit,
  create: ContactCreate,
  recordRepresentation: (record: AccountContact) =>
    record?.first_name
      ? `${record.first_name} ${record.last_name}`.trim()
      : `Contact #${record?.id}`,
};
