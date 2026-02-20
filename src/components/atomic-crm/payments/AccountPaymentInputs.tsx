import { required } from "ra-core";
import { useWatch } from "react-hook-form";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { TextInput } from "@/components/admin/text-input";

import { useConfigurationContext } from "../root/ConfigurationContext";

export const AccountPaymentInputs = () => {
  const { paymentMethods } = useConfigurationContext();
  const methodChoices = paymentMethods.map((m) => ({ id: m, name: m }));
  const account_id = useWatch({ name: "account_id" });

  return (
    <div className="flex flex-col gap-4 p-1">
      <NumberInput
        source="amount"
        label="Amount ($)"
        validate={required()}
        helperText={false}
      />
      <DateInput
        source="date_received"
        label="Date Received"
        validate={required()}
        helperText={false}
      />
      {account_id && (
        <ReferenceInput
          source="contract_id"
          reference="account_contracts"
          filter={{ account_id }}
          sort={{ field: "id", order: "ASC" }}
        >
          <SelectInput
            label="Contract"
            helperText={false}
          />
        </ReferenceInput>
      )}
      <SelectInput
        source="payment_method"
        label="Payment Method"
        choices={methodChoices}
        validate={required()}
        helperText={false}
      />
      <ReferenceNumberInput />
      <TextInput
        source="notes"
        label="Notes"
        multiline
        helperText={false}
      />
    </div>
  );
};

const ReferenceNumberInput = () => {
  const method = useWatch({ name: "payment_method" });

  let label = "Reference Number";
  if (method === "CHECK") label = "Check Number";
  else if (method === "MONEY ORDER") label = "Money Order Number";
  else if (method === "CASH") label = "Cash Receipt Number";
  else if (method === "CREDIT CARD") label = "Transaction ID";
  else if (method === "WIRE TRANSFER") label = "Wire Reference Number";

  return (
    <TextInput
      source="reference_number"
      label={label}
      helperText={false}
    />
  );
};
