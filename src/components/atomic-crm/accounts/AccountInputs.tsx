import { required } from "ra-core";
import { Separator } from "@/components/ui/separator";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { DateInput } from "@/components/admin/date-input";
import { BooleanInput } from "@/components/admin/boolean-input";

import type { Sale } from "../types";
import {
  defaultAccountCategories,
} from "../root/defaultConfiguration";

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
      <TextInput source="name" validate={required()} helperText={false} />
      <SelectInput
        source="categories"
        choices={categoryChoices}
        helperText={false}
        defaultValue="In Process"
      />
      <TextInput source="phone" helperText={false} />
      <TextInput source="email" helperText={false} />
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

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;
