import { InfiniteListBase } from "ra-core";
import { Card } from "@/components/ui/card";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { ContractListContent } from "./ContractListContent";

export const MobileContractsList = () => (
  <InfiniteListBase sort={{ field: "created_at", order: "DESC" }}>
    <MobileHeader>
      <h1 className="text-xl font-semibold">Contracts</h1>
    </MobileHeader>
    <MobileContent>
      <Card className="py-0">
        <ContractListContent />
      </Card>
    </MobileContent>
  </InfiniteListBase>
);
