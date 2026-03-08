import { DeleteButton } from "@/components/admin";
import { type Identifier } from "ra-core";

import { EditSheet } from "../misc/EditSheet";
import { ContactDeleteWarning } from "../misc/DeleteWarnings";
import { ContactInputs } from "./ContactInputs";
import type { AccountContact } from "../types";

export interface ContactEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: Identifier;
}

export const ContactEditSheet = ({
  open,
  onOpenChange,
  contactId,
}: ContactEditSheetProps) => {
  return (
    <EditSheet
      resource="account_contacts"
      id={contactId}
      title={<h1 className="text-xl font-semibold">Edit Contact</h1>}
      redirect={false}
      open={open}
      onOpenChange={onOpenChange}
      deleteButton={
        <DeleteButton
          variant="destructive"
          className="flex-1"
          redirect="/account_contacts"
          onClick={() => onOpenChange(false)}
          confirmContent={<ContactDeleteWarning />}
        />
      }
    >
      <ContactInputs />
    </EditSheet>
  );
};
