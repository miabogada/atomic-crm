import { RecordContextProvider, useListContext } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { DateField } from "@/components/admin/date-field";

import type { Task as TaskType, Sale } from "../types";

const statusColors: Record<string, string> = {
  "To do": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "In Process":
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Done: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export const TaskListContent = () => {
  const { data: tasks, error, isPending } = useListContext<TaskType>();

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  if (error) {
    return null;
  }

  return (
    <div className="md:divide-y">
      {tasks.map((task) => (
        <RecordContextProvider key={task.id} value={task}>
          <TaskItemContent task={task} />
        </RecordContextProvider>
      ))}

      {tasks.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">No tasks found</div>
        </div>
      )}
    </div>
  );
};

const TaskItemContent = ({ task }: { task: TaskType }) => {
  const colorClass =
    statusColors[task.status ?? "To do"] ?? statusColors["To do"];

  return (
    <div
      className={`flex flex-row items-center px-4 py-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl ${task.done_date ? "opacity-60" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${task.done_date ? "line-through" : ""}`}>
          {task.type && task.type !== "None" && (
            <span className="text-muted-foreground font-normal">
              {task.type}:{" "}
            </span>
          )}
          {task.text}
        </div>
        <div className="text-sm text-muted-foreground">
          due <DateField source="due_date" record={task} />
          {task.account_id && (
            <ReferenceField
              source="account_id"
              reference="accounts"
              record={task}
              link={false}
              className="inline text-sm text-muted-foreground"
            >
              <span> · </span>
              <TextField source="name" />
            </ReferenceField>
          )}
          {task.contact_id && (
            <ReferenceField
              source="contact_id"
              reference="contacts"
              record={task}
              link={false}
              className="inline text-sm text-muted-foreground"
            >
              <span> · </span>
              <TextField source="first_name" />{" "}
              <TextField source="last_name" />
            </ReferenceField>
          )}
          {task.sales_id && (
            <ReferenceField<TaskType, Sale>
              source="sales_id"
              reference="users"
              record={task}
              link={false}
              className="inline text-sm text-muted-foreground"
              render={({ referenceRecord }) => {
                if (!referenceRecord) return null;
                return (
                  <>
                    {" · "}
                    {referenceRecord.first_name} {referenceRecord.last_name}
                  </>
                );
              }}
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={colorClass}>
          {task.status ?? "To do"}
        </Badge>
      </div>
    </div>
  );
};
