import { useState } from "react";
import { Activity } from "lucide-react";
import {
  CreateBase,
  Form,
  type Identifier,
  required,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { SaveButton } from "@/components/admin/form";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { defaultActivityTypes } from "../root/defaultConfiguration";
import type { Account } from "../types";

export const AddActivity = ({
  account_id,
  parent_type,
  parent_id,
}: {
  account_id: Identifier;
  parent_type?: string;
  parent_id?: Identifier;
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);

  const { data: account } = useGetOne<Account>(
    "accounts",
    { id: account_id },
    { enabled: account_id != null },
  );

  const handleSuccess = () => {
    setOpen(false);
    notify("Activity added");
    refresh();
  };

  if (!identity) return null;

  const activityChoices = defaultActivityTypes.map((type) => ({
    id: type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
  }));

  return (
    <>
      <div className="my-2">
        <Button
          variant="outline"
          className="h-6 cursor-pointer"
          onClick={() => setOpen(true)}
          size="sm"
        >
          <Activity className="w-4 h-4" />
          Add activity
        </Button>
      </div>

      <CreateBase
        resource="account_activities"
        record={{
          account_id,
          parent_type: parent_type ?? null,
          parent_id: parent_id ?? null,
          user_id: identity.id,
          date: new Date().toISOString(),
        }}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  Add activity for {account?.name ?? "account"}
                </DialogTitle>
              </DialogHeader>
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
                  <DateInput
                    source="date"
                    helperText={false}
                    validate={required()}
                  />
                  <SelectInput
                    source="type"
                    choices={activityChoices}
                    helperText={false}
                  />
                </div>
              </div>
              <DialogFooter className="w-full justify-end">
                <SaveButton />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    </>
  );
};
