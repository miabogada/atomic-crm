import { type Identifier, useNotify } from "ra-core";
import { DeleteButton } from "@/components/admin";
import { WithRecord } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { AccountPaymentInputs } from "./AccountPaymentInputs";

export interface AccountPaymentEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: Identifier;
}

/**
 * Admin-only edit sheet for account payments.
 * Caller is responsible for checking isAdmin before rendering this component.
 */
export const AccountPaymentEditSheet = ({
  open,
  onOpenChange,
  paymentId,
}: AccountPaymentEditSheetProps) => {
  const notify = useNotify();

  return (
    <EditSheet
      resource="account_payments"
      id={paymentId}
      title="Edit Payment"
      redirect={false}
      mutationMode="pessimistic"
      transform={(data: any) => {
        const isAdjustment = data.type === "discount" || data.type === "write_off";
        const amount = data.type === "refund"
          ? -Math.abs(Number(data.amount))
          : Math.abs(Number(data.amount));
        return {
          ...data,
          amount,
          contract_id: isAdjustment ? null : (data.contract_id || null),
          payment_method: isAdjustment ? "N/A" : data.payment_method,
        };
      }}
      mutationOptions={{
        onSuccess: () => {
          notify("Payment updated");
          onOpenChange(false);
        },
      }}
      deleteButton={
        <WithRecord
          render={() => (
            <DeleteButton
              variant="destructive"
              className="flex-1"
              redirect={false}
              mutationOptions={{
                onSuccess: () => {
                  notify("Payment deleted");
                  onOpenChange(false);
                },
              }}
            />
          )}
        />
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <AccountPaymentInputs />
    </EditSheet>
  );
};
