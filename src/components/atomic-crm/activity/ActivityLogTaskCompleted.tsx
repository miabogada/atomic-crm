import { CheckSquare, Square } from "lucide-react";
import { useState } from "react";

import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { RelativeDate } from "../misc/RelativeDate";
import { UserName } from "../users/UserName";
import { TaskView } from "../tasks/TaskView";
import { TaskEdit } from "../tasks/TaskEdit";
import { TaskEditSheet } from "../tasks/TaskEditSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ActivityTaskCompleted, Task } from "../types";

type Props = {
  activity: ActivityTaskCompleted;
};

export function ActivityLogTaskCompleted({ activity }: Props) {
  const { task } = activity;
  const isCompleted = !!task.done_date;
  const Icon = isCompleted ? CheckSquare : Square;
  const isMobile = useIsMobile();

  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  return (
    <div className="p-0">
      <div className="flex flex-col space-y-2 w-full">
        <div className="flex items-start gap-2 w-full">
          <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-muted-foreground text-sm flex-grow">
            <ReferenceField source="user_id" reference="users" record={activity}>
              <UserName />
            </ReferenceField>{" "}
            {isCompleted ? "completed" : "has open"} task{" "}
            <span
              className="text-foreground hover:underline cursor-pointer"
              onClick={() => setOpenView(true)}
            >
              {task.text}
            </span>
            {task.account_id && (
              <>
                {" "}on{" "}
                <ReferenceField
                  source="account_id"
                  reference="accounts"
                  record={task}
                  link="show"
                >
                  <TextField source="name" />
                </ReferenceField>
              </>
            )}{" "}
            <RelativeDate date={activity.date} />
          </span>
        </div>
      </div>

      <TaskView
        task={task as Task}
        open={openView}
        close={() => setOpenView(false)}
        onEdit={() => setOpenEdit(true)}
      />

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      ) : (
        <TaskEdit
          taskId={task.id}
          open={openEdit}
          close={() => setOpenEdit(false)}
        />
      )}
    </div>
  );
}
