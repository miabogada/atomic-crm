import { useState, useEffect } from "react";
import { required, useGetList, type Identifier } from "ra-core";
import { useWatch, useFormContext } from "react-hook-form";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { TextInput } from "@/components/admin/text-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { ContractPaymentSchedule } from "../types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const AccountPaymentInputs = ({
  onScheduleRowSelect,
}: {
  onScheduleRowSelect?: (scheduleRowId: Identifier | null) => void;
} = {}) => {
  const { paymentMethods } = useConfigurationContext();
  const methodChoices = paymentMethods.map((m) => ({ id: m, name: m }));
  const account_id = useWatch({ name: "account_id" });
  const contract_id = useWatch({ name: "contract_id" });

  return (
    <div className="flex flex-col gap-4 p-1">
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
      {contract_id && onScheduleRowSelect && (
        <ScheduledPaymentPicker
          contractId={contract_id}
          onSelect={onScheduleRowSelect}
        />
      )}
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

const ScheduledPaymentPicker = ({
  contractId,
  onSelect,
}: {
  contractId: Identifier;
  onSelect: (id: Identifier | null) => void;
}) => {
  const [value, setValue] = useState<string>("__none__");

  const { data: rows } = useGetList<ContractPaymentSchedule>(
    "contract_payment_schedule",
    {
      filter: { "contract_id@eq": contractId, "payment_id@is": null },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "payment_number", order: "ASC" },
    },
  );

  useEffect(() => {
    setValue("__none__");
    onSelect(null);
  }, [contractId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows?.length) return null;

  const { setValue: setFormValue } = useFormContext();

  const handleChange = (val: string) => {
    setValue(val);
    if (val === "__none__") {
      onSelect(null);
    } else {
      const row = rows?.find((r) => String(r.id) === val);
      if (row) {
        setFormValue("amount", Number(row.amount), { shouldValidate: true, shouldDirty: true });
      }
      onSelect(val);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium leading-none">Scheduled Payment</span>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="None — unscheduled" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None — unscheduled</SelectItem>
          {rows.map((row) => (
            <SelectItem key={row.id} value={String(row.id)}>
              {row.payment_number === 0 ? "R" : row.payment_number}
              {" · "}${fmt(Number(row.amount))} due {row.due_date}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
