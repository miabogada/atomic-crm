import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams } from "react-router";

import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";

export const ContactCreate = () => {
  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get("account_id");

  if (!identity) return null;

  const defaultValues: Record<string, any> = {
    user_id: identity.id,
    is_billing_contact: false,
  };

  if (accountId) {
    defaultValues.account_id = Number(accountId);
  }

  return (
    <CreateBase
      redirect={accountId ? `/accounts/${accountId}/show` : "list"}
      transform={(data: any) => ({
        ...data,
        created_at: new Date().toISOString(),
      })}
    >
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form defaultValues={defaultValues}>
            <Card>
              <CardContent>
                <ContactInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
