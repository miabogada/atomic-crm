import { InfiniteListBase } from "ra-core";
import { Card } from "@/components/ui/card";
import { SortButton } from "@/components/admin/sort-button";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { AccountListContent } from "./AccountListContent";
import { AccountListFilter } from "./AccountListFilter";

export const MobileAccountsList = () => (
  <InfiniteListBase
    sort={{ field: "updated_at", order: "DESC" }}
    filter={{ "archived@neq": true }}
  >
    <MobileHeader>
      <AccountListFilter />
      <SortButton fields={["name", "account_number", "updated_at", "date_opened"]} />
    </MobileHeader>
    <MobileContent>
      <Card className="py-0">
        <AccountListContent />
      </Card>
    </MobileContent>
  </InfiniteListBase>
);
