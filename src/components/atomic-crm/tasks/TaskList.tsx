import { useListContext } from "ra-core";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { Card } from "@/components/ui/card";

import { TopToolbar } from "../layout/TopToolbar";
import { AddTask } from "./AddTask";
import { TaskListContent } from "./TaskListContent";
import { TaskListFilter } from "./TaskListFilter";

export const TaskList = () => {
  return (
    <List
      title={false}
      actions={<TaskListActions />}
      perPage={25}
      sort={{ field: "due_date", order: "DESC" }}
    >
      <TaskListLayout />
    </List>
  );
};

const TaskListLayout = () => {
  const { data, isPending, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">No tasks yet</p>
        <AddTask selectContact selectAccount display="chip" />
      </div>
    );

  return (
    <div className="flex flex-row gap-8">
      <TaskListFilter />
      <div className="w-full flex flex-col gap-4">
        <Card className="py-0">
          <TaskListContent />
        </Card>
      </div>
    </div>
  );
};

const TaskListActions = () => (
  <TopToolbar>
    <SortButton fields={["due_date", "status", "type", "text"]} />
    <AddTask selectContact selectAccount display="chip" />
  </TopToolbar>
);
