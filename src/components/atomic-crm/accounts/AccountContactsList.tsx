import { useListContext } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Badge } from "@/components/ui/badge";

import type { AccountContact } from "../types";

export const AccountContactsList = () => {
  const { data, isPending } = useListContext<AccountContact>();

  if (isPending) return null;

  if (!data?.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No contacts yet
      </div>
    );
  }

  return (
    <div className="divide-y">
      {data.map((contact) => (
        <div
          key={contact.id}
          className="flex items-center gap-4 py-3 px-2"
        >
          <div className="flex-1">
            <div className="font-medium">{contact.full_name}</div>
            <div className="text-sm text-muted-foreground">
              {[contact.email, contact.phone].filter(Boolean).join(" \u00b7 ")}
            </div>
            {contact.address_city && (
              <div className="text-sm text-muted-foreground">
                {[
                  contact.address_street,
                  contact.address_city,
                  contact.address_state,
                  contact.address_postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {contact.contact_type_id && (
              <ReferenceField
                source="contact_type_id"
                reference="contact_types"
                link={false}
              >
                <Badge variant="outline">
                  <TextField source="name" />
                </Badge>
              </ReferenceField>
            )}
            {contact.is_billing_contact && (
              <Badge variant="default">Billing</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
