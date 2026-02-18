import { EditBase, Form, useEditContext } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import type { AccountContract } from "../types";
import { ContractInputs } from "./ContractInputs";
import { ContractAside } from "./ContractShow";
import { FormToolbar } from "../layout/FormToolbar";

export const ContractEdit = () => {
  return (
    <EditBase>
      <ContractEditContent />
    </EditBase>
  );
};

const ContractEditContent = () => {
  const { isPending, record } = useEditContext<AccountContract>();

  if (isPending || !record) return null;

  return (
    <div className="mt-2 flex gap-8">
      <Form className="flex flex-1 flex-col gap-4">
        <Card>
          <CardContent>
            <ContractInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>

      <ContractAside />
    </div>
  );
};
