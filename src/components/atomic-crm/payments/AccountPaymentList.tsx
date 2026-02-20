import { useState } from "react";
import { useGetIdentity, useGetList, useGetOne, useListContext, useRecordContext } from "ra-core";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { Account, AccountContract, AccountPayment, Sale } from "../types";
import { AddPayment } from "./AddPayment";
import { AccountPaymentEditSheet } from "./AccountPaymentEditSheet";

export const AccountPaymentList = () => {
  const { data, isPending } = useListContext<AccountPayment>();
  const account = useRecordContext<Account>();
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: contracts } = useGetList<AccountContract>(
    "account_contracts",
    {
      filter: { account_id: account?.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: !!account?.id },
  );

  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const isAdmin = !!currentUser?.administrator;

  if (isPending) return null;

  return (
    <div>
      <div className="flex justify-end mb-2">
        {account && <AddPayment account_id={account.id} />}
      </div>

      {!data?.length ? (
        <div className="text-center text-muted-foreground py-8">
          No payments recorded
        </div>
      ) : (
        <>
          <div className="divide-y">
            {data.map((payment) => {
              const contract = contracts?.find((c) => c.id === payment.contract_id);
              return (
              <div
                key={payment.id}
                className="flex items-center gap-4 py-3 px-2"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    ${Number(payment.amount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {payment.date_received}
                    {payment.payment_method && (
                      <span> &middot; {payment.payment_method}</span>
                    )}
                    {payment.reference_number && (
                      <span> &middot; #{payment.reference_number}</span>
                    )}
                  </div>
                  {contract && (
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {contract.contract_number || `Contract #${contract.id}`}
                    </div>
                  )}
                  {payment.notes && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {payment.notes}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto"
                    onClick={() => setEditingId(payment.id as number)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
              );
            })}
          </div>

        </>
      )}

      {editingId != null && (
        <AccountPaymentEditSheet
          open={editingId != null}
          onOpenChange={(open) => { if (!open) setEditingId(null); }}
          paymentId={editingId}
        />
      )}
    </div>
  );
};
