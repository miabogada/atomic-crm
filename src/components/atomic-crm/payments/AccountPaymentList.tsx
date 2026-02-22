import { useState } from "react";
import { useGetIdentity, useGetList, useGetOne, useListContext, useRecordContext } from "ra-core";

import type { Account, AccountContract, AccountPayment, Sale } from "../types";
import { AddPayment } from "./AddPayment";
import { AccountPaymentEditSheet } from "./AccountPaymentEditSheet";
import { PaymentRow } from "./PaymentRow";

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
        <div className="divide-y">
          {data.map((payment) => {
            const contract = contracts?.find((c) => c.id === payment.contract_id);
            const contractLabel = contract
              ? (contract.contract_number || `Contract #${contract.id}`)
              : undefined;
            return (
              <PaymentRow
                key={payment.id}
                payment={payment}
                isAdmin={isAdmin}
                onEdit={setEditingId}
                contractLabel={contractLabel}
              />
            );
          })}
        </div>
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
