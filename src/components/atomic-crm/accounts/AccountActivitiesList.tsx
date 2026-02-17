import { formatRelative } from "date-fns";
import { useListContext } from "ra-core";
import { Badge } from "@/components/ui/badge";

import type { AccountActivity } from "../types";

export const AccountActivitiesList = () => {
  const { data, isPending } = useListContext<AccountActivity>();

  if (isPending) return null;

  if (!data?.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No activities yet
      </div>
    );
  }

  const now = Date.now();

  return (
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
                Re: {activity.parent_type} #{activity.parent_id}
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
  );
};
