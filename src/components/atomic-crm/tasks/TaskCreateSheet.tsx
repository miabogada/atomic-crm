import {
  type Identifier,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { TaskFormContent } from "./TaskFormContent";

export interface TaskCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account_id?: Identifier;
  parent_type?: string;
  parent_id?: Identifier;
}

export const TaskCreateSheet = ({
  open,
  onOpenChange,
  account_id,
  parent_type,
  parent_id,
}: TaskCreateSheetProps) => {
  const { identity } = useGetIdentity();

  const selectAccount = account_id == null;
  const { data: account } = useGetOne(
    "accounts",
    { id: account_id! },
    { enabled: account_id != null },
  );
  const notify = useNotify();
  const refresh = useRefresh();

  if (!identity) return null;

  const handleSuccess = async () => {
    notify("Task added");
    if (account_id) {
      refresh();
    }
    onOpenChange(false);
  };

  const title = account_id ? (
    <h1 className="text-xl font-semibold">
      Create Task for {account?.name ?? "Account"}
    </h1>
  ) : (
    <h1 className="text-xl font-semibold">Create Task</h1>
  );

  return (
    <CreateSheet
      resource="tasks"
      title={title}
      redirect={false}
      record={{
        type: "None",
        contact_id: null,
        account_id: account_id ?? null,
        parent_type: parent_type ?? null,
        parent_id: parent_id ?? null,
        due_date: new Date().toISOString().slice(0, 10),
        user_id: identity.id,
      }}
      transform={(data) => {
        const dueDate = new Date(data.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return {
          ...data,
          due_date: dueDate.toISOString(),
        };
      }}
      mutationOptions={{
        onSuccess: handleSuccess,
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <TaskFormContent selectAccount={selectAccount} />
    </CreateSheet>
  );
};
