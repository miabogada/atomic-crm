import { useMemo, useState } from "react";
import {
  CreateBase,
  Form,
  ShowBase,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
  useShowContext,
  type Identifier,
} from "ra-core";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ReferenceManyCount } from "@/components/admin/reference-many-count";
import { SaveButton } from "@/components/admin/form";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Activity } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelative } from "date-fns";

import { AccountAside } from "./AccountAside";
import { AccountContactsList } from "./AccountContactsList";
import { AccountContractsList } from "./AccountContractsList";
import { AccountPaymentList } from "../payments/AccountPaymentList";
import { AccountActivityLogWidget } from "../activity/AccountActivityLog";
import { ActivityView } from "./ActivityView";
import { AccountActivityEditSheet } from "./AccountActivityEditSheet";
import { Task } from "../tasks/Task";
import { TaskFormContent } from "../tasks/TaskFormContent";
import { defaultActivityTypes } from "../root/defaultConfiguration";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import type {
  Account,
  AccountActivity,
  AccountContract,
  Sale,
  Task as TaskType,
} from "../types";
import {
  accountCategoryColors,
  activityTypeColors,
  contractStatusColors,
} from "../misc/statusColors";

export const AccountShow = () => {
  return (
    <ShowBase>
      <AccountShowContent />
    </ShowBase>
  );
};

