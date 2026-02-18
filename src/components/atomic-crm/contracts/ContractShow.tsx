import { useState } from "react";
import { formatRelative } from "date-fns";
import {
  ShowBase,
  useShowContext,
  useRecordContext,
  useGetOne,
  useGetList,
} from "ra-core";
import { Link } from "react-router";
import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";

import { AsideSection } from "../misc/AsideSection";
import { AddTask } from "../tasks/AddTask";
import { Task } from "../tasks/Task";
import { AccountActivityCreateSheet } from "../accounts/AccountActivityCreateSheet";
import type {
  Account,
  AccountActivity,
  AccountContract,
  Task as TaskType,
} from "../types";

export const ContractShow = () => {
  return (
    <ShowBase>
      <ContractShowContent />
    </ShowBase>
  );
};

const ContractShowContent = () => {
  const { record, isPending } = useShowContext<AccountContract>();

  if (isPending || !record) return null;

  return (
    <div className="mt-2 mb-2 flex gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <h5 className="text-xl font-semibold">
                  {record.contract_number || `Contract #${record.id}`}
                </h5>
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
              {record.fee != null && (
                <Badge variant="outline" className="text-base">
                  Fee: ${Number(record.fee).toLocaleString()}
                </Badge>
              )}
            </div>

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
        <ContractLinkedItems record={record} />
      </div>
      <ContractAside />
    </div>
  );
};

const ContractLinkedItems = ({ record }: { record: AccountContract }) => {
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

  if (!tasks?.length && !activities?.length) return null;

  return (
    <div className="mt-4 flex flex-col gap-4">
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
                    <div className="font-medium">{activity.subject}</div>
                    {activity.body && (
                      <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {activity.body}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {activity.type && (
                      <Badge variant="outline">{activity.type}</Badge>
                    )}
                    {activity.date && (
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(activity.date, now)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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

export const ContractAside = () => {
  const record = useRecordContext<AccountContract>();
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);

  if (!record) return null;

  return (
    <div className="hidden sm:block w-64 min-w-64 text-sm">
      <div className="mb-4 -ml-1">
        <EditButton label="Edit Contract" />
      </div>

      <AccountInfo accountId={record.account_id} />

      <div className="mt-6 pt-6 border-t flex flex-col gap-2">
        <AddTask
          account_id={record.account_id}
          parent_type="account_contract"
          parent_id={record.id}
        />
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          onClick={() => setActivitySheetOpen(true)}
        >
          <Activity className="w-4 h-4 mr-1" />
          Add Activity
        </Button>
        <AccountActivityCreateSheet
          open={activitySheetOpen}
          onOpenChange={setActivitySheetOpen}
          accountId={record.account_id}
          parentType="account_contract"
          parentId={record.id}
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
        <div className="text-muted-foreground">#{account.account_number}</div>
        {account.categories && (
          <div>
            <span className="text-muted-foreground">Status:</span>{" "}
            {account.categories}
          </div>
        )}
      </div>
    </AsideSection>
  );
};
