import type { Account } from "../types";
import { AccountCreate } from "./AccountCreate";
import { AccountEdit } from "./AccountEdit";
import { AccountList } from "./AccountList";
import { AccountShow } from "./AccountShow";

export default {
  list: AccountList,
  show: AccountShow,
  edit: AccountEdit,
  create: AccountCreate,
  recordRepresentation: (record: Account) =>
    `${record?.name} (${record?.account_number})`,
};
