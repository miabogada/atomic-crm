import { useListContext } from "ra-core";
import { Badge } from "@/components/ui/badge";

import type { AccountContract } from "../types";

export const AccountContractsList = () => {
  const { data, isPending } = useListContext<AccountContract>();

  if (isPending) return null;

  if (!data?.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No contracts yet
      </div>
    );
  }

  return (
    <div className="divide-y">
      {data.map((contract) => (
        <div
          key={contract.id}
          className="flex items-center gap-4 py-3 px-2"
        >
          <div className="flex-1">
            <div className="font-medium">
              {contract.contract_number || `Contract #${contract.id}`}
            </div>
            <div className="text-sm text-muted-foreground">
              {contract.case_type && <span>{contract.case_type}</span>}
              {contract.date_opened && (
                <span>
                  {contract.case_type && " \u00b7 "}
                  Opened {contract.date_opened}
                </span>
              )}
            </div>
            {contract.work_description && (
              <div className="text-sm text-muted-foreground mt-1">
                {contract.work_description}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {contract.fee != null && (
              <Badge variant="outline">
                Fee: ${Number(contract.fee).toLocaleString()}
              </Badge>
            )}
            {contract.monthly_payment != null &&
              contract.monthly_payment > 0 && (
                <span className="text-xs text-muted-foreground">
                  ${Number(contract.monthly_payment).toLocaleString()}/mo
                  {contract.num_payments && ` \u00d7 ${contract.num_payments}`}
                </span>
              )}
          </div>
        </div>
      ))}
    </div>
  );
};
