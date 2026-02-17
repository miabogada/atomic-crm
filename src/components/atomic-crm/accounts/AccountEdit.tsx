import { Card, CardContent } from "@/components/ui/card";
import { EditBase, Form, useEditContext } from "ra-core";

import type { Account } from "../types";
import { AccountAside } from "./AccountAside";
import { AccountInputs } from "./AccountInputs";
import { FormToolbar } from "../layout/FormToolbar";

export const AccountEdit = () => (
  <EditBase
    redirect="show"
    transform={(data: Account) => ({
      ...data,
      updated_at: new Date().toISOString(),
    })}
  >
    <AccountEditContent />
  </EditBase>
);

const AccountEditContent = () => {
  const { isPending, record } = useEditContext<Account>();
  if (isPending || !record) return null;
  return (
    <div className="mt-2 flex gap-8">
      <Form className="flex flex-1 flex-col gap-4">
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
