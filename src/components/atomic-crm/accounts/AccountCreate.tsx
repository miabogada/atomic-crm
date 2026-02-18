import {
  CreateBase,
  Form,
  useCreate,
  useGetIdentity,
  useNotify,
  useRedirect,
} from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";

import type { Account } from "../types";
import { AccountInputs, stripBillingFields } from "./AccountInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { supabase } from "../providers/supabase/supabase";

export const AccountCreate = () => {
  const { identity } = useGetIdentity();
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [create] = useCreate();
  const notify = useNotify();
  const redirect = useRedirect();
  const billingDataRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const fetchAccountNumber = async () => {
      try {
        const { data, error } = await supabase.rpc("generate_account_number");
        if (!error && data) {
          setAccountNumber(data);
        }
      } catch {
        // Fall back to empty — user can enter manually
      }
    };
    fetchAccountNumber();
  }, []);

  if (!accountNumber) return null;

  return (
    <CreateBase
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
      mutationOptions={{
        onSuccess: async (data: any) => {
          const billingData = billingDataRef.current;
          billingDataRef.current = {};

          if (billingData.billing_full_name) {
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
                    full_name: billingData.billing_full_name,
                    email: billingData.billing_email || null,
                    phone: billingData.billing_phone || null,
                    address_street:
                      billingData.billing_address_street || null,
                    address_city: billingData.billing_address_city || null,
                    address_state:
                      billingData.billing_address_state || null,
                    address_postal_code:
                      billingData.billing_address_postal_code || null,
                    address_country:
                      billingData.billing_address_country || null,
                    created_at: new Date().toISOString(),
                    user_id: identity?.id,
                  },
                },
                { returnPromise: true },
              );
            } catch {
              notify(
                "Account created but billing contact could not be saved",
                { type: "warning" },
              );
            }
          }

          notify("Account created");
          redirect("show", "accounts", data.id);
        },
      }}
    >
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form
            defaultValues={{
              user_id: identity?.id,
              account_number: accountNumber,
              categories: "In Process",
              archived: false,
              date_opened: new Date().toISOString().split("T")[0],
            }}
          >
            <Card>
              <CardContent>
                <AccountInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
