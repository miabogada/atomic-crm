import type { DataProvider, Identifier } from "ra-core";

import {
  ACCOUNT_ACTIVITY_CREATED,
  COMPANY_CREATED,
  CONTRACT_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
  PAYMENT_RECEIVED,
  TASK_COMPLETED,
} from "../../consts";
import type {
  AccountActivity,
  AccountContract,
  AccountPayment,
  Activity,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Task,
} from "../../types";

// FIXME: Requires 5 large queries to get the latest activities.
// Replace with a server-side view or a custom API endpoint.
export async function getActivityLog(
  dataProvider: DataProvider,
  companyId?: Identifier,
  salesId?: Identifier,
  accountId?: Identifier,
) {
  // Account-scoped view: only fetch account activities, tasks, payments, and contracts for the account
  if (accountId) {
    const [newAccountActivities, completedTasks, paymentsReceived, newContracts] =
      await Promise.all([
        getNewAccountActivities(dataProvider, accountId),
        getAllAccountTasks(dataProvider, accountId),
        getPaymentsReceived(dataProvider, accountId),
        getNewContracts(dataProvider, accountId),
      ]);
    return (
      [...newAccountActivities, ...completedTasks, ...paymentsReceived, ...newContracts]
        .sort(
          (a, b) =>
            (a.date || new Date(0).toISOString()).localeCompare(
              b.date || new Date(0).toISOString(),
            ) * -1,
        )
        .slice(0, 250)
    );
  }

  const companyFilter = {} as any;
  if (companyId) {
    companyFilter.id = companyId;
  } else if (salesId) {
    companyFilter["user_id@in"] = `(${salesId})`;
  }

  const filter = {} as any;
  if (companyId) {
    filter.company_id = companyId;
  } else if (salesId) {
    filter["user_id@in"] = `(${salesId})`;
  }

  const [newCompanies, newContactsAndNotes, newDealsAndNotes, newAccountActivities, completedTasks, paymentsReceived, newContracts] =
    await Promise.all([
      getNewCompanies(dataProvider, companyFilter),
      getNewContactsAndNotes(dataProvider, filter),
      getNewDealsAndNotes(dataProvider, filter),
      // Only include account activities in the global dashboard view (not company-scoped views)
      !companyId && !salesId ? getNewAccountActivities(dataProvider) : Promise.resolve([]),
      !companyId && !salesId ? getCompletedTasks(dataProvider) : Promise.resolve([]),
      !companyId && !salesId ? getPaymentsReceived(dataProvider) : Promise.resolve([]),
      !companyId && !salesId ? getNewContracts(dataProvider) : Promise.resolve([]),
    ]);
  return (
    [...newCompanies, ...newContactsAndNotes, ...newDealsAndNotes, ...newAccountActivities, ...completedTasks, ...paymentsReceived, ...newContracts]
      // sort by date desc
      .sort(
        (a, b) =>
          (a.date || new Date(0).toISOString()).localeCompare(
            b.date || new Date(0).toISOString(),
          ) * -1,
      )
      // limit to 250 activities
      .slice(0, 250)
  );
}

const getNewCompanies = async (
  dataProvider: DataProvider,
  filter: any,
): Promise<Activity[]> => {
  const { data: companies } = await dataProvider.getList<Company>("companies", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "created_at", order: "DESC" },
  });
  return companies.map((company) => ({
    id: `company.${company.id}.created`,
    type: COMPANY_CREATED,
    company_id: company.id,
    company,
    user_id: company.user_id,
    date: company.created_at,
  }));
};

async function getNewContactsAndNotes(
  dataProvider: DataProvider,
  filter: any,
): Promise<Activity[]> {
  const { data: contacts } = await dataProvider.getList<Contact>("contacts", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "first_seen", order: "DESC" },
  });

  const recentContactNotesFilter = {} as any;
  if (filter.user_id) {
    recentContactNotesFilter.user_id = filter.user_id;
  }
  if (filter.company_id) {
    // No company_id field in contactNote, filtering by related contacts instead.
    // This filter is only valid if a company has less than 250 contact.
    const contactIds = contacts.map((contact) => contact.id).join(",");
    recentContactNotesFilter["contact_id@in"] = `(${contactIds})`;
  }

  const { data: contactNotes } = await dataProvider.getList<ContactNote>(
    "contact_notes",
    {
      filter: recentContactNotesFilter,
      pagination: { page: 1, perPage: 250 },
      sort: { field: "date", order: "DESC" },
    },
  );

  const newContacts = contacts.map((contact) => ({
    id: `contact.${contact.id}.created`,
    type: CONTACT_CREATED,
    company_id: contact.company_id,
    user_id: contact.user_id,
    contact,
    date: contact.first_seen,
  }));

  const newContactNotes = contactNotes.map((contactNote) => ({
    id: `contactNote.${contactNote.id}.created`,
    type: CONTACT_NOTE_CREATED,
    user_id: contactNote.user_id,
    contactNote,
    date: contactNote.date,
  }));

  return [...newContacts, ...newContactNotes];
}

