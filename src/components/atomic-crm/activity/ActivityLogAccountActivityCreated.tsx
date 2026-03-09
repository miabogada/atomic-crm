import { Banknote, FileText, Mail, Paperclip, Phone, Users } from "lucide-react";
import { type ElementType, useState } from "react";

import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { RelativeDate } from "../misc/RelativeDate";
import { UserName } from "../users/UserName";
import { ActivityView } from "../accounts/ActivityView";
import { AccountActivityEditSheet } from "../accounts/AccountActivityEditSheet";
import type { AccountActivity, ActivityAccountActivityCreated } from "../types";

const activityTypeIcon: Record<string, ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  document: Paperclip,
  note: FileText,
  payment: Banknote,
};

type Props = {
  activity: ActivityAccountActivityCreated;
};

export function ActivityLogAccountActivityCreated({ activity }: Props) {
  const { accountActivity } = activity;
  const Icon = activityTypeIcon[accountActivity.type] ?? FileText;

  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  return (
    <div className="p-0">
      <div className="flex flex-col space-y-2 w-full">
        <div className="flex flex-row space-x-1 items-center w-full">
          <div className="flex items-start gap-2 w-full">
            <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-muted-foreground text-sm flex-grow">
              <ReferenceField
                source="user_id"
                reference="users"
                record={activity}
              >
                <UserName />
              </ReferenceField>{" "}
              logged an activity on{" "}
              <ReferenceField
                source="account_id"
                reference="accounts"
                record={accountActivity}
                link="show"
              >
                <TextField source="name" />
              </ReferenceField>
              {": "}
              <span
                className="text-foreground hover:underline cursor-pointer"
                onClick={() => setOpenView(true)}
              >
                {accountActivity.subject}
              </span>{" "}
              <RelativeDate date={activity.date} />
            </span>
          </div>
        </div>
        {accountActivity.body && (
          <div
            className="md:max-w-150 cursor-pointer hover:bg-muted rounded transition-colors"
            onClick={() => setOpenView(true)}
          >
            <p className="text-sm line-clamp-3 overflow-hidden">
              {accountActivity.body}
            </p>
          </div>
        )}
      </div>

      <ActivityView
        activity={accountActivity as AccountActivity}
        open={openView}
        close={() => setOpenView(false)}
        onEdit={() => setOpenEdit(true)}
      />

      {openEdit && (
        <AccountActivityEditSheet
          open={openEdit}
          onOpenChange={(open) => { if (!open) setOpenEdit(false); }}
          activityId={accountActivity.id as number}
        />
      )}
    </div>
  );
}
