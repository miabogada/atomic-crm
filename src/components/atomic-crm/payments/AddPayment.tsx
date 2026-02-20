import { useState } from "react";
import { DollarSign } from "lucide-react";
import {
  CreateBase,
  Form,
  type Identifier,
  useGetIdentity,
  useNotify,
  useRefresh,
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
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    setOpen(false);
    notify("Payment added");
    refresh();
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
          user_id: identity.id,
          date_received: new Date().toISOString().slice(0, 10),
        }}
        transform={(data: any) => ({
          ...data,
          account_id,
          contract_id: data.contract_id || null,
          user_id: identity.id,
        })}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Add payment</DialogTitle>
              </DialogHeader>
              <AccountPaymentInputs />
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
