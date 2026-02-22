import { ScrollText } from "lucide-react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { RelativeDate } from "../misc/RelativeDate";
import { UserName } from "../users/UserName";
import type { ActivityContractCreated } from "../types";

type Props = {
  activity: ActivityContractCreated;
};

export function ActivityLogContractCreated({ activity }: Props) {
  const { contract } = activity;
  const link = `/account_contracts/${contract.id}/show`;

  return (
    <div className="p-0">
      <div className="flex flex-col space-y-1 w-full">
        <div className="flex items-start gap-2 w-full">
          <ScrollText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-muted-foreground text-sm flex-grow">
            <ReferenceField source="user_id" reference="users" record={activity}>
              <UserName />
            </ReferenceField>{" "}
            opened contract{" "}
            <Link to={link} className="text-foreground hover:underline font-medium">
              {contract.contract_number ?? `#${contract.id}`}
            </Link>
            {contract.case_type && (
              <span className="text-muted-foreground"> · {contract.case_type}</span>
            )}{" "}
            <RelativeDate date={activity.date} />
          </span>
        </div>
        {(contract.fee != null || contract.status) && (
          <div className="ml-6 text-xs text-muted-foreground">
            {contract.status && <span className="mr-3">{contract.status}</span>}
            {contract.fee != null && (
              <span>
                ${Number(contract.fee).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
