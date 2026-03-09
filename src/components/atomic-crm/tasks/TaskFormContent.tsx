import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { required } from "ra-core";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { ParentContractPicker } from "../misc/ParentContractPicker";
import type { Sale } from "../types";

export const TaskFormContent = ({
  selectAccount,
  showParentPicker,
}: {
  selectAccount?: boolean;
  showParentPicker?: boolean;
}) => {
  const { taskTypes, taskStatuses } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4">
      <TextInput
        autoFocus
        source="text"
        label="Description"
        validate={required()}
        multiline
        className="m-0"
        helperText={false}
      />
      {selectAccount && (
        <ReferenceInput source="account_id" reference="accounts">
          <AutocompleteInput
            label="Account"
            optionText="name"
            helperText={false}
            validate={required()}
          />
        </ReferenceInput>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DateInput source="due_date" helperText={false} validate={required()} />
        <SelectInput
          source="type"
          validate={required()}
          choices={taskTypes.map((type) => ({
            id: type,
            name: type,
          }))}
          helperText={false}
        />
        <SelectInput
          source="status"
          validate={required()}
          choices={taskStatuses.map((status) => ({
            id: status,
            name: status,
          }))}
          helperText={false}
        />
      </div>
      <TextInput
        source="notes"
        label="Notes"
        multiline
        minRows={3}
        className="m-0"
        helperText={false}
      />
      {showParentPicker && <ParentContractPicker />}
      <ReferenceInput
        source="user_id"
        reference="users"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          label="Assignee"
          optionText={saleOptionRenderer}
          helperText={false}
          validate={required()}
        />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;
