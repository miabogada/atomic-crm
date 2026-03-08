import { useState } from "react";
import { DollarSign } from "lucide-react";
import {
  CreateBase,
  Form,
  type Identifier,
  useGetIdentity,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AccountPaymentInputs } from "./AccountPaymentInputs";

export const AddPayment = ({
  account_id,
  contract_id,
}: {
  account_id: Identifier;
  contract_id?: Identifier | null;
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const [open, setOpen] = useState(false);
  const [selectedScheduleRowId, setSelectedScheduleRowId] = useState<Identifier | null>(null);

  const close = () => {
    setOpen(false);
    setSelectedScheduleRowId(null);
  };

  const handleSuccess = (newPayment: any) => {
    if (selectedScheduleRowId != null) {
      update(
        "contract_payment_schedule",
        {
          id: Number(selectedScheduleRowId),
          data: { payment_id: Number(newPayment.id) },
          previousData: { id: selectedScheduleRowId },
        },
        {
          onSuccess: () => {
            notify("Payment added and linked to schedule", { type: "success" });
            close();
            refresh();
          },
          onError: () => {
            notify("Payment added but could not link to schedule", { type: "warning" });
            close();
            refresh();
          },
        },
      );
    } else {
      notify("Payment added");
      close();
      refresh();
    }
  };

  if (!identity) return null;

  return (
    <>
      <div className="my-2">
        <Button
          variant="outline"
          className="h-6 cursor-pointer"
          onClick={() => setOpen(true)}
          size="sm"
        >
          <DollarSign className="w-4 h-4" />
          Add payment
        </Button>
      </div>

      <CreateBase
        resource="account_payments"
        record={{
          account_id,
          contract_id: contract_id ?? null,
          type: "payment",
          user_id: identity.id,
          date_received: new Date().toISOString().slice(0, 10),
        }}
        transform={(data: any) => {
          const isAdjustment = data.type === "discount" || data.type === "write_off";
          const amount = data.type === "refund"
            ? -Math.abs(Number(data.amount))
            : Math.abs(Number(data.amount));
          return {
            ...data,
            amount,
            account_id,
            contract_id: isAdjustment ? null : (data.contract_id || null),
            payment_method: isAdjustment ? "N/A" : data.payment_method,
            user_id: identity.id,
          };
        }}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Add payment</DialogTitle>
              </DialogHeader>
              <AccountPaymentInputs onScheduleRowSelect={setSelectedScheduleRowId} />
              <DialogFooter className="w-full justify-end">
                <SaveButton />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    </>
  );
};
