import {
  useGetIdentity,
  useListContext,
} from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { Card } from "@/components/ui/card";

import { TopToolbar } from "../layout/TopToolbar";
import { AccountListContent } from "./AccountListContent";
import { AccountListFilter } from "./AccountListFilter";

export const AccountList = () => {
  const { identity } = useGetIdentity();

  if (!identity) return null;

  return (
    <List
      title={false}
      actions={<AccountListActions />}
      perPage={25}
      sort={{ field: "updated_at", order: "DESC" }}
      filter={{ "archived@neq": true }}
    >
      <AccountListLayout />
    </List>
  );
};

const AccountListLayout = () => {
  const { data, isPending, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">No accounts yet</p>
        <CreateButton />
      </div>
    );

  return (
    <div className="flex flex-row gap-8">
      <AccountListFilter />
      <div className="w-full flex flex-col gap-4">
        <Card className="py-0">
          <AccountListContent />
        </Card>
      </div>
    </div>
  );
};

const AccountListActions = () => (
  <TopToolbar>
    <SortButton fields={["name", "account_number", "updated_at", "date_opened"]} />
    <CreateButton />
  </TopToolbar>
);
