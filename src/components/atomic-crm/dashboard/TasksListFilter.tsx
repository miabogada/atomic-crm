import {
  type Identifier,
  ListContextProvider,
  ResourceContextProvider,
  useGetIdentity,
  useGetList,
  useGetOne,
  useList,
} from "ra-core";

import { TasksIterator } from "../tasks/TasksIterator";
import type { Sale } from "../types";
import { useIsMobile } from "@/hooks/use-mobile";

export const TasksListFilter = ({
  title,
  filter,
  filterByContact,
  sortField = "due_date",
  sortOrder = "ASC",
  showCompleted,
}: {
  title: string;
  filter: any;
  filterByContact?: Identifier;
  sortField?: string;
  sortOrder?: "ASC" | "DESC";
  showCompleted?: boolean;
}) => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const { data: currentUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const isAdmin = !!currentUser?.administrator;

  const {
    data: tasks,
    total,
    isPending,
  } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: sortField, order: sortOrder },
      filter: {
        ...filter,
        ...(filterByContact != null
          ? { contact_id: filterByContact }
          : isAdmin
            ? {}
            : { user_id: identity?.id }),
      },
    },
    { enabled: filterByContact != null ? true : !!identity },
  );

  const listContext = useList({
    data: tasks,
    isPending,
    resource: "tasks",
    perPage: isMobile ? 10 : 5,
  });

  if (isPending || !tasks || !total) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
        {title}
      </p>
      <ResourceContextProvider value="tasks">
        <ListContextProvider value={listContext}>
          <TasksIterator showContact={filterByContact == null} showCompleted={showCompleted} />
        </ListContextProvider>
      </ResourceContextProvider>
      {total > listContext.perPage && (
        <div className="flex justify-center">
          <a
            href="#"
            onClick={(e) => {
              listContext.setPerPage(listContext.perPage + 10);
              e.preventDefault();
            }}
            className="text-sm underline hover:no-underline"
          >
            Load more
          </a>
        </div>
      )}
    </div>
  );
};