const AccountShowContent = () => {
  const { record, isPending } = useShowContext<Account>();
  const [contractFilter, setContractFilter] = useState<Identifier | null>(null);
  const [activeTab, setActiveTab] = useState("contacts");

  if (isPending || !record) return null;

  const paymentFilter = contractFilter
    ? { "contract_id@eq": contractFilter }
    : undefined;

  return (
    <div className="mt-2 mb-2 flex flex-col gap-4 md:flex-row md:gap-8">
      <div className="flex-1 min-w-0">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg">
                {record.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h5 className="text-xl font-semibold">{record.name}</h5>
                  <span className="text-xl font-semibold">{record.account_number}</span>
                  {record.categories && (
                    <Badge
                      variant="outline"
                      className={`text-xs py-0 px-1.5 ${accountCategoryColors[record.categories] ?? ""}`}
                    >
                      {record.categories}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {(record.total_contracted != null || record.total_received != null) && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Contracted: </span>
                  <span className="font-medium">
                    ${Number(record.total_contracted ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Received: </span>
                  <span className="font-medium">
                    ${Number(record.total_received ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                {Number(record.total_refunds ?? 0) > 0 && (
                  <div>
                    <span className="text-muted-foreground">Refunds: </span>
                    <span className="font-medium text-destructive">
                      ${Number(record.total_refunds).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {Number(record.total_adjustments ?? 0) > 0 && (
                  <div>
                    <span className="text-muted-foreground">Adjustments: </span>
                    <span className="font-medium">
                      -${Number(record.total_adjustments).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Balance: </span>
                  <span className={`font-medium ${Number(record.balance_due ?? 0) > 0 ? "text-destructive" : "text-green-600"}`}>
                    ${Number(record.balance_due ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}

            <Tabs defaultValue="contacts" className="w-full" onValueChange={setActiveTab}>
              <div className="w-full overflow-x-auto">
                <TabsList className="flex h-10 w-max min-w-full">
                  <TabsTrigger value="contacts">
                    <ReferenceManyCount target="account_id" reference="account_contacts" />{" "}
                    Contacts
                  </TabsTrigger>
                  <TabsTrigger value="contracts">
                    <ReferenceManyCount target="account_id" reference="account_contracts" />{" "}
                    Contracts
                  </TabsTrigger>
                  <TabsTrigger value="tasks">
                    <ReferenceManyCount
                      target="account_id"
                      reference="tasks"
                      filter={{ "done_date@is": null }}
                    />{" "}
                    Tasks
                  </TabsTrigger>
                  <TabsTrigger value="payments">
                    <ReferenceManyCount target="account_id" reference="account_payments" />{" "}
                    Payments
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="contacts" className="mt-4">
                <ReferenceManyField
                  target="account_id"
                  reference="account_contacts"
                  sort={{ field: "created_at", order: "DESC" }}
                  empty={false}
                >
                  <AccountContactsList />
                </ReferenceManyField>
              </TabsContent>

              <TabsContent value="contracts" className="mt-4">
                <ReferenceManyField
                  target="account_id"
                  reference="account_contracts"
                  sort={{ field: "created_at", order: "DESC" }}
                  empty={false}
                >
                  <AccountContractsList />
                </ReferenceManyField>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <AccountTasksTab contractFilter={contractFilter} />
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <ReferenceManyField
                  target="account_id"
                  reference="account_payments"
                  sort={{ field: "date_received", order: "DESC" }}
                  filter={paymentFilter}
                  empty={false}
                >
                  <AccountPaymentList />
                </ReferenceManyField>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <AccountActivityLogWidget accountId={record.id} />
      </div>
      <AccountAside
        contractFilter={contractFilter}
        onContractFilter={setContractFilter}
        activeTab={activeTab}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Parent selection type — shared by Add Task and Add Activity pickers
// ---------------------------------------------------------------------------

type ParentSelection =
  | { parent_type: "account_contract"; parent_id: Identifier; label: string }
  | { parent_type: "tasks"; parent_id: Identifier; label: string }
  | { parent_type: null; parent_id: null; label: string };

// ---------------------------------------------------------------------------
// Picker dialogs
// ---------------------------------------------------------------------------

/** Step 1 for Add Activity: choose task / contract / account level */
const TypePickerDialog = ({
  open,
  onClose,
  onPickTask,
  onPickContract,
  onPickAccount,
}: {
  open: boolean;
  onClose: () => void;
  onPickTask: () => void;
  onPickContract: () => void;
  onPickAccount: () => void;
}) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Attach this activity to…</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-1 py-1">
        <button
          onClick={onPickTask}
          className="text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
        >
          <span className="font-medium">A task</span>
          <span className="block text-xs text-muted-foreground">
            Log progress on a specific task
          </span>
        </button>
        <button
          onClick={onPickContract}
          className="text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
        >
          <span className="font-medium">A contract</span>
          <span className="block text-xs text-muted-foreground">
            Link to a contract engagement
          </span>
        </button>
        <button
          onClick={onPickAccount}
          className="text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm text-muted-foreground"
        >
          Account level (no specific attachment)
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

/** Task list picker — used as step 2 when "A task" is chosen */
const TaskPickerDialog = ({
  open,
  onClose,
  onPick,
  onBack,
  account_id,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (task: TaskType) => void;
  onBack: () => void;
  account_id: Identifier;
}) => {
  const { data: tasks, isPending } = useGetList<TaskType>(
    "tasks",
    {
      filter: { account_id, "done_date@is": null },
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
    },
    { enabled: open },
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Which task?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 py-1">
          {isPending && (
            <div className="text-muted-foreground text-sm px-3 py-2">Loading…</div>
          )}
          {!isPending && !tasks?.length && (
            <div className="text-muted-foreground text-sm px-3 py-2">
              No open tasks for this account
            </div>
          )}
          {tasks?.map((task) => (
            <button
              key={task.id as string}
              onClick={() => onPick(task)}
              className="text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
            >
              <span className="font-medium">
                {task.type && task.type !== "None" && (
                  <span className="text-muted-foreground">{task.type} · </span>
                )}
                {task.text}
              </span>
              {task.due_date && (
                <span className="block text-xs text-muted-foreground">
                  Due {task.due_date}
                </span>
              )}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Contract list picker — used by Add Task (standalone) and Add Activity (step 2) */
const ContractPickerDialog = ({
  open,
  onClose,
  onPick,
  onBack,
  contracts,
  title = "Where does this belong?",
  showAccountOption = true,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (parent: ParentSelection) => void;
  onBack?: () => void;
  contracts: AccountContract[];
  title?: string;
  showAccountOption?: boolean;
}) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-1 py-1">
        {contracts.map((c) => (
          <button
            key={c.id as string}
            onClick={() =>
              onPick({
                parent_type: "account_contract",
                parent_id: c.id,
                label: c.contract_number ?? `Contract #${c.id}`,
              })
            }
            className="text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
          >
            <span className="font-medium">
              {c.contract_number ?? `Contract #${c.id}`}
            </span>
            {c.case_type && (
              <span className="text-muted-foreground"> · {c.case_type}</span>
            )}
            {c.status && (
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded border ${contractStatusColors[c.status] ?? ""}`}
              >
                {c.status}
              </span>
            )}
          </button>
        ))}
        {showAccountOption && (
          <button
            onClick={() =>
              onPick({ parent_type: null, parent_id: null, label: "Account level" })
            }
            className="text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm text-muted-foreground"
          >
            Account level (no contract)
          </button>
        )}
      </div>
      {onBack && (
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  </Dialog>
);

// ---------------------------------------------------------------------------
// Add Task with contract picker
// ---------------------------------------------------------------------------

const AddTaskFromAccount = ({
  account_id,
  contracts,
  contractFilter,
}: {
  account_id: Identifier;
  contracts: AccountContract[];
  contractFilter: Identifier | null;
}) => {
  type Step = "idle" | "picking" | "form";
  const [step, setStep] = useState<Step>("idle");
  const [parent, setParent] = useState<ParentSelection | null>(null);
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();

  const handleClick = () => {
    if (contractFilter) {
      const c = contracts.find((c) => c.id === contractFilter);
      setParent({
        parent_type: "account_contract",
        parent_id: contractFilter,
        label: c?.contract_number ?? "Contract",
      });
      setStep("form");
    } else if (contracts.length === 0) {
      setParent({ parent_type: null, parent_id: null, label: "Account level" });
      setStep("form");
    } else {
      setStep("picking");
    }
  };

  const handleClose = () => {
    setStep("idle");
    setParent(null);
  };

  const handleSuccess = () => {
    handleClose();
    notify("Task added");
    refresh();
  };

  if (!identity) return null;

  return (
    <>
      <div className="my-2">
        <Button variant="outline" className="h-6 cursor-pointer" onClick={handleClick} size="sm">
          <Plus className="w-4 h-4" />
          Add task
        </Button>
      </div>

      <ContractPickerDialog
        open={step === "picking"}
        onClose={handleClose}
        onPick={(p) => { setParent(p); setStep("form"); }}
        contracts={contracts}
      />

      {step === "form" && parent !== null && (
        <CreateBase
          resource="tasks"
          record={{
            type: "None",
            status: "To do",
            contact_id: null,
            account_id,
            parent_type: parent.parent_type,
            parent_id: parent.parent_id,
            due_date: (() => {
              const d = new Date();
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            })(),
            user_id: identity.id,
          }}
          mutationOptions={{ onSuccess: handleSuccess }}
        >
          <Dialog open={true} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
              <Form className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>
                    New task
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      · {parent.label}
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <TaskFormContent />
                <DialogFooter className="w-full justify-end">
                  <SaveButton />
                </DialogFooter>
              </Form>
            </DialogContent>
          </Dialog>
        </CreateBase>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Add Activity with three-option picker (task / contract / account)
// ---------------------------------------------------------------------------

const AddActivityFromAccount = ({
  account_id,
  contracts,
  contractFilter,
}: {
  account_id: Identifier;
  contracts: AccountContract[];
  contractFilter: Identifier | null;
}) => {
  type Step = "idle" | "type-picker" | "task-picker" | "contract-picker" | "form";
  const [step, setStep] = useState<Step>("idle");
  const [parent, setParent] = useState<ParentSelection | null>(null);
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();

  const activityChoices = defaultActivityTypes.map((type) => ({
    id: type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
  }));

  const handleClick = () => {
    if (contractFilter) {
      // Shortcut: contract filter active → go straight to form
      const c = contracts.find((c) => c.id === contractFilter);
      setParent({
        parent_type: "account_contract",
        parent_id: contractFilter,
        label: c?.contract_number ?? "Contract",
      });
      setStep("form");
    } else if (contracts.length === 0) {
      // No contracts → account level directly
      setParent({ parent_type: null, parent_id: null, label: "Account level" });
      setStep("form");
    } else {
      setStep("type-picker");
    }
  };

  const handlePickTask = (task: TaskType) => {
    setParent({
      parent_type: "tasks",
      parent_id: task.id,
      label: task.text ?? "Task",
    });
    setStep("form");
  };

  const handleClose = () => {
    setStep("idle");
    setParent(null);
  };

  const handleSuccess = () => {
    handleClose();
    notify("Activity added");
    refresh();
  };

  if (!identity) return null;

  return (
    <>
      <div className="my-2">
        <Button variant="outline" className="h-6 cursor-pointer" onClick={handleClick} size="sm">
          <Activity className="w-4 h-4" />
          Add activity
        </Button>
      </div>

      {/* Step 1: What type of attachment? */}
      <TypePickerDialog
        open={step === "type-picker"}
        onClose={handleClose}
        onPickTask={() => setStep("task-picker")}
        onPickContract={() => setStep("contract-picker")}
        onPickAccount={() => {
          setParent({ parent_type: null, parent_id: null, label: "Account level" });
          setStep("form");
        }}
      />

      {/* Step 2a: Pick a task */}
      <TaskPickerDialog
        open={step === "task-picker"}
        onClose={handleClose}
        onPick={handlePickTask}
        onBack={() => setStep("type-picker")}
        account_id={account_id}
      />

      {/* Step 2b: Pick a contract */}
      <ContractPickerDialog
        open={step === "contract-picker"}
        onClose={handleClose}
        onPick={(p) => { setParent(p); setStep("form"); }}
        onBack={() => setStep("type-picker")}
        contracts={contracts}
        title="Which contract?"
        showAccountOption={false}
      />

      {/* Form */}
      {step === "form" && parent !== null && (
        <CreateBase
          resource="account_activities"
          record={{
            account_id,
            parent_type: parent.parent_type,
            parent_id: parent.parent_id,
            user_id: identity.id,
            date: new Date().toISOString(),
          }}
          mutationOptions={{ onSuccess: handleSuccess }}
        >
          <Dialog open={true} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
              <Form className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>
                    New activity
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      · {parent.label}
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <TextInput
                    autoFocus
                    source="subject"
                    label="Subject"
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
                    <DateInput source="date" helperText={false} />
                    <SelectInput source="type" choices={activityChoices} helperText={false} />
                  </div>
                </div>
                <DialogFooter className="w-full justify-end">
                  <SaveButton />
                </DialogFooter>
              </Form>
            </DialogContent>
          </Dialog>
        </CreateBase>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Tasks tab — combined chronological feed of tasks and activities
// ---------------------------------------------------------------------------

type FeedItem =
  | { kind: "task"; sortDate: string; data: TaskType }
  | { kind: "activity"; sortDate: string; data: AccountActivity };

const AccountTasksTab = ({ contractFilter }: { contractFilter: Identifier | null }) => {
  const account = useRecordContext<Account>();

  const [viewingActivity, setViewingActivity] = useState<AccountActivity | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);

  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const isAdmin = !!currentUser?.administrator;

  // Contracts (for Add buttons)
  const { data: contracts } = useGetList<AccountContract>(
    "account_contracts",
    {
      filter: { account_id: account?.id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "date_opened", order: "ASC" },
    },
    { enabled: !!account?.id },
  );

  // Tasks — filtered by contract when active
  const { data: tasks, isPending: tasksPending } = useGetList<TaskType>(
    "tasks",
    {
      filter: contractFilter
        ? { account_id: account?.id, "parent_type@eq": "account_contract", "parent_id@eq": contractFilter }
        : { account_id: account?.id },
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: 200 },
    },
    { enabled: !!account?.id },
  );

  // All activities for the account
  const { data: allActivities } = useGetList<AccountActivity>(
    "account_activities",
    {
      filter: { account_id: account?.id },
      sort: { field: "date", order: "ASC" },
      pagination: { page: 1, perPage: 1000 },
    },
    { enabled: !!account?.id },
  );

  // Task-linked activities grouped by task ID
  const taskActivitiesMap = useMemo(() => {
    const map: Record<string, AccountActivity[]> = {};
    for (const a of allActivities ?? []) {
      if (a.parent_type === "tasks" && a.parent_id != null) {
        const key = String(a.parent_id);
        if (!map[key]) map[key] = [];
        map[key].push(a);
      }
    }
    return map;
  }, [allActivities]);

  // Standalone activities (not task-linked), filtered by contract when active
  const standaloneActivities = useMemo(() => {
    return (allActivities ?? []).filter((a) => {
      if (a.parent_type === "tasks") return false;
      if (contractFilter) {
        return (
          a.parent_type === "account_contract" &&
          String(a.parent_id) === String(contractFilter)
        );
      }
      return true;
    });
  }, [allActivities, contractFilter]);

  // Merge tasks and standalone activities into one chronological feed
  const feedItems = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [
      ...(tasks ?? []).map((t): FeedItem => ({
        kind: "task",
        sortDate: t.due_date ?? t.created_at ?? "",
        data: t,
      })),
      ...standaloneActivities.map((a): FeedItem => ({
        kind: "activity",
        sortDate: a.date ?? a.created_at ?? "",
        data: a,
      })),
    ];
    items.sort((a, b) => {
      if (!a.sortDate && !b.sortDate) return 0;
      if (!a.sortDate) return 1;
      if (!b.sortDate) return -1;
      return a.sortDate.localeCompare(b.sortDate);
    });
    return items;
  }, [tasks, standaloneActivities]);

  if (tasksPending) return null;

  const now = Date.now();

  return (
    <div>
      {account && (
        <div className="flex justify-end gap-2 mb-2">
          <AddActivityFromAccount
            account_id={account.id}
            contracts={contracts ?? []}
            contractFilter={contractFilter}
          />
          <AddTaskFromAccount
            account_id={account.id}
            contracts={contracts ?? []}
            contractFilter={contractFilter}
          />
        </div>
      )}

      {!feedItems.length ? (
        <div className="text-center text-muted-foreground py-8">
          {contractFilter ? "No items for this contract" : "No tasks yet"}
        </div>
      ) : (
        <TooltipProvider>
          <div className="divide-y">
            {feedItems.map((item) => {
              if (item.kind === "task") {
                const task = item.data;
                const linked = taskActivitiesMap[String(task.id)] ?? [];
                return (
                  <div key={`task-${task.id}`}>
                    <div className="py-1">
                      <Task task={task} />
                    </div>
                    {linked.map((activity) => (
                      <div
                        key={activity.id}
                        className="ml-6 pl-3 border-l border-muted flex items-start gap-3 py-2"
                      >
                        <div
                          className="flex-1 min-w-0 cursor-pointer text-sm"
                          onClick={() => setViewingActivity(activity)}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-medium truncate flex-1 min-w-0">{activity.subject}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm whitespace-normal break-words">
                                {activity.subject}
                              </TooltipContent>
                            </Tooltip>
                            {activity.type && (
                              <Badge
                                variant="outline"
                                className={`text-xs py-0 px-1.5 shrink-0 ${activityTypeColors[activity.type] ?? ""}`}
                              >
                                {activity.type}
                              </Badge>
                            )}
                          </div>
                          {activity.body && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {activity.date && formatRelative(activity.date, now)}
                                  {" · "}{activity.body}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm whitespace-normal break-words">
                                {activity.body}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {!activity.body && activity.date && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatRelative(activity.date, now)}
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-auto shrink-0"
                            onClick={() => setEditingActivityId(activity.id as number)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }

              // Standalone activity row
              const activity = item.data;
              return (
                <div
                  key={`activity-${activity.id}`}
                  className="flex items-center gap-4 py-3 px-2"
                >
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setViewingActivity(activity)}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium truncate flex-1 min-w-0">{activity.subject}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm whitespace-normal break-words">
                          {activity.subject}
                        </TooltipContent>
                      </Tooltip>
                      {activity.type && (
                        <Badge
                          variant="outline"
                          className={`text-xs py-0 px-1.5 shrink-0 ${activityTypeColors[activity.type] ?? ""}`}
                        >
                          {activity.type}
                        </Badge>
                      )}
                    </div>
                    {activity.body && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-sm text-muted-foreground mt-0.5 truncate">
                            {activity.date && formatRelative(activity.date, now)}
                            {" · "}{activity.body}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm whitespace-normal break-words">
                          {activity.body}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {!activity.body && activity.date && (
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {formatRelative(activity.date, now)}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto shrink-0"
                      onClick={() => setEditingActivityId(activity.id as number)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {viewingActivity && (
        <ActivityView
          activity={viewingActivity}
          open={true}
          close={() => setViewingActivity(null)}
          onEdit={() => {
            setEditingActivityId(viewingActivity.id as number);
            setViewingActivity(null);
          }}
        />
      )}

      {editingActivityId != null && (
        <AccountActivityEditSheet
          open={true}
          onOpenChange={(open) => { if (!open) setEditingActivityId(null); }}
          activityId={editingActivityId}
        />
      )}
    </div>
  );
};