async function getNewDealsAndNotes(
  dataProvider: DataProvider,
  filter: any,
): Promise<Activity[]> {
  const { data: deals } = await dataProvider.getList<Deal>("deals", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "created_at", order: "DESC" },
  });

  const recentDealNotesFilter = {} as any;
  if (filter.user_id) {
    recentDealNotesFilter.user_id = filter.user_id;
  }
  if (filter.company_id) {
    // No company_id field in dealNote, filtering by related deals instead.
    // This filter is only valid if a deal has less than 250 notes.
    const dealIds = deals.map((deal) => deal.id).join(",");
    recentDealNotesFilter["deal_id@in"] = `(${dealIds})`;
  }

  const { data: dealNotes } = await dataProvider.getList<DealNote>(
    "deal_notes",
    {
      filter: recentDealNotesFilter,
      pagination: { page: 1, perPage: 250 },
      sort: { field: "date", order: "DESC" },
    },
  );

  const newDeals = deals.map((deal) => ({
    id: `deal.${deal.id}.created`,
    type: DEAL_CREATED,
    company_id: deal.company_id,
    user_id: deal.user_id,
    deal,
    date: deal.created_at,
  }));

  const newDealNotes = dealNotes.map((dealNote) => ({
    id: `dealNote.${dealNote.id}.created`,
    type: DEAL_NOTE_CREATED,
    user_id: dealNote.user_id,
    dealNote,
    date: dealNote.date,
  }));

  return [...newDeals, ...newDealNotes];
}

async function getNewAccountActivities(
  dataProvider: DataProvider,
  accountId?: Identifier,
): Promise<Activity[]> {
  try {
    const filter = accountId ? { account_id: accountId } : {};
    const { data: accountActivities } = await dataProvider.getList<AccountActivity>(
      "account_activities",
      {
        filter,
        pagination: { page: 1, perPage: 250 },
        sort: { field: "date", order: "DESC" },
      },
    );
    return accountActivities.map((accountActivity) => ({
      id: `accountActivity.${accountActivity.id}.created`,
      type: ACCOUNT_ACTIVITY_CREATED,
      account_id: accountActivity.account_id,
      user_id: accountActivity.user_id,
      accountActivity,
      date: accountActivity.date || accountActivity.created_at,
    }));
  } catch {
    return [];
  }
}

async function getCompletedTasks(
  dataProvider: DataProvider,
  accountId?: Identifier,
): Promise<Activity[]> {
  try {
    const filter: any = { "done_date@not.is": null };
    if (accountId) filter.account_id = accountId;
    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter,
      pagination: { page: 1, perPage: 250 },
      sort: { field: "done_date", order: "DESC" },
    });
    return tasks
      .filter((task) => task.done_date)
      .map((task) => ({
        id: `task.${task.id}.completed`,
        type: TASK_COMPLETED,
        account_id: task.account_id,
        user_id: task.user_id,
        task,
        date: task.done_date as string,
      }));
  } catch {
    return [];
  }
}

async function getAllAccountTasks(
  dataProvider: DataProvider,
  accountId: Identifier,
): Promise<Activity[]> {
  try {
    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { account_id: accountId },
      pagination: { page: 1, perPage: 250 },
      sort: { field: "due_date", order: "DESC" },
    });
    return tasks.map((task) => ({
      id: `task.${task.id}.completed`,
      type: TASK_COMPLETED,
      account_id: task.account_id,
      user_id: task.user_id,
      task,
      date: task.done_date ?? task.due_date,
    }));
  } catch {
    return [];
  }
}

async function getPaymentsReceived(
  dataProvider: DataProvider,
  accountId?: Identifier,
): Promise<Activity[]> {
  try {
    const filter = accountId ? { account_id: accountId } : {};
    const { data: payments } = await dataProvider.getList<AccountPayment>(
      "account_payments",
      {
        filter,
        pagination: { page: 1, perPage: 250 },
        sort: { field: "date_received", order: "DESC" },
      },
    );
    return payments.map((payment) => ({
      id: `payment.${payment.id}.received`,
      type: PAYMENT_RECEIVED,
      account_id: payment.account_id,
      user_id: payment.user_id,
      payment,
      date: payment.date_received || payment.created_at,
    }));
  } catch {
    return [];
  }
}

async function getNewContracts(
  dataProvider: DataProvider,
  accountId?: Identifier,
): Promise<Activity[]> {
  try {
    const filter = accountId ? { account_id: accountId } : {};
    const { data: contracts } = await dataProvider.getList<AccountContract>(
      "account_contracts",
      {
        filter,
        pagination: { page: 1, perPage: 250 },
        sort: { field: "created_at", order: "DESC" },
      },
    );
    return contracts.map((contract) => ({
      id: `contract.${contract.id}.created`,
      type: CONTRACT_CREATED,
      account_id: contract.account_id,
      user_id: contract.user_id,
      contract,
      date: contract.date_opened || contract.created_at,
    }));
  } catch {
    return [];
  }
}
