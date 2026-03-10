import { useGetList, useRecordContext, type Identifier } from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";
import { ShowButton } from "@/components/admin/show-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Button } from "@/components/ui/button";
import { CircleX } from "lucide-react";

import { AsideSection } from "../misc/AsideSection";
import { AccountDeleteWarning } from "../misc/DeleteWarnings";
import type { Account, AccountContract } from "../types";

export const AccountAside = ({
  link = "edit",
  contractFilter = null,
  onContractFilter,
  activeTab,
}: {
  link?: "edit" | "show";
  contractFilter?: Identifier | null;
  onContractFilter?: (id: Identifier | null) => void;
  activeTab?: string;
}) => {
  const record = useRecordContext<Account>();

  const { data: contracts } = useGetList<AccountContract>(
    "account_contracts",
    {
      filter: { account_id: record?.id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "date_opened", order: "ASC" },
    },
    { enabled: !!record?.id },
  );

  if (!record) return null;

  return (
    <div className="hidden md:block w-64 min-w-64 text-sm">
      <div className="mb-4 -ml-1">
        {link === "edit" ? (
          <EditButton label="Edit Account" />
        ) : (
          <ShowButton label="Show Account" />
        )}
      </div>

      <AsideSection title="Status">
        <div className="flex flex-col gap-1">
          <div>
            <span className="text-muted-foreground">Category:</span>{" "}
            {record.categories || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Opened:</span>{" "}
            {record.date_opened || "—"}
          </div>
          {record.date_closed && (
            <div>
              <span className="text-muted-foreground">Closed:</span>{" "}
              {record.date_closed}
            </div>
          )}
        </div>
      </AsideSection>

      <AsideSection title="Team">
        <div className="flex flex-col gap-1">
          {record.attorney_id && (
            <div>
              <span className="text-muted-foreground">Attorney:</span>{" "}
              <ReferenceField source="attorney_id" reference="users" link={false}>
                <TextField source="first_name" />{" "}
                <TextField source="last_name" />
              </ReferenceField>
            </div>
          )}
          {record.law_clerk_id && (
            <div>
              <span className="text-muted-foreground">Law Clerk:</span>{" "}
              <ReferenceField source="law_clerk_id" reference="users" link={false}>
                <TextField source="first_name" />{" "}
                <TextField source="last_name" />
              </ReferenceField>
            </div>
          )}
          {record.legal_assistant_id && (
            <div>
              <span className="text-muted-foreground">Legal Asst:</span>{" "}
              <ReferenceField source="legal_assistant_id" reference="users" link={false}>
                <TextField source="first_name" />{" "}
                <TextField source="last_name" />
              </ReferenceField>
            </div>
          )}
        </div>
      </AsideSection>

      <AsideSection title="Billing Address">
        <div className="flex flex-col gap-0.5">
          {record.billing_contact_name && (
            <div>{record.billing_contact_name}</div>
          )}
          {record.billing_street && <div>{record.billing_street}</div>}
          {(record.billing_city ||
            record.billing_state ||
            record.billing_postal_code) && (
            <div>
              {[record.billing_city, record.billing_state, record.billing_postal_code]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
          {record.billing_country && <div>{record.billing_country}</div>}
          {!record.billing_contact_name && (
            <span className="text-muted-foreground italic">
              No billing contact set
            </span>
          )}
        </div>
      </AsideSection>

      {record.referred_by && (
        <AsideSection title="Referred By">
          <div>{record.referred_by}</div>
        </AsideSection>
      )}

      {onContractFilter &&
        contracts &&
        contracts.length > 0 &&
        (activeTab === "tasks" || activeTab === "payments") && (
        <AsideSection title="Filter by Contract">
          <div className="flex flex-col gap-0.5">
            <Button
              variant={contractFilter == null ? "secondary" : "ghost"}
              size="sm"
              className="cursor-pointer flex flex-row items-center justify-between gap-2 px-2.5 w-full h-8"
              onClick={() => onContractFilter(null)}
            >
              All Items
            </Button>
            {contracts.map((c) => {
              const isSelected = contractFilter === c.id;
              const label = c.contract_number ?? `Contract #${c.id}`;
              return (
                <Button
                  key={c.id as string}
                  variant={isSelected ? "secondary" : "ghost"}
                  size="sm"
                  className="cursor-pointer flex flex-row items-center justify-between gap-2 px-2.5 w-full h-8"
                  onClick={() => onContractFilter(isSelected ? null : c.id)}
                >
                  <span className="truncate text-left">
                    {label}
                    {c.case_type && (
                      <span className="text-muted-foreground font-normal"> · {c.case_type}</span>
                    )}
                  </span>
                  {isSelected && <CircleX className="opacity-50 shrink-0" />}
                </Button>
              );
            })}
          </div>
        </AsideSection>
      )}

      {link !== "edit" && (
        <div className="mt-6 pt-6 border-t flex flex-col gap-2 items-start">
          <DeleteButton
            className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
            size="sm"
            confirmContent={<AccountDeleteWarning />}
          />
        </div>
      )}
    </div>
  );
};
