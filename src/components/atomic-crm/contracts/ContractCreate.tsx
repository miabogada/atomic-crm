import { CreateBase, Form, useGetIdentity, useGetOne } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams } from "react-router";

import type { Account } from "../types";
import { ContractInputs } from "./ContractInputs";
import { FormToolbar } from "../layout/FormToolbar";

const today = () => new Date().toISOString().split("T")[0];

export const ContractCreate = () => {
  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get("account_id");

  // If we have an account_id from URL, fetch the account to pre-fill contract_number
  const { data: account, isPending: accountPending } = useGetOne<Account>(
    "accounts",
    { id: accountId! },
    { enabled: !!accountId },
  );

  if (!identity) return null;
  // Wait for account data if we have an account_id param
  if (accountId && accountPending) return null;

  const defaultValues: Record<string, any> = {
    user_id: identity.id,
    date_opened: today(),
    date_retainer: today(),
  };

  if (accountId) {
    defaultValues.account_id = Number(accountId);
    if (account?.account_number) {
      defaultValues.contract_number = `Contract ${account.account_number}`;
    }
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
