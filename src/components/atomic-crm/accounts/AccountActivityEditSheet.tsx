import { type Identifier, useNotify } from "ra-core";
import { DeleteButton } from "@/components/admin";
import { WithRecord } from "ra-core";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { EditSheet } from "../misc/EditSheet";
import { ParentContractPicker } from "../misc/ParentContractPicker";
import { defaultActivityTypes } from "../root/defaultConfiguration";

export interface AccountActivityEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: Identifier;
}

const activityChoices = defaultActivityTypes.map((type) => ({
  id: type,
  name: type.charAt(0).toUpperCase() + type.slice(1),
}));

/**
 * Admin-only edit sheet for account activities.
 * Caller is responsible for checking isAdmin before rendering this component.
 */
export const AccountActivityEditSheet = ({
  open,
  onOpenChange,
  activityId,
}: AccountActivityEditSheetProps) => {
  const notify = useNotify();

  return (
    <EditSheet
      resource="account_activities"
      id={activityId}
      title="Edit Activity"
      redirect={false}
      mutationMode="pessimistic"
      mutationOptions={{
        onSuccess: () => {
          notify("Activity updated");
          onOpenChange(false);
        },
      }}
      deleteButton={
        <WithRecord
          render={() => (
            <DeleteButton
              variant="destructive"
              className="flex-1"
              redirect={false}
              onClick={() => {
                notify("Activity deleted");
                onOpenChange(false);
              }}
            />
          )}
        />
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <TextInput source="subject" label="Subject" className="m-0" helperText={false} />
      <TextInput source="body" label="Details" multiline className="m-0" helperText={false} />
      <DateInput source="date" helperText={false} />
      <SelectInput source="type" choices={activityChoices} helperText={false} />
      <ParentContractPicker />
    </EditSheet>
  );
};
