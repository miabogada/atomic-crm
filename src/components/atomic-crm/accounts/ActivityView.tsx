import { useGetOne } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Account, AccountActivity, Sale } from "../types";
import { activityTypeColors } from "../misc/statusColors";

export const ActivityView = ({
  activity,
  open,
  close,
  onEdit,
}: {
  activity: AccountActivity;
  open: boolean;
  close: () => void;
  onEdit?: () => void;
}) => {
  const { data: account } = useGetOne<Account>(
    "accounts",
    { id: activity.account_id },
    { enabled: !!activity.account_id },
  );
  const { data: assignee } = useGetOne<Sale>(
    "users",
    { id: activity.user_id! },
    { enabled: !!activity.user_id },
  );

  const parentLabel = activity.parent_type
    ?.replace("account_", "")
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="lg:max-w-2xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{activity.subject}</span>
            {activity.type && (
              <Badge
                variant="outline"
                className={`text-xs py-0 px-1.5 ${activityTypeColors[activity.type] ?? ""}`}
              >
                {activity.type}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {activity.date && (
              <Field label="Date" value={formatDate(activity.date)} />
            )}
            {assignee && (
              <Field
                label="By"
                value={`${assignee.first_name} ${assignee.last_name}`}
              />
            )}
            {account && <Field label="Account" value={account.name} />}
            {parentLabel && (
              <Field label="Related to" value={parentLabel} />
            )}
          </div>

          {activity.body && (
            <div className="border-t pt-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Details
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3 max-h-96 overflow-y-auto">
                {activity.body}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                close();
                onEdit();
              }}
            >
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <span className="text-muted-foreground">{label}: </span>
    <span>{value}</span>
  </div>
);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
};
