import { useGetList, useListContext, useRecordContext } from "ra-core";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Account, AccountContract, AccountPayment } from "../types";
import { contractStatusColors } from "../misc/statusColors";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const AccountContractsList = () => {
  const { data, isPending } = useListContext<AccountContract>();
  const account = useRecordContext<Account>();

  const { data: payments } = useGetList<AccountPayment>(
    "account_payments",
    {
      filter: { account_id: account?.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: !!account?.id },
  );

  if (isPending) return null;

  return (
    <div>
      {account && (
        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/account_contracts/create?account_id=${account.id}`}>
              <Plus className="w-4 h-4 mr-1" />
              Add Contract
            </Link>
          </Button>
        </div>
      )}

      {!data?.length ? (
        <div className="text-center text-muted-foreground py-8">
          No contracts yet
        </div>
      ) : (
        <div className="divide-y">
          {data.map((contract) => {
            const contractPayments =
              payments?.filter((p) => p.contract_id === contract.id) ?? [];
            const totalReceived = contractPayments.reduce(
              (sum, p) => sum + Number(p.amount),
              0,
            );
            const fee = Number(contract.fee ?? 0);
            const balance = fee - totalReceived;
            const paymentCount = contractPayments.length;
            const numPayments = contract.num_payments;

            return (
              <div
                key={contract.id}
                className="flex items-start gap-4 py-3 px-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      to={`/account_contracts/${contract.id}/show`}
                      className="font-medium text-primary hover:underline"
                    >
                      {contract.contract_number || `Contract #${contract.id}`}
                    </Link>
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
                  {fee > 0 && (
                    <div className="flex flex-wrap gap-x-4 mt-2 text-xs">
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
                          {numPayments ? `${paymentCount} of ${numPayments}` : paymentCount}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
