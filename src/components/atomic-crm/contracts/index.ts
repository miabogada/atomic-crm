import type { AccountContract } from "../types";
import { ContractCreate } from "./ContractCreate";
import { ContractEdit } from "./ContractEdit";
import { ContractList } from "./ContractList";
import { ContractShow } from "./ContractShow";

export default {
  list: ContractList,
  show: ContractShow,
  edit: ContractEdit,
  create: ContractCreate,
  recordRepresentation: (record: AccountContract) =>
    record?.contract_number || `Contract #${record?.id}`,
};
