import { ShowBase, useListContext, useRecordContext, useShowContext } from "ra-core";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ReferenceManyCount } from "@/components/admin/reference-many-count";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { AccountAside } from "./AccountAside";
import { AccountContactsList } from "./AccountContactsList";
import { AccountContractsList } from "./AccountContractsList";
import { AccountActivitiesList } from "./AccountActivitiesList";
import { AccountPaymentList } from "../payments/AccountPaymentList";
import { Task } from "../tasks/Task";
import { AddTask } from "../tasks/AddTask";
import type { Account, Task as TaskType } from "../types";
import { accountCategoryColors } from "../misc/statusColors";

export const AccountShow = () => {
  return (
    <ShowBase>
      <AccountShowContent />
    </ShowBase>
  );
};

const AccountShowContent = () => {
  const { record, isPending } = useShowContext<Account>();
  if (isPending || !record) return null;

  return (
    <div className="mt-2 mb-2 flex gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg">
                {record.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h5 className="text-xl font-semibold">{record.name}</h5>
                  <span className="text-xl font-semibold">{record.account_number}</span>
                  {record.categories && (
                    <Badge
                      variant="outline"
                      className={`text-xs py-0 px-1.5 ${accountCategoryColors[record.categories] ?? ""}`}
                    >
                      {record.categories}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {(record.total_contracted != null || record.total_received != null) && (
              <div className="flex gap-6 mb-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Contracted: </span>
                  <span className="font-medium">
                    ${Number(record.total_contracted ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Received: </span>
                  <span className="font-medium">
                    ${Number(record.total_received ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Balance: </span>
                  <span className={`font-medium ${Number(record.balance_due ?? 0) > 0 ? "text-destructive" : "text-green-600"}`}>
                    ${Number(record.balance_due ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            <Tabs defaultValue="contacts" className="w-full">
              <TabsList className="grid w-full grid-cols-5 h-10">
                <TabsTrigger value="contacts">
                  <ReferenceManyCount
                    target="account_id"
                    reference="account_contacts"
                  />{" "}
                  Contacts
                </TabsTrigger>
                <TabsTrigger value="contracts">
                  <ReferenceManyCount
                    target="account_id"
                    reference="account_contracts"
                  />{" "}
                  Contracts
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <ReferenceManyCount
                    target="account_id"
                    reference="tasks"
                    filter={{ "done_date@is": null }}
                  />{" "}
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="activities">
                  <ReferenceManyCount
                    target="account_id"
                    reference="account_activities"
                  />{" "}
                  Activities
                </TabsTrigger>
                <TabsTrigger value="payments">
                  <ReferenceManyCount
                    target="account_id"
                    reference="account_payments"
                  />{" "}
                  Payments
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contacts" className="mt-4">
                <ReferenceManyField
                  target="account_id"
                  reference="account_contacts"
                  sort={{ field: "created_at", order: "DESC" }}
                  empty={false}
                >
                  <AccountContactsList />
                </ReferenceManyField>
              </TabsContent>

              <TabsContent value="contracts" className="mt-4">
                <ReferenceManyField
                  target="account_id"
                  reference="account_contracts"
                  sort={{ field: "created_at", order: "DESC" }}
                  empty={false}
                >
                  <AccountContractsList />
                </ReferenceManyField>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <ReferenceManyField
                  target="account_id"
                  reference="tasks"
                  sort={{ field: "due_date", order: "ASC" }}
                  empty={false}
                >
                  <AccountTasksTab />
                </ReferenceManyField>
              </TabsContent>

              <TabsContent value="activities" className="mt-4">
                <ReferenceManyField
                  target="account_id"
                  reference="account_activities"
                  sort={{ field: "date", order: "DESC" }}
                  empty={false}
                >
                  <AccountActivitiesList />
                </ReferenceManyField>
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <ReferenceManyField
                  target="account_id"
                  reference="account_payments"
                  sort={{ field: "date_received", order: "DESC" }}
                  empty={false}
                >
                  <AccountPaymentList />
                </ReferenceManyField>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <AccountAside />
    </div>
  );
};

const AccountTasksTab = () => {
  const { data, isPending } = useListContext<TaskType>();
  const account = useRecordContext<Account>();

  if (isPending) return null;

  return (
    <div>
      {account && (
        <div className="flex justify-end mb-2">
          <AddTask account_id={account.id} />
        </div>
      )}

      {!data?.length ? (
        <div className="text-center text-muted-foreground py-8">
          No tasks yet
        </div>
      ) : (
        <div className="divide-y">
          {data.map((task) => (
            <div key={task.id} className="py-1">
              <Task task={task} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
