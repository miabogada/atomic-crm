import {
  required,
  useGetIdentity,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { CreateSheet } from "../misc/CreateSheet";
import { defaultActivityTypes } from "../root/defaultConfiguration";

export interface ActivityCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account_id: Identifier;
  parent_type?: string;
  parent_id?: Identifier;
}

export const ActivityCreateSheet = ({
  open,
  onOpenChange,
  account_id,
  parent_type,
  parent_id,
}: ActivityCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();

  if (!identity) return null;

  const activityChoices = defaultActivityTypes.map((type) => ({
    id: type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
  }));

  return (
    <CreateSheet
      resource="account_activities"
      title="Add Activity"
      redirect={false}
      defaultValues={{
        account_id,
        parent_type: parent_type ?? null,
        parent_id: parent_id ?? null,
        user_id: identity.id,
        date: new Date().toISOString().slice(0, 10),
      }}
      mutationOptions={{
        onSuccess: () => {
          notify("Activity added");
          refresh();
          onOpenChange(false);
        },
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <TextInput
        autoFocus
        source="subject"
        label="Subject"
        validate={required()}
        helperText={false}
      />
      <TextInput source="body" label="Details" multiline helperText={false} />
      <DateInput source="date" helperText={false} validate={required()} />
      <SelectInput
        source="type"
        choices={activityChoices}
        helperText={false}
      />
    </CreateSheet>
  );
};
