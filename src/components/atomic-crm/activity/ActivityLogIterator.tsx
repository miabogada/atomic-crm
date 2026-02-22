import { Fragment, useState } from "react";

import { Separator } from "@/components/ui/separator";
import {
  ACCOUNT_ACTIVITY_CREATED,
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
  PAYMENT_RECEIVED,
  TASK_COMPLETED,
} from "../consts";
import type { Activity } from "../types";
import { ActivityLogAccountActivityCreated } from "./ActivityLogAccountActivityCreated";
import { ActivityLogCompanyCreated } from "./ActivityLogCompanyCreated";
import { ActivityLogContactCreated } from "./ActivityLogContactCreated";
import { ActivityLogContactNoteCreated } from "./ActivityLogContactNoteCreated";
import { ActivityLogDealCreated } from "./ActivityLogDealCreated";
import { ActivityLogDealNoteCreated } from "./ActivityLogDealNoteCreated";
import { ActivityLogPaymentReceived } from "./ActivityLogPaymentReceived";
import { ActivityLogTaskCompleted } from "./ActivityLogTaskCompleted";

type ActivityLogIteratorProps = {
  activities: Activity[];
  pageSize: number;
};

export function ActivityLogIterator({
  activities,
  pageSize,
}: ActivityLogIteratorProps) {
  const [activitiesDisplayed, setActivityDisplayed] = useState(pageSize);

  const filteredActivities = activities.slice(0, activitiesDisplayed);

  return (
    <div className="space-y-4">
      {filteredActivities.map((activity, index) => (
        <Fragment key={index}>
          <ActivityItem key={activity.id} activity={activity} />
          <Separator />
        </Fragment>
      ))}

      {activitiesDisplayed < activities.length && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setActivityDisplayed(
              (activitiesDisplayed) => activitiesDisplayed + pageSize,
            );
          }}
          className="flex w-full justify-center text-sm underline hover:no-underline"
        >
          Load more activity
        </a>
      )}
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  if (activity.type === COMPANY_CREATED) {
    return <ActivityLogCompanyCreated activity={activity} />;
  }

  if (activity.type === CONTACT_CREATED) {
    return <ActivityLogContactCreated activity={activity} />;
  }

  if (activity.type === CONTACT_NOTE_CREATED) {
    return <ActivityLogContactNoteCreated activity={activity} />;
  }

  if (activity.type === DEAL_CREATED) {
    return <ActivityLogDealCreated activity={activity} />;
  }

  if (activity.type === DEAL_NOTE_CREATED) {
    return <ActivityLogDealNoteCreated activity={activity} />;
  }

  if (activity.type === ACCOUNT_ACTIVITY_CREATED) {
    return <ActivityLogAccountActivityCreated activity={activity} />;
  }

  if (activity.type === TASK_COMPLETED) {
    return <ActivityLogTaskCompleted activity={activity} />;
  }

  if (activity.type === PAYMENT_RECEIVED) {
    return <ActivityLogPaymentReceived activity={activity} />;
  }

  return null;
}
