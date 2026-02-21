import { useListContext } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";

import type { Task as TaskType } from "../types";
import { Task } from "./Task";

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
        <div
          key={task.id}
          className="px-4 py-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
        >
          <Task task={task} />
        </div>
      ))}

      {tasks.length === 0 && (
        <div className="p-4 text-muted-foreground">No tasks found</div>
      )}
    </div>
  );
};
