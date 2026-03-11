import { useState } from "react";
import { useGetOne, type Identifier } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Account, Sale, Task } from "../types";
import { taskStatusColors } from "./taskStatusColors";
import { AddActivity } from "../accounts/AddActivity";

export const TaskView = ({
  task,
  open,
  close,
  onEdit,
}: {
  task: Task;
  open: boolean;
  close: () => void;
  onEdit: () => void;
}) => {
  const [openAddActivity, setOpenAddActivity] = useState(false);
  const { data: account } = useGetOne<Account>(
    "accounts",
    { id: task.account_id! },
    { enabled: !!task.account_id },
  );
  const { data: assignee } = useGetOne<Sale>(
    "users",
    { id: task.user_id! },
    { enabled: !!task.user_id },
  );

  return (
  <>
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="lg:max-w-2xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{task.text}</span>
            {task.status && (
              <Badge
                variant="outline"
                className={`text-xs py-0 px-1.5 ${taskStatusColors[task.status] ?? ""}`}
              >
                {task.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {task.type && task.type !== "None" && (
              <Field label="Type" value={task.type} />
            )}
            <Field
              label={task.done_date ? "Done" : "Due"}
              value={formatDate(task.done_date || task.due_date)}
            />
            {task.done_date && task.due_date && (
              <Field label="Originally due" value={formatDate(task.due_date)} />
            )}
            {assignee && (
              <Field
                label="Assignee"
                value={`${assignee.first_name} ${assignee.last_name}`}
              />
            )}
            {account && (
              <Field label="Account" value={account.name} />
            )}
          </div>

          {task.notes && (
            <div className="border-t pt-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Notes
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3 max-h-96 overflow-y-auto">
                {task.notes}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div>
            {task.account_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  close();
                  setOpenAddActivity(true);
                }}
              >
                Add Activity
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>
              Close
            </Button>
            <Button
              onClick={() => {
                close();
                onEdit();
              }}
            >
              Edit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {task.account_id && (
      <AddActivity
        open={openAddActivity}
        onOpenChange={setOpenAddActivity}
        account_id={task.account_id}
        parent_type="tasks"
        parent_id={task.id}
      />
    )}
  </>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <span className="text-muted-foreground">{label}: </span>
    <span>{value}</span>
  </div>
);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
};
