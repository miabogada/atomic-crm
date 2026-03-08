import { useGetList, useRecordContext } from "ra-core";
import type { AccountContact, AccountContract, Task as TaskType } from "../types";

/**
 * Warning content for the delete confirmation dialog.
 * Each component queries for child items and lists what will be cascade-deleted.
 */

export const AccountDeleteWarning = () => {
  const record = useRecordContext();
  const accountId = record?.id;

  const { total: contacts } = useGetList("account_contacts", {
    filter: { account_id: accountId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!accountId });

  const { total: contracts } = useGetList("account_contracts", {
    filter: { account_id: accountId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!accountId });

  const { total: payments } = useGetList("account_payments", {
    filter: { account_id: accountId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!accountId });

  const { total: tasks } = useGetList("tasks", {
    filter: { account_id: accountId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!accountId });

  const { total: activities } = useGetList("account_activities", {
    filter: { account_id: accountId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!accountId });

  const items = [
    contacts ? `${contacts} contact${contacts !== 1 ? "s" : ""}` : null,
    contracts ? `${contracts} contract${contracts !== 1 ? "s" : ""}` : null,
    payments ? `${payments} payment${payments !== 1 ? "s" : ""}` : null,
    tasks ? `${tasks} task${tasks !== 1 ? "s" : ""}` : null,
    activities ? `${activities} activit${activities !== 1 ? "ies" : "y"}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>Are you sure you want to delete this account?</p>
      {items.length > 0 && (
        <>
          <p className="font-medium">The following linked items will also be deleted:</p>
          <ul className="list-disc ml-5">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      <p className="text-muted-foreground">This action can be reversed by a database administrator.</p>
    </div>
  );
};

export const ContractDeleteWarning = () => {
  const record = useRecordContext<AccountContract>();
  const contractId = record?.id;

  const { total: payments } = useGetList("account_payments", {
    filter: { contract_id: contractId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!contractId });

  const { total: tasks } = useGetList("tasks", {
    filter: { parent_type: "account_contract", parent_id: contractId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!contractId });

  const { total: activities } = useGetList("account_activities", {
    filter: { parent_type: "account_contract", parent_id: contractId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!contractId });

  const items = [
    payments ? `${payments} payment${payments !== 1 ? "s" : ""}` : null,
    tasks ? `${tasks} task${tasks !== 1 ? "s" : ""}` : null,
    activities ? `${activities} activit${activities !== 1 ? "ies" : "y"}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>Are you sure you want to delete this contract?</p>
      {items.length > 0 && (
        <>
          <p className="font-medium">The following linked items will also be deleted:</p>
          <ul className="list-disc ml-5">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      <p className="text-muted-foreground">This action can be reversed by a database administrator.</p>
    </div>
  );
};

export const ContactDeleteWarning = () => {
  const record = useRecordContext<AccountContact>();

  return (
    <div className="flex flex-col gap-2 text-sm">
      {record?.is_billing_contact && (
        <p className="font-medium text-destructive">
          Warning: this is the billing contact for the account. Deleting it will
          remove the billing address from the account summary.
        </p>
      )}
      <p>Are you sure you want to delete this contact?</p>
      <p className="text-muted-foreground">This action can be reversed by a database administrator.</p>
    </div>
  );
};

export const TaskDeleteWarning = () => {
  const record = useRecordContext<TaskType>();
  const taskId = record?.id;

  const { total: activities } = useGetList("account_activities", {
    filter: { parent_type: "tasks", parent_id: taskId },
    pagination: { page: 1, perPage: 1 },
  }, { enabled: !!taskId });

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>Are you sure you want to delete this task?</p>
      {activities ? (
        <>
          <p className="font-medium">The following linked items will also be deleted:</p>
          <ul className="list-disc ml-5">
            <li>{activities} activit{activities !== 1 ? "ies" : "y"}</li>
          </ul>
        </>
      ) : null}
      <p className="text-muted-foreground">This action can be reversed by a database administrator.</p>
    </div>
  );
};
