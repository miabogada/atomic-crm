import { useCreate, useGetIdentity, useNotify, useRedirect } from "ra-core";
import { CreateBase, Form } from "ra-core";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/admin/form";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { AccountInputs, stripBillingFields } from "./AccountInputs";
import { supabase } from "../providers/supabase/supabase";
import type { Account } from "../types";

export interface AccountCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountCreateSheet = ({
  open,
  onOpenChange,
}: AccountCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [create] = useCreate();
  const notify = useNotify();
  const redirect = useRedirect();
  const billingDataRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!open) {
      setAccountNumber("");
      return;
    }
    supabase.rpc("generate_account_number").then(({ data, error }) => {
      if (!error && data) setAccountNumber(data);
    });
  }, [open]);

  const isReady = !!identity && !!accountNumber;

  const handleSuccess = async (data: any) => {
    const billingData = billingDataRef.current;
    billingDataRef.current = {};

    if (billingData.billing_first_name) {
      try {
        const { data: contactType } = await supabase
          .from("contact_types")
          .select("id")
          .eq("name", "billing")
          .single();

        await create(
          "account_contacts",
          {
            data: {
              account_id: data.id,
              contact_type_id: contactType?.id ?? null,
              is_billing_contact: true,
              first_name: billingData.billing_first_name,
              last_name: billingData.billing_last_name || "",
              email: billingData.billing_email || null,
              phone: billingData.billing_phone || null,
              address_street: billingData.billing_address_street || null,
              address_city: billingData.billing_address_city || null,
              address_state: billingData.billing_address_state || null,
              address_postal_code:
                billingData.billing_address_postal_code || null,
              address_country: billingData.billing_address_country || null,
              created_at: new Date().toISOString(),
              user_id: identity?.id,
            },
          },
          { returnPromise: true },
        );
      } catch {
        notify("Account created but billing contact could not be saved", {
          type: "warning",
        });
      }
    }

    notify("Account created");
    redirect("show", "accounts", data.id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-dvh flex flex-col">
        {isReady && (
          <CreateBase
            resource="accounts"
            redirect={false}
            transform={(data: Account & Record<string, any>) => {
              const { accountData, billingData } = stripBillingFields(data);
              billingDataRef.current = billingData;
              return {
                ...accountData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            }}
            mutationOptions={{ onSuccess: handleSuccess }}
          >
            <Form
              defaultValues={{
                user_id: identity.id,
                account_number: accountNumber,
                categories: "In Process",
                archived: false,
                date_opened: new Date().toISOString().split("T")[0],
              }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <SheetHeader className="border-b">
                <SheetTitle>
                  <span className="text-xl font-semibold">Create Account</span>
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
                <AccountInputs />
              </div>

              <SheetFooter className="border-t">
                <div className="flex w-full gap-4">
                  <SheetClose asChild>
                    <Button variant="ghost" className="flex-1">
                      Close
                    </Button>
                  </SheetClose>
                  <SaveButton className="flex-1" />
                </div>
              </SheetFooter>
            </Form>
          </CreateBase>
        )}
      </SheetContent>
    </Sheet>
  );
};
