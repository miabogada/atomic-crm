import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

import type { Account } from "../types";
import { AccountInputs } from "./AccountInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { supabase } from "../providers/supabase/supabase";

export const AccountCreate = () => {
  const { identity } = useGetIdentity();
  const [accountNumber, setAccountNumber] = useState<string>("");

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
      redirect="show"
      transform={(data: Account) => ({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
    >
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form
            defaultValues={{
              sales_id: identity?.id,
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
