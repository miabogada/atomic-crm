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
  const { data, isPending } = useListContext();

  if (isPending) return null;

  if (!data?.length)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">No accounts yet</p>
        <CreateButton />
      </div>
    );

  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="py-0">
        <AccountListContent />
      </Card>
    </div>
  );
};

const AccountListActions = () => (
  <TopToolbar>
    <SortButton fields={["name", "account_number", "updated_at", "date_opened"]} />
    <CreateButton />
  </TopToolbar>
);
