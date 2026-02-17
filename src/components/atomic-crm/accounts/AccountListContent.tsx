import {
  RecordContextProvider,
  useListContext,
} from "ra-core";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import type { Account } from "../types";

export const AccountListContent = () => {
  const {
    data: accounts,
    error,
    isPending,
  } = useListContext<Account>();

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  if (error) {
    return null;
  }

  return (
    <div className="md:divide-y">
      {accounts.map((account) => (
        <RecordContextProvider key={account.id} value={account}>
          <AccountItemContent account={account} />
        </RecordContextProvider>
      ))}

      {accounts.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">No accounts found</div>
        </div>
      )}
    </div>
  );
};

const AccountItemContent = ({ account }: { account: Account }) => {
  return (
    <div className="flex flex-row items-center px-4 py-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl">
      <Link
        to={`/accounts/${account.id}/show`}
        className="flex-1 flex flex-row gap-4 items-center"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold text-sm">
          {account.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{account.name}</div>
          <div className="text-sm text-muted-foreground">
            #{account.account_number}
            {account.nb_contacts != null &&
              ` \u00b7 ${account.nb_contacts} contact${account.nb_contacts !== 1 ? "s" : ""}`}
            {account.nb_contracts != null &&
              account.nb_contracts > 0 &&
              ` \u00b7 ${account.nb_contracts} contract${account.nb_contracts !== 1 ? "s" : ""}`}
            {account.nb_open_tasks != null &&
              account.nb_open_tasks > 0 &&
              ` \u00b7 ${account.nb_open_tasks} open task${account.nb_open_tasks !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {account.billing_city && (
            <span className="text-sm text-muted-foreground">
              {[account.billing_city, account.billing_state]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
          {account.categories && (
            <Badge
              variant={
                account.categories === "In Process" ? "default" : "secondary"
              }
            >
              {account.categories}
            </Badge>
          )}
        </div>
      </Link>
    </div>
  );
};
