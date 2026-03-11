import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
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
  selectAccount,
  display = "chip",
  account_id,
  parent_type,
  parent_id,
}: {
  selectAccount?: boolean;
  display?: "chip" | "icon";
  account_id?: Identifier;
  parent_type?: string;
  parent_id?: Identifier;
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
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
    if (data.account_id) {
      refresh();
    }
    notify("Task added");
  };

  if (!identity) return null;

  const isAccountTask = account_id != null;
  const title = isAccountTask
    ? `Create a new task for ${account?.name ?? "account"}`
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
          contact_id: null,
          account_id: account_id ?? null,
          parent_type: parent_type ?? null,
          parent_id: parent_id ?? null,
          due_date: new Date().toISOString().slice(0, 10),
          user_id: identity.id,
        }}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>
              <TaskFormContent selectAccount={selectAccount} />
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
