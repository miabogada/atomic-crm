import { required, useDataProvider } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useEffect, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";

import type { Account } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";

const accountOptionText = (record: Account) =>
  record?.name
    ? `${record.name} (${record.account_number})`
    : record?.account_number || "";

export const defaultCaseTypes = [
  "Adjustment of Status",
  "Asylum",
  "BIA Appeal",
  "Cancellation of Removal",
  "Citizenship Inquiry",
  "Consular Processing",
  "Deportation",
  "FBI",
  "FOIA",
  "I-130",
  "I-601 Waiver",
  "Inquiry",
  "K Visa",
  "Late Amnesty",
  "Legalization",
  "Letter",
  "Motion to Close",
  "MTR",
  "N-400",
  "NACARA",
  "Non-Client Consult",
  "Review File",
  "Suspension of Deportation",
  "TPS",
  "V Visa",
];

const caseTypeChoices = defaultCaseTypes.map((c) => ({ id: c, name: c }));

export const ContractInputs = () => {
  const { contractStatuses } = useConfigurationContext();
  const statusChoices = contractStatuses.map((s) => ({ id: s, name: s }));

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex gap-4 flex-col md:flex-row">
        <div className="flex-1">
          <AccountSelector />
        </div>
        <div className="flex-1">
          <SelectInput
            source="case_type"
            label="Case Type"
            choices={caseTypeChoices}
            helperText={false}
          />
        </div>
        <div className="flex-1">
          <SelectInput
            source="status"
            label="Status"
            choices={statusChoices}
            helperText={false}
          />
        </div>
      </div>

      <div className="flex gap-6 flex-col md:flex-row mt-4">
        <div className="flex flex-col gap-4 flex-1">
          <h6 className="text-lg font-semibold">Terms</h6>
          <TextInput source="contract_number" label="Contract Number" helperText="Auto-generated from account" />
          <NumberInput source="fee" label="Fee" helperText={false} />
          <NumberInput source="retainer" label="Retainer" helperText={false} />
          <NumberInput source="monthly_payment" label="Monthly Payment" helperText={false} />
          <CalculatedPayments />
        </div>
        <Separator orientation="vertical" className="flex-shrink-0 hidden md:block" />
        <div className="flex flex-col gap-4 flex-1">
          <h6 className="text-lg font-semibold">Dates & Details</h6>
          <DateInput source="date_opened" label="Date Opened" helperText={false} />
          <DateInput source="date_retainer" label="Date Retainer" helperText={false} />
          <DateInput source="date_first_payment" label="Date First Payment" helperText={false} />
          <TextInput source="work_description" label="Work Description" multiline helperText={false} />
        </div>
      </div>
    </div>
  );
};

const AccountSelector = () => {
  const { setValue, getValues } = useFormContext();
  const dataProvider = useDataProvider();
  const lastAccountId = useRef<string | null>(null);

  const handleAccountChange = (id: any) => {
    if (!id || id === lastAccountId.current) return;
    lastAccountId.current = id;
    dataProvider
      .getOne<Account>("accounts", { id })
      .then(({ data }) => {
        if (!data?.account_number) return;
        // Only auto-fill contract_number if it's currently empty
        const current = getValues("contract_number");
        if (!current) {
          setValue("contract_number", `Contract ${data.account_number}`);
        }
      });
  };

  return (
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
        onChange={handleAccountChange}
      />
    </ReferenceInput>
  );
};

const CalculatedPayments = () => {
  const { setValue } = useFormContext();
  const fee = useWatch({ name: "fee" });
  const retainer = useWatch({ name: "retainer" });
  const monthlyPayment = useWatch({ name: "monthly_payment" });

  useEffect(() => {
    const feeNum = Number(fee) || 0;
    const retainerNum = Number(retainer) || 0;
    const monthlyNum = Number(monthlyPayment) || 0;

    if (monthlyNum > 0 && feeNum > retainerNum) {
      const remaining = feeNum - retainerNum;
      const payments = Math.ceil(remaining / monthlyNum);
      setValue("num_payments", payments);
    }
  }, [fee, retainer, monthlyPayment, setValue]);

  return (
    <NumberInput
      source="num_payments"
      label="# Payments"
      helperText="Auto-calculated from fee, retainer, and monthly payment"
    />
  );
};
