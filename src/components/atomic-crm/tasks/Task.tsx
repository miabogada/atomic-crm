import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { useDeleteWithUndoController, useNotify, useUpdate } from "ra-core";
import { useEffect, useState } from "react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Account, Sale, Task as TData } from "../types";

import { taskStatusColors } from "./taskStatusColors";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { TaskView } from "./TaskView";
import { useIsMobile } from "@/hooks/use-mobile";
import { AddActivity } from "../accounts/AddActivity";

const localDatePlusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const Task = ({
  task,
}: {
  task: TData;
}) => {
  const isMobile = useIsMobile();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openAddActivity, setOpenAddActivity] = useState(false);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending, isSuccess, variables }] =
    useUpdate();
  const { handleDelete } = useDeleteWithUndoController({
    resource: "tasks",
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("Task deleted successfully", { undoable: true });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const handleCheck = () => () => {
    const isDone = !!task.done_date;
    update("tasks", {
      id: task.id,
      data: {
        done_date: isDone ? null : new Date().toISOString(),
        status: isDone ? "To do" : "Done",
      },
      previousData: task,
    });
  };

  useEffect(() => {
    // We do not want to invalidate the query when a tack is checked or unchecked
    if (
      isUpdatePending ||
      !isSuccess ||
      variables?.data?.done_date != undefined
    ) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Checkbox
            id={labelId}
            checked={!!task.done_date}
            onCheckedChange={handleCheck()}
            disabled={isUpdatePending}
            className="mt-1 shrink-0"
          />
          <div
            className={`flex-grow min-w-0 cursor-pointer ${task.done_date ? "line-through" : ""}`}
            onClick={() => setOpenView(true)}
          >
            <div className="text-sm flex items-center gap-1.5 min-w-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="truncate flex-1 min-w-0">
                      {task.type && task.type !== "None" && (
                        <>
                          <span className="font-semibold text-sm">{task.type}</span>
                          &nbsp;
                        </>
                      )}
                      {task.text}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm whitespace-normal break-words">
                    {task.type && task.type !== "None"
                      ? `${task.type}: ${task.text}`
                      : task.text}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {task.status && task.status !== "Done" && (
                <Badge
                  variant="outline"
                  className={`text-xs py-0 px-1.5 shrink-0 ${taskStatusColors[task.status] ?? ""}`}
                >
                  {task.status}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {task.done_date ? "done" : "due"}&nbsp;
              <DateField
                source={task.done_date ? "done_date" : "due_date"}
                record={task}
              />
              {task.account_id && (
                <ReferenceField<TData, Account>
                  source="account_id"
                  reference="accounts"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        (Re:&nbsp;
                        {referenceRecord?.name})
                      </>
                    );
                  }}
                />
              )}
              {task.user_id && (
                <ReferenceField<TData, Sale>
                  source="user_id"
                  reference="users"
                  record={task}
                  link={false}
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" \u00b7 "}
                        {referenceRecord.first_name} {referenceRecord.last_name}
                      </>
                    );
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 pr-0! size-8 cursor-pointer"
              aria-label="task actions"
            >
              <MoreVertical className="size-5 md:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: localDatePlusDays(1),
                  },
                  previousData: task,
                });
              }}
            >
              Postpone to tomorrow
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: localDatePlusDays(7),
                  },
                  previousData: task,
                });
              }}
            >
              Postpone to next week
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleEdit}
            >
              Edit
            </DropdownMenuItem>
            {task.account_id && (
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={() => setOpenAddActivity(true)}
              >
                Add Activity
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TaskView
        task={task}
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
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
      )}

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
