import { RecordContextProvider, useListContext } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router";

import { TopToolbar } from "../layout/TopToolbar";
import type { AccountContact } from "../types";

export const ContactList = () => {
  return (
    <List
      title={false}
      actions={<ContactListActions />}
      perPage={25}
      sort={{ field: "first_name", order: "ASC" }}
    >
      <ContactListLayout />
    </List>
  );
};

const ContactListLayout = () => {
  const { data, isPending, filterValues } = useListContext<AccountContact>();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return <Skeleton className="w-full h-9" />;

  if (!data?.length && !hasFilters)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">No contacts yet</p>
        <CreateButton />
      </div>
    );

  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="py-0">
        <div className="md:divide-y">
          {data.map((contact) => (
            <RecordContextProvider key={contact.id} value={contact}>
              <ContactListItem contact={contact} />
            </RecordContextProvider>
          ))}
        </div>
      </Card>
    </div>
  );
};

const ContactListItem = ({ contact }: { contact: AccountContact }) => {
  return (
    <Link
      to={`/account_contacts/${contact.id}/show`}
      className="flex flex-row items-center px-4 py-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium">
          {contact.first_name} {contact.last_name}
        </div>
        <div className="text-sm text-muted-foreground">
          {[contact.email, contact.phone].filter(Boolean).join(" \u00b7 ")}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {contact.account_id && (
          <ReferenceField
            source="account_id"
            reference="accounts"
            link={false}
            className="text-sm"
          >
            <TextField source="name" />
          </ReferenceField>
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
    </Link>
  );
};

const ContactListActions = () => (
  <TopToolbar>
    <SortButton fields={["first_name", "last_name", "created_at"]} />
    <CreateButton />
  </TopToolbar>
);
