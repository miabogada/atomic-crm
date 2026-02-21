import { useState } from "react";
import { formatRelative } from "date-fns";
import { useGetIdentity, useGetOne, useListContext, useRecordContext } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Account, AccountActivity, Sale } from "../types";
import { activityTypeColors } from "../misc/statusColors";
import { AddActivity } from "./AddActivity";
import { AccountActivityEditSheet } from "./AccountActivityEditSheet";

const formatParentType = (t: string) =>
  t.replace("account_", "").replace(/^\w/, (c) => c.toUpperCase());

export const AccountActivitiesList = () => {
  const { data, isPending } = useListContext<AccountActivity>();
  const account = useRecordContext<Account>();
  const [editingId, setEditingId] = useState<number | null>(null);

  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const isAdmin = !!currentUser?.administrator;

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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">{activity.subject}</span>
                  {activity.type && (
                    <Badge
                      variant="outline"
                      className={`text-xs py-0 px-1.5 ${activityTypeColors[activity.type] ?? ""}`}
                    >
                      {activity.type}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5 truncate">
                  {activity.date && formatRelative(activity.date, now)}
                  {activity.body && <span> &middot; {activity.body}</span>}
                  {activity.parent_type && (
                    <span> &middot; Re: {formatParentType(activity.parent_type)}</span>
                  )}
                  {activity.user_id && (
                    <ReferenceField<AccountActivity, Sale>
                      source="user_id"
                      reference="users"
                      record={activity}
                      link={false}
                      className="inline text-sm text-muted-foreground"
                      render={({ referenceRecord }) => {
                        if (!referenceRecord) return null;
                        return (
                          <span> &middot; {referenceRecord.first_name} {referenceRecord.last_name}</span>
                        );
                      }}
                    />
                  )}
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={() => setEditingId(activity.id as number)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {editingId != null && (
        <AccountActivityEditSheet
          open={editingId != null}
          onOpenChange={(open) => { if (!open) setEditingId(null); }}
          activityId={editingId}
        />
      )}
    </div>
  );
};
