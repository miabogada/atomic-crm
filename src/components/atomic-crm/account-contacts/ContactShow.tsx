import { ShowBase, useShowContext, useGetOne } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";

import { AsideSection } from "../misc/AsideSection";
import type { Account, AccountContact, ContactType } from "../types";

export const ContactShow = () => {
  return (
    <ShowBase>
      <ContactShowContent />
    </ShowBase>
  );
};

const ContactShowContent = () => {
  const { record, isPending } = useShowContext<AccountContact>();

  if (isPending || !record) return null;

  return (
    <div className="mt-2 mb-2 flex gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <h5 className="text-xl font-semibold">
                  {record.first_name} {record.last_name}
                </h5>
                <div className="text-sm text-muted-foreground">
                  {[record.email, record.phone].filter(Boolean).join(" \u00b7 ")}
                </div>
              </div>
              {record.is_billing_contact && (
                <Badge variant="default">Billing</Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <h6 className="text-lg font-semibold">Contact Info</h6>
                <Field label="First Name" value={record.first_name} />
                <Field label="Last Name" value={record.last_name} />
                <Field label="Email" value={record.email} />
                <Field label="Phone" value={record.phone} />
              </div>
              <div className="flex flex-col gap-3">
                <h6 className="text-lg font-semibold">Address</h6>
                <Field label="Street" value={record.address_street} />
                <Field label="City" value={record.address_city} />
                <Field label="State" value={record.address_state} />
                <Field label="Postal Code" value={record.address_postal_code} />
                <Field label="Country" value={record.address_country} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <ContactAside />
    </div>
  );
};

const Field = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <span className="text-muted-foreground">{label}:</span>{" "}
    {value || "\u2014"}
  </div>
);

const ContactAside = () => {
  const { record } = useShowContext<AccountContact>();

  if (!record) return null;

  return (
    <div className="hidden sm:block w-64 min-w-64 text-sm">
      <div className="mb-4 -ml-1">
        <EditButton label="Edit Contact" />
      </div>

      <ContactTypeInfo contactTypeId={record.contact_type_id} />
      <AccountInfo accountId={record.account_id} />

      <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
        <DeleteButton
          className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
          size="sm"
        />
      </div>
    </div>
  );
};

const ContactTypeInfo = ({ contactTypeId }: { contactTypeId?: any }) => {
  const { data: contactType } = useGetOne<ContactType>(
    "contact_types",
    { id: contactTypeId! },
    { enabled: !!contactTypeId },
  );

  if (!contactType) return null;

  return (
    <AsideSection title="Contact Type">
      <Badge variant="outline">{contactType.name}</Badge>
    </AsideSection>
  );
};

const AccountInfo = ({ accountId }: { accountId: any }) => {
  const { data: account, isPending } = useGetOne<Account>(
    "accounts",
    { id: accountId },
    { enabled: !!accountId },
  );

  if (isPending || !account) return null;

  return (
    <AsideSection title="Account">
      <div className="flex flex-col gap-1">
        <Link
          to={`/accounts/${account.id}/show`}
          className="text-primary hover:underline font-medium"
        >
          {account.name}
        </Link>
        <div className="text-muted-foreground">#{account.account_number}</div>
      </div>
    </AsideSection>
  );
};
