import { RecordRepresentation, ShowBase, useListContext, useRecordContext, useShowContext } from "ra-core";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ReferenceManyCount } from "@/components/admin/reference-many-count";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { AccountAside } from "./AccountAside";
import { AccountContactsList } from "./AccountContactsList";
import { AccountContractsList } from "./AccountContractsList";
import { AccountActivitiesList } from "./AccountActivitiesList";
import { Task } from "../tasks/Task";
import { AddTask } from "../tasks/AddTask";
import type { Account, Task as TaskType } from "../types";

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
                <h5 className="text-xl font-semibold">
                  <RecordRepresentation />
                </h5>
                <div className="text-sm text-muted-foreground">
                  #{record.account_number}
                  {record.billing_city && (
                    <>
                      {" \u00b7 "}
                      {[
                        record.billing_street,
                        record.billing_city,
                        record.billing_state,
                        record.billing_postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </>
                  )}
                </div>
              </div>
              {record.categories && (
                <Badge
                  variant={
                    record.categories === "In Process"
                      ? "default"
                      : "secondary"
                  }
                >
                  {record.categories}
                </Badge>
              )}
            </div>

            <Tabs defaultValue="contacts" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-10">
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
                  Activities
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
