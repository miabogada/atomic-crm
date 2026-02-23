import { Clock, RotateCcw } from "lucide-react";
import { type Identifier, useDataProvider } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ACCOUNT_ACTIVITY_CREATED,
  CONTRACT_CREATED,
  PAYMENT_RECEIVED,
  TASK_COMPLETED,
} from "../consts";
import type {
  Activity,
  ActivityAccountActivityCreated,
  ActivityContractCreated,
  ActivityPaymentReceived,
  ActivityTaskCompleted,
} from "../types";
import type { CrmDataProvider } from "../providers/types";
import { ActivityLogContext } from "./ActivityLogContext";
import { ActivityItem } from "./ActivityLogIterator";

// ── Threading logic ───────────────────────────────────────────────────────────

type ThreadedActivity = { activity: Activity; depth: number };

/** Returns the activity-list ID of this item's parent, or null if top-level. */
function getParentActivityId(activity: Activity): string | null {
  if (activity.type === TASK_COMPLETED) {
    const { task } = activity as ActivityTaskCompleted;
    if (task.parent_type === "account_contracts" && task.parent_id != null)
      return `contract.${task.parent_id}.created`;
  }

  if (activity.type === PAYMENT_RECEIVED) {
    const { payment } = activity as ActivityPaymentReceived;
    if (payment.contract_id != null)
      return `contract.${payment.contract_id}.created`;
  }

  if (activity.type === ACCOUNT_ACTIVITY_CREATED) {
    const { accountActivity } = activity as ActivityAccountActivityCreated;
    if (accountActivity.parent_type === "account_contracts" && accountActivity.parent_id != null)
      return `contract.${accountActivity.parent_id}.created`;
    if (accountActivity.parent_type === "tasks" && accountActivity.parent_id != null)
      return `task.${accountActivity.parent_id}.completed`;
  }

  return null;
}

function buildThreadedActivities(activities: Activity[]): ThreadedActivity[] {
  const byId = new Map(activities.map((a) => [String(a.id), a]));
  const childrenMap = new Map<string, Activity[]>();
  const roots: Activity[] = [];

  for (const activity of activities) {
    const parentId = getParentActivityId(activity);
    if (parentId && byId.has(parentId)) {
      const list = childrenMap.get(parentId) ?? [];
      list.push(activity);
      childrenMap.set(parentId, list);
    } else {
      roots.push(activity);
    }
  }

  const result: ThreadedActivity[] = [];

  const addWithChildren = (activity: Activity, depth: number) => {
    result.push({ activity, depth });
    const kids = childrenMap.get(String(activity.id)) ?? [];
    // Children in chronological order (oldest first = natural thread order)
    kids
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      .forEach((child) => addWithChildren(child, depth + 1));
  };

  // Roots already sorted date DESC by getActivityLog
  roots.forEach((root) => addWithChildren(root, 0));

  return result;
}

// ── Components ────────────────────────────────────────────────────────────────

const INDENT_PX = [0, 20, 40] as const;

function ThreadedActivityLogRenderer({ activities }: { activities: Activity[] }) {
  const threaded = buildThreadedActivities(activities);

  return (
    <div className="space-y-0">
      {threaded.map(({ activity, depth }, index) => {
        const indent = INDENT_PX[Math.min(depth, 2)];
        return (
          <Fragment key={index}>
            <div style={{ paddingLeft: indent }}>
              {depth > 0 && (
                <div
                  className="border-l-2 border-muted pl-3"
                  style={{ marginLeft: 0 }}
                >
                  <ActivityItem activity={activity} />
                </div>
              )}
              {depth === 0 && <ActivityItem activity={activity} />}
            </div>
            <Separator className="my-3" />
          </Fragment>
        );
      })}
    </div>
  );
}

export function AccountActivityLog({ accountId }: { accountId: Identifier }) {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["accountActivityLog", accountId],
    queryFn: () => dataProvider.getAccountActivityLog(accountId),
  });

  if (isPending) {
    return (
      <div className="mt-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="space-y-2 mt-1" key={i}>
            <div className="flex flex-row space-x-2 items-center">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="w-full h-4" />
            </div>
            <Separator />
          </div>
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground mb-4">Error loading activity</p>
        <Button onClick={() => refetch()}>
          <RotateCcw />
          Retry
        </Button>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No activity yet
      </p>
    );
  }

  const chronological = [...data].reverse();

  return (
    <ActivityLogContext.Provider value="all">
      <ThreadedActivityLogRenderer activities={chronological} />
    </ActivityLogContext.Provider>
  );
}

export function AccountActivityLogWidget({ accountId }: { accountId: Identifier }) {
  return (
    <Accordion type="single" collapsible className="mt-4">
      <AccordionItem value="activity" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <Clock className="text-muted-foreground w-5 h-5" />
            <span className="text-xl font-semibold text-muted-foreground">
              All Activity
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <AccountActivityLog accountId={accountId} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
