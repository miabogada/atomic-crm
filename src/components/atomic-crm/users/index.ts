import type { Sale } from "../types";
import { UsersCreate } from "./UsersCreate";
import { UsersEdit } from "./UsersEdit";
import { UsersList } from "./UsersList";

export default {
  list: UsersList,
  create: UsersCreate,
  edit: UsersEdit,
  recordRepresentation: (record: Sale) =>
    `${record.first_name} ${record.last_name}`,
};
