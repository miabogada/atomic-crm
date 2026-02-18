import { useGetIdentity, useGetList, useGetOne } from "ra-core";

import type { Sale } from "../types";

export const TasksListEmpty = () => {
  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const isAdmin = !!currentUser?.administrator;

  const { total } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 1 },
      filter: isAdmin ? {} : { sales_id: identity?.id },
    },
    { enabled: !!identity },
  );

  if (total) return null;

  return (
    <p className="text-sm">Tasks added to your contacts will appear here.</p>
  );
};
