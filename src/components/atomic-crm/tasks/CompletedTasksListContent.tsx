import { completedTaskFilters } from "./taskFilters";
import { TasksListFilter } from "../dashboard/TasksListFilter";

export const CompletedTasksListContent = () => {
  return (
    <div className="flex flex-col gap-4">
      <TasksListFilter
        title="Last 30 days"
        filter={completedTaskFilters.recentlyCompleted}
        sortField="done_date"
        sortOrder="DESC"
        showCompleted
      />
    </div>
  );
};
