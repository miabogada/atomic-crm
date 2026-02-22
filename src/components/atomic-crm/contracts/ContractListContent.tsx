import { useGetList, useListContext, type Identifier } from "ra-core";
import { RecordContextProvider } from "ra-core";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";

import type { AccountContract, AccountPayment } from "../types";
import { contractStatusColors } from "../misc/statusColors";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

const ContractPaymentSummary = ({
  contract_id,
  fee,
  num_payments,
}: {
  contract_id: Identifier;
  fee: number;
  num_payments?: number | null;
}) => {
  const { data: payments } = useGetList<AccountPayment>(
    "account_payments",
    {
      filter: { contract_id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
  );

  if (!payments) return null;

  const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = fee - totalReceived;
  const paymentCount = payments.length;

  return (
    <div className="flex flex-wrap gap-x-4 mt-1 text-xs">
      <span>
        <span className="text-muted-foreground">Contracted: </span>
        <span className="font-medium">${fmt(fee)}</span>
      </span>
      <span>
        <span className="text-muted-foreground">Received: </span>
        <span className="font-medium">${fmt(totalReceived)}</span>
      </span>
      <span>
        <span className="text-muted-foreground">Balance: </span>
        <span className={`font-medium ${balance > 0 ? "text-destructive" : "text-green-600"}`}>
          ${fmt(balance)}
        </span>
      </span>
      <span>
        <span className="text-muted-foreground">Payments: </span>
        <span className="font-medium">
          {num_payments ? `${paymentCount} of ${num_payments}` : paymentCount}
        </span>
      </span>
    </div>
  );
};

const ContractItemContent = ({ contract }: { contract: AccountContract }) => {
  return (
    <div className="flex flex-row items-center px-4 py-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl">
      <Link
        to={`/account_contracts/${contract.id}/show`}
        className="flex-1 flex flex-row gap-4 items-start"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium">
              {contract.contract_number || `Contract #${contract.id}`}
            </span>
            {contract.status && (
              <Badge
                variant="outline"
                className={`text-xs py-0 px-1.5 ${contractStatusColors[contract.status] ?? ""}`}
              >
                {contract.status}
              </Badge>
            )}
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
          {contract.fee != null && (
            <ContractPaymentSummary
              contract_id={contract.id}
              fee={Number(contract.fee)}
              num_payments={contract.num_payments}
            />
          )}
        </div>
      </Link>
    </div>
  );
};
