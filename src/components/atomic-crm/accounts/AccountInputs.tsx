import { required, useDataProvider, useGetList } from "ra-core";
import { useFormContext } from "react-hook-form";
import { useEffect, useRef } from "react";
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
import { PhoneInput } from "../misc/PhoneInput";
import { toTitleCase } from "../misc/titleCase";
import { usStateChoices } from "../misc/usStates";

export const BILLING_FIELDS = [
  "_billing_contact_lookup",
  "billing_first_name",
  "billing_last_name",
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
  if (billingData.billing_first_name) {
    accountData.name = `${billingData.billing_first_name} ${billingData.billing_last_name || ""}`.trim();
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
      <DateInput source="date_closed" helperText={false} />
    </div>
  );
};

/**
 * Auto-assigns attorney_id, law_clerk_id, legal_assistant_id based on user roles.
 * Only shows the Account Manager picker (user_id) which remains user-selectable.
 */
const AccountTeamInputs = () => {
  const { setValue, getValues } = useFormContext();
  const { data: users } = useGetList<Sale & { role?: string }>("users", {
    filter: { "disabled@neq": true },
    pagination: { page: 1, perPage: 100 },
  });

  useEffect(() => {
    if (!users) return;
    const roleMap: Record<string, string> = {
      attorney: "attorney_id",
      law_clerk: "law_clerk_id",
      legal_assistant: "legal_assistant_id",
    };
    for (const [role, field] of Object.entries(roleMap)) {
      if (!getValues(field)) {
        const user = users.find((u) => u.role === role);
        if (user) setValue(field, user.id);
      }
    }
    // Default Account Manager to the attorney
    const attorney = users.find((u) => u.role === "attorney");
    if (attorney && !getValues("user_id")) {
      setValue("user_id", attorney.id);
    }
  }, [users, setValue, getValues]);

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Team</h6>
      <ReferenceInput
        reference="users"
        source="user_id"
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
        setValue("billing_first_name", data.first_name || "");
        setValue("billing_last_name", data.last_name || "");
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
        sort={{ field: "first_name", order: "ASC" }}
      >
        <AutocompleteInput
          label="Copy from existing contact"
          optionText={(r: any) => `${r.first_name} ${r.last_name}`.trim()}
          helperText="Select to auto-fill fields below"
          filterToQuery={(text: string) => ({
            "first_name@ilike": `%${text}%`,
          })}
          onChange={handleLookupChange}
        />
      </ReferenceInput>
      <div className="flex gap-2">
        <TextInput source="billing_first_name" label="First Name" validate={required()} helperText={false} className="flex-1" parse={(v: string) => toTitleCase(v)} />
        <TextInput source="billing_last_name" label="Last Name" helperText={false} className="flex-1" parse={(v: string) => toTitleCase(v)} />
      </div>
      <TextInput source="billing_email" label="Email" helperText={false} />
      <PhoneInput source="billing_phone" label="Phone" helperText={false} />
      <TextInput source="billing_address_street" label="Street" helperText={false} parse={(v: string) => toTitleCase(v)} />
      <div className="flex gap-2">
        <TextInput source="billing_address_city" label="City" helperText={false} className="flex-1" parse={(v: string) => toTitleCase(v)} />
        <SelectInput source="billing_address_state" label="State" choices={usStateChoices} helperText={false} className="w-24" />
      </div>
      <div className="flex gap-2">
        <TextInput source="billing_address_postal_code" label="Postal Code" helperText={false} className="flex-1" />
        <CountrySelect source="billing_address_country" label="Country" helperText={false} className="flex-1" />
      </div>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;

const countryChoices = [
  { id: "US", name: "United States" },
  { id: "MX", name: "Mexico" },
  { id: "CA", name: "Canada" },
  { id: "GT", name: "Guatemala" },
  { id: "HN", name: "Honduras" },
  { id: "SV", name: "El Salvador" },
  { id: "NI", name: "Nicaragua" },
  { id: "CO", name: "Colombia" },
  { id: "PE", name: "Peru" },
  { id: "BR", name: "Brazil" },
  { id: "OTHER", name: "Other" },
];

const CountrySelect = (props: { source: string; label: string; helperText: any; className?: string }) => (
  <SelectInput
    {...props}
    choices={countryChoices}
    defaultValue="US"
  />
);
