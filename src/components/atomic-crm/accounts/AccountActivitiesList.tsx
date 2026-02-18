import { formatRelative } from "date-fns";
import { useListContext, useRecordContext } from "ra-core";
import { Badge } from "@/components/ui/badge";

import type { Account, AccountActivity } from "../types";
import { AddActivity } from "./AddActivity";

const formatParentType = (t: string) =>
  t.replace("account_", "").replace(/^\w/, (c) => c.toUpperCase());

export const AccountActivitiesList = () => {
  const { data, isPending } = useListContext<AccountActivity>();
  const account = useRecordContext<Account>();

  if (isPending) return null;

  const now = Date.now();

  return (
    <div>
      {account && (
        <div className="flex justify-end mb-2">
          <AddActivity account_id={account.id} />
        </div>
      )}

      {!data?.length ? (
        <div className="text-center text-muted-foreground py-8">
          No activities yet
        </div>
      ) : (
        <div className="divide-y">
          {data.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 py-3 px-2"
            >
              <div className="flex-1">
                <div className="font-medium">{activity.subject}</div>
                {activity.body && (
                  <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {activity.body}
                  </div>
                )}
                {activity.parent_type && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Re: {formatParentType(activity.parent_type)}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {activity.type && (
                  <Badge variant="outline">{activity.type}</Badge>
                )}
                {activity.date && (
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(activity.date, now)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
