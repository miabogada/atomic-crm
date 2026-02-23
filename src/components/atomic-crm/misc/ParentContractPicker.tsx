import { useGetList, useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AccountContract } from "../types";

const NONE = "__none__";

/**
 * A Select that lets admins re-parent a task or account activity to a
 * different contract within the same account, or promote it to account level
 * (no parent) by choosing "Account level".
 *
 * Must be rendered inside an ra-core EditBase / Form context.
 * Reads account_id from the record context and fetches that account's contracts.
 * Writes parent_type + parent_id back into the form.
 */
export function ParentContractPicker() {
  const record = useRecordContext();
  const { setValue } = useFormContext();
  const parentType = useWatch({ name: "parent_type" });
  const parentId = useWatch({ name: "parent_id" });

  const accountId = record?.account_id;

  const { data: contracts } = useGetList<AccountContract>(
    "account_contracts",
    {
      filter: { account_id: accountId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "contract_number", order: "ASC" },
    },
    { enabled: accountId != null },
  );

  if (!accountId) return null;

  const currentValue =
    parentType === "account_contracts" && parentId != null
      ? String(parentId)
      : NONE;

  const handleChange = (value: string) => {
    if (value === NONE) {
      setValue("parent_type", null, { shouldDirty: true });
      setValue("parent_id", null, { shouldDirty: true });
    } else {
      setValue("parent_type", "account_contracts", { shouldDirty: true });
      setValue("parent_id", value, { shouldDirty: true });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium leading-none">Contract</span>
      <Select value={currentValue} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Account level (no contract)</SelectItem>
          {contracts?.map((contract) => (
            <SelectItem key={contract.id} value={String(contract.id)}>
              {contract.contract_number ?? `#${contract.id}`}
              {contract.case_type ? ` · ${contract.case_type}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
