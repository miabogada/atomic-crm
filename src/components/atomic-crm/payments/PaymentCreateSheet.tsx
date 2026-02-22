import { useGetIdentity, useNotify, useRefresh, type Identifier } from "ra-core";

import { CreateSheet } from "../misc/CreateSheet";
import { AccountPaymentInputs } from "./AccountPaymentInputs";

export interface PaymentCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account_id: Identifier;
  contract_id?: Identifier | null;
}

export const PaymentCreateSheet = ({
  open,
  onOpenChange,
  account_id,
  contract_id,
}: PaymentCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();

  if (!identity) return null;

  return (
    <CreateSheet
      resource="account_payments"
      title="Add Payment"
      redirect={false}
      transform={(data: any) => ({
        ...data,
        account_id,
        contract_id: data.contract_id || null,
        user_id: identity.id,
      })}
      defaultValues={{
        account_id,
        contract_id: contract_id ?? null,
        user_id: identity.id,
        date_received: new Date().toISOString().slice(0, 10),
      }}
      mutationOptions={{
        onSuccess: () => {
          notify("Payment added");
          refresh();
          onOpenChange(false);
        },
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <AccountPaymentInputs />
    </CreateSheet>
  );
};
