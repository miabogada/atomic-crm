import { useListContext } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { Card } from "@/components/ui/card";

import { TopToolbar } from "../layout/TopToolbar";
import { ContractListContent } from "./ContractListContent";

export const ContractList = () => {
  return (
    <List
      title={false}
      actions={<ContractListActions />}
      perPage={25}
      sort={{ field: "created_at", order: "DESC" }}
    >
      <ContractListLayout />
    </List>
  );
};

const ContractListLayout = () => {
  const { data, isPending } = useListContext();

  if (isPending) return null;

  if (!data?.length)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">No contracts yet</p>
        <CreateButton />
      </div>
    );

  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="py-0">
        <ContractListContent />
      </Card>
    </div>
  );
};

const ContractListActions = () => (
  <TopToolbar>
    <SortButton fields={["contract_number", "case_type", "fee", "created_at"]} />
    <CreateButton />
  </TopToolbar>
);
