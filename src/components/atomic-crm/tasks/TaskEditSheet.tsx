import { DeleteButton } from "@/components/admin";
import { type Identifier } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { TaskDeleteWarning } from "../misc/DeleteWarnings";
import { TaskFormContent } from "./TaskFormContent";
import type { Task } from "../types";

const transformTask = (data: Task): Task => {
  if (data.status === "Done" && !data.done_date) {
    return { ...data, done_date: new Date().toISOString() };
  }
  if (data.status !== "Done" && data.done_date) {
    return { ...data, done_date: null };
  }
  return data;
};

export interface TaskEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: Identifier;
}

export const TaskEditSheet = ({
  open,
  onOpenChange,
  taskId,
}: TaskEditSheetProps) => {
  return (
    <EditSheet
      resource="tasks"
      id={taskId}
      transform={transformTask}
      title={<h1 className="text-xl font-semibold">Edit Task</h1>}
      redirect={false}
      open={open}
      onOpenChange={onOpenChange}
      deleteButton={
        <DeleteButton
          variant="destructive"
          className="flex-1"
          redirect={false}
          onClick={() => {
            onOpenChange(false);
          }}
          confirmContent={<TaskDeleteWarning />}
        />
      }
    >
      <TaskFormContent showParentPicker />
    </EditSheet>
  );
};
