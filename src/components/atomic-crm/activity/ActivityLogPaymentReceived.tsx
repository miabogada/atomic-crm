import { Banknote } from "lucide-react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { RelativeDate } from "../misc/RelativeDate";
import { UserName } from "../users/UserName";
import type { ActivityPaymentReceived } from "../types";

type Props = {
  activity: ActivityPaymentReceived;
};

export function ActivityLogPaymentReceived({ activity }: Props) {
  const { payment } = activity;
  const link = `/accounts/${payment.account_id}/show`;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(payment.amount);

  return (
    <div className="p-0">
      <div className="flex flex-col space-y-2 w-full">
        <div className="flex items-start gap-2 w-full">
          <Banknote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-muted-foreground text-sm flex-grow">
            <ReferenceField source="user_id" reference="users" record={activity}>
              <UserName />
            </ReferenceField>{" "}
            recorded a{" "}
            <Link to={link} className="text-foreground hover:underline">
              {formattedAmount} payment
            </Link>{" "}
            for{" "}
            <ReferenceField
              source="account_id"
              reference="accounts"
              record={payment}
              link="show"
            >
              <TextField source="name" />
            </ReferenceField>{" "}
            <RelativeDate date={activity.date} />
          </span>
        </div>
      </div>
    </div>
  );
}
