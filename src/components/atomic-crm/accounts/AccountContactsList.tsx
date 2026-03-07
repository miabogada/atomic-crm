import { useListContext, useRecordContext } from "ra-core";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Account, AccountContact } from "../types";

export const AccountContactsList = () => {
  const { data, isPending } = useListContext<AccountContact>();
  const account = useRecordContext<Account>();
  if (isPending) return null;

  return (
    <>
      {account && (
        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/account_contacts/create?account_id=${account.id}`}>
              <Plus className="w-4 h-4 mr-1" />
              Add Contact
            </Link>
          </Button>
        </div>
      )}

      {!data?.length ? (
        <div className="text-center text-muted-foreground py-8">
          No contacts yet
        </div>
      ) : (
        <div className="divide-y">
          {data.map((contact) => (
            <Link
              key={contact.id}
              to={`/account_contacts/${contact.id}/show`}
              className="flex items-center gap-4 py-3 px-2 rounded-md hover:bg-accent transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-primary">
                    {contact.first_name} {contact.last_name}
                  </span>
                  {contact.contact_type_id && (
                    <ReferenceField
                      source="contact_type_id"
                      reference="contact_types"
                      link={false}
                    >
                      <Badge variant="outline" className="text-xs py-0 px-1.5">
                        <TextField source="name" />
                      </Badge>
                    </ReferenceField>
                  )}
                  {contact.is_billing_contact && (
                    <Badge variant="outline" className="text-xs py-0 px-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Billing
                    </Badge>
                  )}
                </div>
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
            </Link>
          ))}
        </div>
      )}
    </>
  );
};
