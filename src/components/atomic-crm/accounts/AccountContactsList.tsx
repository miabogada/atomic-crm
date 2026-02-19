import { useState } from "react";
import { useListContext, useRecordContext } from "ra-core";
import { Link } from "react-router";
import { ClipboardPlus, Plus } from "lucide-react";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Account, AccountContact } from "../types";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";

export const AccountContactsList = () => {
  const { data, isPending } = useListContext<AccountContact>();
  const account = useRecordContext<Account>();
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<
    string | number | null
  >(null);

  if (isPending) return null;

  const handleAddTask = (contactId: string | number) => {
    setSelectedContactId(contactId);
    setTaskSheetOpen(true);
  };

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
            <div
              key={contact.id}
              className="flex items-center gap-4 py-3 px-2"
            >
              <div className="flex-1">
                <Link
                  to={`/account_contacts/${contact.id}/show`}
                  className="font-medium text-primary hover:underline"
                >
                  {contact.first_name} {contact.last_name}
                </Link>
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
                {account && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Add task for this contact"
                    onClick={() => handleAddTask(contact.id)}
                  >
                    <ClipboardPlus className="w-4 h-4" />
                  </Button>
                )}
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
      )}

      {account && selectedContactId != null && (
        <TaskCreateSheet
          open={taskSheetOpen}
          onOpenChange={setTaskSheetOpen}
          account_id={account.id}
          parent_type="account_contact"
          parent_id={selectedContactId}
        />
      )}
    </>
  );
};
