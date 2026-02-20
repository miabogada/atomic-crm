import type {
  Account,
  AccountActivity,
  AccountContact,
  AccountContract,
  AccountPayment,
  Company,
  Contact,
  ContactNote,
  ContactType,
  Deal,
  DealNote,
  Sale,
  Tag,
  Task,
} from "../../../types";

export interface Db {
  companies: Required<Company>[];
  contacts: Required<Contact>[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  users: Sale[];
  tags: Tag[];
  tasks: Task[];
  contact_types: ContactType[];
  accounts: Account[];
  account_contacts: AccountContact[];
  account_contracts: AccountContract[];
  account_payments: AccountPayment[];
  account_activities: AccountActivity[];
}
