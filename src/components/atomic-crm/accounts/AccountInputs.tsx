import { required, useDataProvider } from "ra-core";
import { useFormContext } from "react-hook-form";
import { useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { DateInput } from "@/components/admin/date-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";

import type { AccountContact, Sale } from "../types";
import {
  defaultAccountCategories,
} from "../root/defaultConfiguration";

export const BILLING_FIELDS = [
  "_billing_contact_lookup",
  "billing_full_name",
  "billing_email",
  "billing_phone",
  "billing_address_street",
  "billing_address_city",
  "billing_address_state",
  "billing_address_postal_code",
  "billing_address_country",
] as const;

export const stripBillingFields = (data: Record<string, any>) => {
  const billingData: Record<string, any> = {};
  const accountData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if ((BILLING_FIELDS as readonly string[]).includes(key)) {
      billingData[key] = value;
    } else {
      accountData[key] = value;
    }
  }
  // Derive account name/phone/email from billing contact
  if (billingData.billing_full_name) {
    accountData.name = billingData.billing_full_name;
  }
  if (billingData.billing_phone) {
    accountData.phone = billingData.billing_phone;
  }
  if (billingData.billing_email) {
    accountData.email = billingData.billing_email;
  }
  return { accountData, billingData };
};

export const AccountInputs = () => {
  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex gap-6 flex-col md:flex-row">
        <div className="flex flex-col gap-10 flex-1">
          <AccountIdentityInputs />
          <AccountDatesInputs />
        </div>
        <Separator orientation="vertical" className="flex-shrink-0 hidden md:block" />
        <div className="flex flex-col gap-10 flex-1">
          <BillingContactInputs />
          <AccountTeamInputs />
          <AccountMiscInputs />
        </div>
      </div>
    </div>
  );
};

const AccountIdentityInputs = () => {
  const categoryChoices = defaultAccountCategories.map((c) => ({
    id: c,
    name: c,
  }));

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Account</h6>
      <TextInput
        source="account_number"
        validate={required()}
        helperText="Format: YYMMDD## (auto-generated on create)"
      />
      <SelectInput
        source="categories"
        choices={categoryChoices}
        helperText={false}
        defaultValue="In Process"
      />
    </div>
  );
};

const AccountDatesInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Dates</h6>
      <DateInput source="date_opened" helperText={false} />
      <DateInput source="date_first_consult" helperText={false} />
      <DateInput source="date_closed" helperText={false} />
    </div>
  );
};

const AccountTeamInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Team</h6>
      <ReferenceInput
        reference="sales"
        source="attorney_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          helperText={false}
          label="Attorney"
          optionText={saleOptionRenderer}
        />
      </ReferenceInput>
      <ReferenceInput
        reference="sales"
        source="law_clerk_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          helperText={false}
          label="Law Clerk"
          optionText={saleOptionRenderer}
        />
      </ReferenceInput>
      <ReferenceInput
        reference="sales"
        source="legal_assistant_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          helperText={false}
          label="Legal Assistant"
          optionText={saleOptionRenderer}
        />
      </ReferenceInput>
      <ReferenceInput
        reference="sales"
        source="sales_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          helperText={false}
          label="Account Manager"
          optionText={saleOptionRenderer}
          validate={required()}
        />
      </ReferenceInput>
    </div>
  );
};

const AccountMiscInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Other</h6>
      <TextInput source="referred_by" helperText={false} />
      <TextInput source="notes" multiline helperText={false} />
      <BooleanInput source="archived" helperText={false} />
    </div>
  );
};

const BillingContactInputs = () => {
  const { setValue } = useFormContext();
  const dataProvider = useDataProvider();
  const lastLookupId = useRef<string | null>(null);

  const handleLookupChange = (id: any) => {
    if (!id || id === lastLookupId.current) return;
    lastLookupId.current = id;
    dataProvider
      .getOne<AccountContact>("account_contacts", { id })
      .then(({ data }) => {
        if (!data) return;
        setValue("billing_full_name", data.full_name || "");
        setValue("billing_email", data.email || "");
        setValue("billing_phone", data.phone || "");
        setValue("billing_address_street", data.address_street || "");
        setValue("billing_address_city", data.address_city || "");
        setValue("billing_address_state", data.address_state || "");
        setValue("billing_address_postal_code", data.address_postal_code || "");
        setValue("billing_address_country", data.address_country || "");
      });
  };

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Billing Contact</h6>
      <ReferenceInput
        reference="account_contacts"
        source="_billing_contact_lookup"
        sort={{ field: "full_name", order: "ASC" }}
      >
        <AutocompleteInput
          label="Copy from existing contact"
          optionText="full_name"
          helperText="Select to auto-fill fields below"
          filterToQuery={(text: string) => ({
            "full_name@ilike": `%${text}%`,
          })}
          onChange={handleLookupChange}
        />
      </ReferenceInput>
      <TextInput source="billing_full_name" label="Full Name" validate={required()} helperText={false} />
      <TextInput source="billing_email" label="Email" helperText={false} />
      <TextInput source="billing_phone" label="Phone" helperText={false} />
      <TextInput source="billing_address_street" label="Street" helperText={false} />
      <div className="flex gap-2">
        <TextInput source="billing_address_city" label="City" helperText={false} className="flex-1" />
        <TextInput source="billing_address_state" label="State" helperText={false} className="w-20" />
      </div>
      <div className="flex gap-2">
        <TextInput source="billing_address_postal_code" label="Postal Code" helperText={false} className="flex-1" />
        <TextInput source="billing_address_country" label="Country" helperText={false} className="flex-1" />
      </div>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;
