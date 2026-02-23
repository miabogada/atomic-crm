import { CheckSquare, Square } from "lucide-react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { RelativeDate } from "../misc/RelativeDate";
import { UserName } from "../users/UserName";
import type { ActivityTaskCompleted } from "../types";

type Props = {
  activity: ActivityTaskCompleted;
};

export function ActivityLogTaskCompleted({ activity }: Props) {
  const { task } = activity;
  const isCompleted = !!task.done_date;
  const link = task.account_id ? `/accounts/${task.account_id}/show` : undefined;
  const Icon = isCompleted ? CheckSquare : Square;

  return (
    <div className="p-0">
      <div className="flex flex-col space-y-2 w-full">
        <div className="flex items-start gap-2 w-full">
          <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-muted-foreground text-sm flex-grow">
            <ReferenceField source="user_id" reference="users" record={activity}>
              <UserName />
            </ReferenceField>{" "}
            {isCompleted ? "completed" : "has open"} task{" "}
            {link ? (
              <Link to={link} className="text-foreground hover:underline">
                {task.text}
              </Link>
            ) : (
              <span className="text-foreground">{task.text}</span>
            )}
            {task.account_id && (
              <>
                {" "}on{" "}
                <ReferenceField
                  source="account_id"
                  reference="accounts"
                  record={task}
                  link="show"
                >
                  <TextField source="name" />
                </ReferenceField>
              </>
            )}{" "}
            <RelativeDate date={activity.date} />
          </span>
        </div>
      </div>
    </div>
  );
}
