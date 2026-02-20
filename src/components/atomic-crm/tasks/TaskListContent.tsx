import { RecordContextProvider, useListContext } from "ra-core";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { DateField } from "@/components/admin/date-field";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Task as TaskType, Sale } from "../types";

import { taskStatusColors } from "./taskStatusColors";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";

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
  const isMobile = useIsMobile();
  const [openEdit, setOpenEdit] = useState(false);
  const colorClass =
    taskStatusColors[task.status ?? "To do"] ?? taskStatusColors["To do"];

  return (
    <>
    <div
      className={`flex flex-row items-center px-4 py-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl cursor-pointer ${task.done_date ? "opacity-60" : ""}`}
      onClick={() => setOpenEdit(true)}
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
          {task.done_date ? "done" : "due"}{" "}
          <DateField
            source={task.done_date ? "done_date" : "due_date"}
            record={task}
          />
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
          {task.user_id && (
            <ReferenceField<TaskType, Sale>
              source="user_id"
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
    {isMobile ? (
      <TaskEditSheet taskId={task.id} open={openEdit} onOpenChange={setOpenEdit} />
    ) : (
      <TaskEdit taskId={task.id} open={openEdit} close={() => setOpenEdit(false)} />
    )}
    </>
  );
};
