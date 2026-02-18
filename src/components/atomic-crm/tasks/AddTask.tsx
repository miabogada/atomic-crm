import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  RecordRepresentation,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
  useUpdate,
  type Identifier,
} from "ra-core";
import { useState } from "react";
import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { TaskFormContent } from "./TaskFormContent";
import type { Account } from "../types";

export const AddTask = ({
  selectContact,
  display = "chip",
  account_id,
  parent_type,
  parent_id,
}: {
  selectContact?: boolean;
  display?: "chip" | "icon";
  account_id?: Identifier;
  parent_type?: string;
  parent_id?: Identifier;
}) => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const contact = useRecordContext();
  const [open, setOpen] = useState(false);

  const { data: account } = useGetOne<Account>(
    "accounts",
    { id: account_id! },
    { enabled: account_id != null },
  );

  const handleOpen = () => {
    setOpen(true);
  };

  const handleSuccess = async (data: any) => {
    setOpen(false);
    if (data.contact_id) {
      const contact = await dataProvider.getOne("contacts", {
        id: data.contact_id,
      });
      if (contact.data) {
        await update("contacts", {
          id: contact.data.id,
          data: { last_seen: new Date().toISOString() },
          previousData: contact.data,
        });
      }
    }
    if (data.account_id) {
      refresh();
    }
    notify("Task added");
  };

  if (!identity) return null;

  const isAccountTask = account_id != null;
  const title = isAccountTask
    ? `Create a new task for ${account?.name ?? "account"}`
    : !selectContact
      ? "Create a new task for "
      : "Create a new task";

  return (
    <>
      {display === "icon" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="p-2 cursor-pointer"
                onClick={handleOpen}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create task</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="my-2">
          <Button
            variant="outline"
            className="h-6 cursor-pointer"
            onClick={handleOpen}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Add task
          </Button>
        </div>
      )}

      <CreateBase
        resource="tasks"
        record={{
          type: "None",
          status: "To do",
          contact_id: isAccountTask ? null : contact?.id,
          account_id: account_id ?? null,
          parent_type: parent_type ?? null,
          parent_id: parent_id ?? null,
          due_date: new Date().toISOString().slice(0, 10),
          sales_id: identity.id,
        }}
        transform={(data) => {
          const dueDate = new Date(data.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return {
            ...data,
            due_date: dueDate.toISOString(),
          };
        }}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {title}
                  {!isAccountTask && !selectContact && (
                    <RecordRepresentation
                      record={contact}
                      resource="contacts"
                    />
                  )}
                </DialogTitle>
              </DialogHeader>
              <TaskFormContent selectContact={selectContact} />
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
