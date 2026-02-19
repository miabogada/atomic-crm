import { required } from "ra-core";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { Separator } from "@/components/ui/separator";

import type { Account } from "../types";

const accountOptionText = (record: Account) =>
  record?.name
    ? `${record.name} (${record.account_number})`
    : record?.account_number || "";

export const ContactInputs = () => (
  <div className="flex flex-col gap-2 p-1">
    <div className="flex gap-4 flex-col md:flex-row">
      <div className="flex-1">
        <ReferenceInput
          reference="accounts"
          source="account_id"
          sort={{ field: "name", order: "ASC" }}
        >
          <AutocompleteInput
            label="Account"
            optionText={accountOptionText}
            validate={required()}
            helperText={false}
            filterToQuery={(text: string) => ({
              "name@ilike": `%${text}%`,
            })}
          />
        </ReferenceInput>
      </div>
      <div className="flex-1">
        <ReferenceInput
          reference="contact_types"
          source="contact_type_id"
        >
          <SelectInput
            label="Contact Type"
            optionText="name"
            helperText={false}
          />
        </ReferenceInput>
      </div>
    </div>

    <div className="flex gap-4 flex-col md:flex-row">
      <div className="flex-1">
        <TextInput
          source="first_name"
          label="First Name"
          validate={required()}
          helperText={false}
        />
      </div>
      <div className="flex-1">
        <TextInput
          source="last_name"
          label="Last Name"
          helperText={false}
        />
      </div>
    </div>

    <div className="flex gap-4 flex-col md:flex-row">
      <div className="flex-1">
        <TextInput source="email" label="Email" helperText={false} />
      </div>
      <div className="flex-1">
        <TextInput source="phone" label="Phone" helperText={false} />
      </div>
    </div>

    <Separator className="my-2" />

    <h6 className="text-lg font-semibold">Address</h6>
    <TextInput source="address_street" label="Street" helperText={false} />
    <div className="flex gap-4 flex-col md:flex-row">
      <div className="flex-1">
        <TextInput source="address_city" label="City" helperText={false} />
      </div>
      <div className="flex-1">
        <TextInput source="address_state" label="State" helperText={false} />
      </div>
      <div className="flex-1">
        <TextInput source="address_postal_code" label="Postal Code" helperText={false} />
      </div>
    </div>
    <TextInput source="address_country" label="Country" helperText={false} />

    <BooleanInput source="is_billing_contact" label="Billing Contact" />
  </div>
);
