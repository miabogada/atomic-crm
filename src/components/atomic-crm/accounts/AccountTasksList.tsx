import { useListContext } from "ra-core";
import { Badge } from "@/components/ui/badge";

import type { AccountTask } from "../types";

export const AccountTasksList = () => {
  const { data, isPending } = useListContext<AccountTask>();

  if (isPending) return null;

  if (!data?.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No tasks yet
      </div>
    );
  }

  return (
    <div className="divide-y">
      {data.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-4 py-3 px-2"
        >
          <div className="flex-1">
            <div
              className={`font-medium ${task.done_date ? "line-through text-muted-foreground" : ""}`}
            >
              {task.subject}
            </div>
            {task.body && (
              <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {task.body}
              </div>
            )}
            {task.parent_type && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Under: {task.parent_type} #{task.parent_id}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {task.due_date && (
              <span
                className={`text-sm ${
                  !task.done_date &&
                  new Date(task.due_date) < new Date()
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }`}
              >
                Due {task.due_date}
              </span>
            )}
            {task.done_date ? (
              <Badge variant="secondary">Done</Badge>
            ) : (
              <Badge variant="outline">Open</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
