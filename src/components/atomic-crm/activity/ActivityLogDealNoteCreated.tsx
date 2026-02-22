import { FileText } from "lucide-react";
import type { RaRecord } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { RelativeDate } from "../misc/RelativeDate";
import { UserName } from "../users/UserName";
import type { ActivityDealNoteCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogNote } from "./ActivityLogNote";
import { useIsMobile } from "@/hooks/use-mobile";

type ActivityLogDealNoteCreatedProps = {
  activity: RaRecord & ActivityDealNoteCreated;
};

export function ActivityLogDealNoteCreated({
  activity,
}: ActivityLogDealNoteCreatedProps) {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();
  const { dealNote } = activity;
  return (
    <ActivityLogNote
      header={
        <div className="flex flex-row items-start gap-2 flex-grow">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />

          <span className="text-muted-foreground text-sm flex-grow">
            <ReferenceField
              source="user_id"
              reference="users"
              record={activity}
              link={false}
            >
              <UserName />
            </ReferenceField>{" "}
            added a note about deal{" "}
            <ReferenceField
              source="deal_id"
              reference="deals"
              record={dealNote}
              link={isMobile ? false : "show"}
            />
            {context !== "company" && (
              <>
                {" "}
                at{" "}
                <ReferenceField
                  source="deal_id"
                  reference="deals"
                  record={dealNote}
                  link={false}
                >
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link="show"
                  />
                </ReferenceField>{" "}
                <RelativeDate date={activity.date} />
              </>
            )}
          </span>

          {context === "company" && (
            <span className="text-muted-foreground text-sm">
              <RelativeDate date={activity.date} />
            </span>
          )}
        </div>
      }
      text={dealNote.text}
      link={isMobile ? false : `/deals/${dealNote.deal_id}/show`}
    />
  );
}
