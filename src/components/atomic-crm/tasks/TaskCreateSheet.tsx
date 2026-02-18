import {
  type Identifier,
  RecordRepresentation,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { foreignKeyMapping } from "../notes/foreignKeyMapping";
import { TaskFormContent } from "./TaskFormContent";

export interface TaskCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact_id?: Identifier;
  account_id?: Identifier;
  parent_type?: string;
  parent_id?: Identifier;
}

export const TaskCreateSheet = ({
  open,
  onOpenChange,
  contact_id,
  account_id,
  parent_type,
  parent_id,
}: TaskCreateSheetProps) => {
  const { identity } = useGetIdentity();

  const selectContact = contact_id == null && account_id == null;
  const { data: contact } = useGetOne(
    "contacts",
    { id: contact_id! },
    { enabled: contact_id != null },
  );
  const { data: account } = useGetOne(
    "accounts",
    { id: account_id! },
    { enabled: account_id != null },
  );
  const [update] = useUpdate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  if (!identity) return null;

  const handleSuccess = async (data: any) => {
    // Only update contact last_seen for contact-linked tasks
    if (data.contact_id) {
      const referenceRecordId = data[foreignKeyMapping["contacts"]];
      if (referenceRecordId) {
        const { data: contact } = await dataProvider.getOne("contacts", {
          id: referenceRecordId,
        });
        if (contact) {
          update("contacts", {
            id: referenceRecordId as unknown as Identifier,
            data: { last_seen: new Date().toISOString() },
            previousData: contact,
          });
        }
      }
    }
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
    <h1 className="text-xl font-semibold">
      {contact_id ? "Create Task for " : "Create Task"}
      {contact_id && (
        <RecordRepresentation record={contact} resource="contacts" />
      )}
    </h1>
  );

  return (
    <CreateSheet
      resource="tasks"
      title={title}
      redirect={false}
      record={{
        type: "None",
        contact_id: contact_id ?? null,
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
      mutationOptions={{
        onSuccess: handleSuccess,
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <TaskFormContent
        selectContact={selectContact}
        selectAccount={false}
      />
    </CreateSheet>
  );
};
