import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import {
  type Identifier,
  required,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";

import { CreateSheet } from "../misc/CreateSheet";
import { defaultActivityTypes } from "../root/defaultConfiguration";

export interface AccountActivityCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: Identifier;
  parentType?: string;
  parentId?: Identifier;
}

export const AccountActivityCreateSheet = ({
  open,
  onOpenChange,
  accountId,
  parentType,
  parentId,
}: AccountActivityCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();

  if (!identity) return null;

  const handleSuccess = () => {
    notify("Activity added");
    refresh();
    onOpenChange(false);
  };

  const activityChoices = defaultActivityTypes.map((type) => ({
    id: type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
  }));

  return (
    <CreateSheet
      resource="account_activities"
      title="Add Activity"
      redirect={false}
      record={{
        account_id: accountId,
        parent_type: parentType || null,
        parent_id: parentId || null,
        sales_id: identity.id,
        date: new Date().toISOString(),
      }}
      mutationOptions={{
        onSuccess: handleSuccess,
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-4">
        <TextInput
          autoFocus
          source="subject"
          label="Subject"
          validate={required()}
          className="m-0"
          helperText={false}
        />
        <TextInput
          source="body"
          label="Details"
          multiline
          className="m-0"
          helperText={false}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DateInput source="date" helperText={false} validate={required()} />
          <SelectInput
            source="type"
            choices={activityChoices}
            helperText={false}
          />
        </div>
      </div>
    </CreateSheet>
  );
};
