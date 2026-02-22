import { useState } from "react";
import { formatRelative } from "date-fns";
import {
  ShowBase,
  useShowContext,
  useRecordContext,
  useGetOne,
  useGetList,
  useGetIdentity,
  useUpdate,
} from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";

import { AsideSection } from "../misc/AsideSection";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { activityTypeColors, accountCategoryColors, contractStatusColors } from "../misc/statusColors";
import { AddPayment } from "../payments/AddPayment";
import { AddTask } from "../tasks/AddTask";
import { Task } from "../tasks/Task";
import { AddActivity } from "../accounts/AddActivity";
import { AccountPaymentEditSheet } from "../payments/AccountPaymentEditSheet";
import { PaymentRow } from "../payments/PaymentRow";
import type {
  Account,
  AccountActivity,
  AccountContract,
  AccountPayment,
  Sale,
  Task as TaskType,
} from "../types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


export const ContractShow = () => {
  return (
    <ShowBase>
      <ContractShowContent />
    </ShowBase>
  );
};

const ContractShowContent = () => {
  const { record, isPending } = useShowContext<AccountContract>();

  const { data: payments } = useGetList<AccountPayment>(
    "account_payments",
    {
      filter: { contract_id: record?.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: !!record?.id },
  );

  if (isPending || !record) return null;

  const fee = Number(record.fee ?? 0);
  const totalReceived = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const balance = fee - totalReceived;
  const paymentCount = payments?.length ?? 0;

  return (
    <div className="mt-2 mb-2 flex gap-8 pb-20 md:pb-0">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h5 className="text-xl font-semibold">
                  {record.contract_number || `Contract #${record.id}`}
                </h5>
                {record.status && (
                  <Badge
                    variant="outline"
                    className={`text-xs py-0 px-1.5 ${contractStatusColors[record.status] ?? ""}`}
                  >
                    {record.status}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {record.case_type && <span>{record.case_type}</span>}
                {record.date_opened && (
                  <span>
                    {record.case_type && " \u00b7 "}
                    Opened {record.date_opened}
                  </span>
                )}
              </div>
            </div>

            {fee > 0 && (
              <div className="flex flex-wrap gap-x-6 mb-6 text-sm border-t border-b py-3">
                <div>
                  <span className="text-muted-foreground">Contracted: </span>
                  <span className="font-medium">${fmt(fee)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Received: </span>
                  <span className="font-medium">${fmt(totalReceived)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Balance: </span>
                  <span className={`font-medium ${balance > 0 ? "text-destructive" : "text-green-600"}`}>
                    ${fmt(balance)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Payments: </span>
                  <span className="font-medium">
                    {record.num_payments
                      ? `${paymentCount} of ${record.num_payments}`
                      : paymentCount}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <h6 className="text-lg font-semibold">Terms</h6>
                <Field label="Fee" value={record.fee != null ? `$${Number(record.fee).toLocaleString()}` : undefined} />
                <Field label="Retainer" value={record.retainer != null ? `$${Number(record.retainer).toLocaleString()}` : undefined} />
                <Field label="Monthly Payment" value={record.monthly_payment != null ? `$${Number(record.monthly_payment).toLocaleString()}` : undefined} />
                <Field label="# Payments" value={record.num_payments?.toString()} />
              </div>
              <div className="flex flex-col gap-3">
                <h6 className="text-lg font-semibold">Dates & Details</h6>
                <Field label="Date Opened" value={record.date_opened} />
                <Field label="Date Retainer" value={record.date_retainer} />
                <Field label="Date First Payment" value={record.date_first_payment} />
                <Field label="Work Description" value={record.work_description} />
              </div>
            </div>
          </CardContent>
        </Card>
        <ContractLinkedItems record={record} payments={payments} />
      </div>
      <ContractAside />
    </div>
  );
};

const ContractLinkedItems = ({
  record,
  payments,
}: {
  record: AccountContract;
  payments?: AccountPayment[];
}) => {
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);

  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const isAdmin = !!currentUser?.administrator;

  const { data: tasks } = useGetList<TaskType>("tasks", {
    filter: {
      parent_type: "account_contract",
      parent_id: record.id,
    },
    sort: { field: "due_date", order: "ASC" },
    pagination: { page: 1, perPage: 50 },
  });

  const { data: activities } = useGetList<AccountActivity>(
    "account_activities",
    {
      filter: {
        parent_type: "account_contract",
        parent_id: record.id,
      },
      sort: { field: "date", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
  );

  const now = Date.now();

  if (!tasks?.length && !activities?.length && !payments?.length) return null;

  return (
    <div className="mt-4 flex flex-col gap-4">
      {payments && payments.length > 0 && (
        <Card>
          <CardContent>
            <h6 className="text-lg font-semibold mb-2">Payments</h6>
            <div className="divide-y">
              {payments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  isAdmin={isAdmin}
                  onEdit={setEditingPaymentId}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tasks && tasks.length > 0 && (
        <Card>
          <CardContent>
            <h6 className="text-lg font-semibold mb-2">Tasks</h6>
            <div className="divide-y">
              {tasks.map((task) => (
                <div key={task.id} className="py-1">
                  <Task task={task} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activities && activities.length > 0 && (
        <Card>
          <CardContent>
            <h6 className="text-lg font-semibold mb-2">Activities</h6>
            <div className="divide-y">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 py-2"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{activity.subject}</span>
                      {activity.type && (
                        <Badge
                          variant="outline"
                          className={`text-xs py-0 px-1.5 ${activityTypeColors[activity.type] ?? ""}`}
                        >
                          {activity.type}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5 truncate">
                      {activity.date && formatRelative(activity.date, now)}
                      {activity.body && <span> &middot; {activity.body}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {editingPaymentId != null && (
        <AccountPaymentEditSheet
          open={editingPaymentId != null}
          onOpenChange={(open) => { if (!open) setEditingPaymentId(null); }}
          paymentId={editingPaymentId}
        />
      )}
    </div>
  );
};

const Field = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <span className="text-muted-foreground">{label}:</span>{" "}
    {value || "\u2014"}
  </div>
);

const ContractStatusSelect = () => {
  const record = useRecordContext<AccountContract>();
  const { contractStatuses } = useConfigurationContext();
  const [update] = useUpdate();

  if (!record) return null;

  const handleChange = (value: string) => {
    update("account_contracts", {
      id: record.id,
      data: { status: value },
      previousData: record,
    });
  };

  return (
    <AsideSection title="Status">
      <Select value={record.status || "To do"} onValueChange={handleChange}>
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {contractStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${(contractStatusColors[status] ?? "").split(" ")[0]}`}
                />
                {status}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </AsideSection>
  );
};

export const ContractAside = () => {
  const record = useRecordContext<AccountContract>();

  if (!record) return null;

  return (
    <div className="hidden sm:block w-64 min-w-64 text-sm">
      <div className="mb-4 -ml-1">
        <EditButton label="Edit Contract" />
      </div>

      <ContractStatusSelect />

      <AccountInfo accountId={record.account_id} />

      <div className="mt-6 pt-6 border-t flex flex-col gap-2">
        <AddTask
          account_id={record.account_id}
          parent_type="account_contract"
          parent_id={record.id}
        />
        <AddActivity
          account_id={record.account_id}
          parent_type="account_contract"
          parent_id={record.id}
        />
        <AddPayment
          account_id={record.account_id}
          contract_id={record.id}
        />
      </div>

      <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
        <DeleteButton
          className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
          size="sm"
        />
      </div>
    </div>
  );
};

const AccountInfo = ({ accountId }: { accountId: any }) => {
  const { data: account, isPending } = useGetOne<Account>("accounts", {
    id: accountId,
  }, { enabled: !!accountId });

  if (isPending || !account) return null;

  return (
    <AsideSection title="Account">
      <div className="flex flex-col gap-1">
        <Link
          to={`/accounts/${account.id}/show`}
          className="text-primary hover:underline font-medium"
        >
          {account.name}
        </Link>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground">{account.account_number}</span>
          {account.categories && (
            <Badge
              variant="outline"
              className={`text-xs py-0 px-1.5 ${accountCategoryColors[account.categories] ?? ""}`}
            >
              {account.categories}
            </Badge>
          )}
        </div>
      </div>
    </AsideSection>
  );
};
