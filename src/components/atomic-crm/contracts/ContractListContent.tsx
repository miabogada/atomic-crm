import { RecordContextProvider, useListContext } from "ra-core";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";

import type { AccountContract } from "../types";

export const ContractListContent = () => {
  const {
    data: contracts,
    error,
    isPending,
  } = useListContext<AccountContract>();

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  if (error) {
    return null;
  }

  return (
    <div className="md:divide-y">
      {contracts.map((contract) => (
        <RecordContextProvider key={contract.id} value={contract}>
          <ContractItemContent contract={contract} />
        </RecordContextProvider>
      ))}

      {contracts.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">No contracts found</div>
        </div>
      )}
    </div>
  );
};

const ContractItemContent = ({ contract }: { contract: AccountContract }) => {
  return (
    <div className="flex flex-row items-center px-4 py-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl">
      <Link
        to={`/account_contracts/${contract.id}/show`}
        className="flex-1 flex flex-row gap-4 items-center"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {contract.contract_number || `Contract #${contract.id}`}
          </div>
          <div className="text-sm text-muted-foreground">
            <ReferenceField
              source="account_id"
              reference="accounts"
              link={false}
            >
              <TextField source="name" />
            </ReferenceField>
            {contract.case_type && ` \u00b7 ${contract.case_type}`}
            {contract.date_opened && ` \u00b7 Opened ${contract.date_opened}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contract.fee != null && (
            <Badge variant="outline">
              ${Number(contract.fee).toLocaleString()}
            </Badge>
          )}
          {contract.monthly_payment != null &&
            contract.monthly_payment > 0 && (
              <span className="text-sm text-muted-foreground">
                ${Number(contract.monthly_payment).toLocaleString()}/mo
                {contract.num_payments && ` \u00d7 ${contract.num_payments}`}
              </span>
            )}
        </div>
      </Link>
    </div>
  );
};
