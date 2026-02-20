import { generateAccountActivities } from "./account_activities";
import { generateAccountContacts } from "./account_contacts";
import { generateAccountContracts } from "./account_contracts";
import { generateAccounts } from "./accounts";
import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContactTypes } from "./contact_types";
import { generateContacts } from "./contacts";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { finalize } from "./finalize";
import { generateSales } from "./users";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;
  db.users = generateSales(db);
  db.tags = generateTags(db);
  db.companies = generateCompanies(db);
  db.contacts = generateContacts(db);
  db.contact_notes = generateContactNotes(db);
  db.deals = generateDeals(db);
  db.deal_notes = generateDealNotes(db);
  // Clark Law resources (depend on db.users)
  db.contact_types = generateContactTypes(db);
  db.accounts = generateAccounts(db);
  db.account_contacts = generateAccountContacts(db);
  db.account_contracts = generateAccountContracts(db);
  db.account_activities = generateAccountActivities(db);
  db.tasks = generateTasks(db);
  finalize(db);

  return db;
};
