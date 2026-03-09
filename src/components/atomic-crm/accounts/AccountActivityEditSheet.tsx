import { EditBase, Form, useNotify, type Identifier } from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { SaveButton } from "@/components/admin/form";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export const AccountActivityEditSheet = ({
  open,
  onOpenChange,
  activityId,
}: AccountActivityEditSheetProps) => {
  const notify = useNotify();
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {activityId && (
        <EditBase
          id={activityId}
          resource="account_activities"
          className="mt-0"
          mutationMode="pessimistic"
          mutationOptions={{
            onSuccess: () => {
              close();
              notify("Activity updated");
            },
          }}
          redirect={false}
        >
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Edit Activity</DialogTitle>
              </DialogHeader>
              <TextInput source="subject" label="Subject" className="m-0" helperText={false} />
              <TextInput source="body" label="Details" multiline className="m-0" helperText={false} />
              <DateInput source="date" helperText={false} />
              <SelectInput source="type" choices={activityChoices} helperText={false} />
              <ParentContractPicker />
              <DialogFooter className="w-full sm:justify-between gap-4">
                <DeleteButton
                  mutationOptions={{
                    onSuccess: () => {
                      close();
                      notify("Activity deleted");
                    },
                  }}
                  redirect={false}
                />
                <SaveButton label="Save" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </EditBase>
      )}
    </Dialog>
  );
};
