import { InfiniteListBase } from "ra-core";
import { Card } from "@/components/ui/card";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { AccountListContent } from "./AccountListContent";

export const MobileAccountsList = () => (
  <InfiniteListBase
    sort={{ field: "updated_at", order: "DESC" }}
    filter={{ "archived@neq": true }}
  >
    <MobileHeader>
      <h1 className="text-xl font-semibold">Accounts</h1>
    </MobileHeader>
    <MobileContent>
      <Card className="py-0">
        <AccountListContent />
      </Card>
    </MobileContent>
  </InfiniteListBase>
);
