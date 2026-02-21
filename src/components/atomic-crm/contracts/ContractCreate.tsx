import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams } from "react-router";

import { ContractInputs } from "./ContractInputs";
import { FormToolbar } from "../layout/FormToolbar";

const today = () => new Date().toISOString().split("T")[0];

export const ContractCreate = () => {
  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get("account_id");

  if (!identity) return null;

  const defaultValues: Record<string, any> = {
    user_id: identity.id,
    date_opened: today(),
    date_retainer: today(),
  };

  if (accountId) {
    defaultValues.account_id = Number(accountId);
  }

  return (
    <CreateBase
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
                <ContractInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
