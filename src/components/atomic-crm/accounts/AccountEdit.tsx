import { Card, CardContent } from "@/components/ui/card";
import {
  EditBase,
  Form,
  useCreate,
  useEditContext,
  useGetIdentity,
  useGetList,
  useNotify,
  useRedirect,
  useUpdate,
} from "ra-core";
import { useRef } from "react";

import type { Account, AccountContact } from "../types";
import { AccountAside } from "./AccountAside";
import { AccountInputs, stripBillingFields } from "./AccountInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { supabase } from "../providers/supabase/supabase";

export const AccountEdit = () => {
  const [create] = useCreate();
  const [update] = useUpdate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const redirect = useRedirect();
  const billingDataRef = useRef<Record<string, any>>({});
  const billingContactRef = useRef<AccountContact | null>(null);

  return (
    <EditBase
      redirect={false}
      transform={(data: Account & Record<string, any>) => {
        const { accountData, billingData } = stripBillingFields(data);
        billingDataRef.current = billingData;
        return {
          ...accountData,
          updated_at: new Date().toISOString(),
        };
      }}
      mutationOptions={{
        onSuccess: async (data: any) => {
          const billingData = billingDataRef.current;
          billingDataRef.current = {};
          const existingContact = billingContactRef.current;

          if (billingData.billing_first_name) {
            try {
              const { data: contactType } = await supabase
                .from("contact_types")
                .select("id")
                .eq("name", "billing")
                .single();

              const contactPayload = {
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
                address_country:
                  billingData.billing_address_country || null,
                user_id: identity?.id,
              };

              if (existingContact) {
                await update(
                  "account_contacts",
                  {
                    id: existingContact.id,
                    data: contactPayload,
                    previousData: existingContact,
                  },
                  { returnPromise: true },
                );
              } else {
                await create(
                  "account_contacts",
                  {
                    data: {
                      ...contactPayload,
                      created_at: new Date().toISOString(),
                    },
                  },
                  { returnPromise: true },
                );
              }
            } catch {
              notify(
                "Account saved but billing contact could not be updated",
                { type: "warning" },
              );
            }
          }

          notify("Account updated");
          redirect("show", "accounts", data.id);
        },
      }}
    >
      <AccountEditContent billingContactRef={billingContactRef} />
    </EditBase>
  );
};

const AccountEditContent = ({
  billingContactRef,
}: {
  billingContactRef: React.MutableRefObject<AccountContact | null>;
}) => {
  const { isPending, record } = useEditContext<Account>();

  const { data: billingContacts, isPending: billingPending } =
    useGetList<AccountContact>("account_contacts", {
      filter: { account_id: record?.id, is_billing_contact: true },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    }, { enabled: !!record?.id });

  if (isPending || !record || billingPending) return null;

  const billingContact = billingContacts?.[0] ?? null;
  billingContactRef.current = billingContact;

  const billingDefaults = billingContact
    ? {
        billing_first_name: billingContact.first_name || "",
        billing_last_name: billingContact.last_name || "",
        billing_email: billingContact.email || "",
        billing_phone: billingContact.phone || "",
        billing_address_street: billingContact.address_street || "",
        billing_address_city: billingContact.address_city || "",
        billing_address_state: billingContact.address_state || "",
        billing_address_postal_code: billingContact.address_postal_code || "",
        billing_address_country: billingContact.address_country || "",
      }
    : {};

  return (
    <div className="mt-2 flex gap-8">
      <Form
        className="flex flex-1 flex-col gap-4"
        defaultValues={billingDefaults}
      >
        <Card>
          <CardContent>
            <AccountInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>

      <AccountAside link="show" />
    </div>
  );
};
