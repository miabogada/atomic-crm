import { useGetIdentity } from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { ContactInputs } from "./ContactInputs";

export interface ContactCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactCreateSheet = ({
  open,
  onOpenChange,
}: ContactCreateSheetProps) => {
  const { identity } = useGetIdentity();

  if (!identity) return null;

  return (
    <CreateSheet
      resource="account_contacts"
      title="Create Contact"
      redirect="list"
      transform={(data: any) => ({
        ...data,
        created_at: new Date().toISOString(),
      })}
      defaultValues={{
        user_id: identity.id,
        is_billing_contact: false,
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <ContactInputs />
    </CreateSheet>
  );
};
