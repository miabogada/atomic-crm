import { useGetIdentity } from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { ContractInputs } from "./ContractInputs";

export interface ContractCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const today = () => new Date().toISOString().split("T")[0];

export const ContractCreateSheet = ({
  open,
  onOpenChange,
}: ContractCreateSheetProps) => {
  const { identity } = useGetIdentity();

  if (!identity) return null;

  return (
    <CreateSheet
      resource="account_contracts"
      title="Create Contract"
      transform={(data: any) => ({
        ...data,
        created_at: new Date().toISOString(),
      })}
      defaultValues={{
        user_id: identity.id,
        date_opened: today(),
        date_retainer: today(),
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <ContractInputs />
    </CreateSheet>
  );
};
