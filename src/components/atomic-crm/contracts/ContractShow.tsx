import { useState } from "react";
import { formatRelative } from "date-fns";
import {
  CreateBase,
  Form,
  ShowBase,
  useShowContext,
  useRecordContext,
  useGetOne,
  useGetList,
  useGetIdentity,
  useUpdate,
  useCreate,
  useDelete,
  useNotify,
  useRefresh,
} from "ra-core";
import { supabase } from "../providers/supabase/supabase";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";
import { SaveButton } from "@/components/admin/form";

import { AsideSection } from "../misc/AsideSection";
import { ContractDeleteWarning } from "../misc/DeleteWarnings";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { activityTypeColors, accountCategoryColors, contractStatusColors } from "../misc/statusColors";
import { AddPayment } from "../payments/AddPayment";
import { AccountPaymentInputs } from "../payments/AccountPaymentInputs";
import { AddTask } from "../tasks/AddTask";
import { Task } from "../tasks/Task";
import { AddActivity } from "../accounts/AddActivity";
import { AccountPaymentEditSheet } from "../payments/AccountPaymentEditSheet";
import { PaymentRow } from "../payments/PaymentRow";
import type {
  Account,
  AccountActivity,
  AccountContract,
  AccountPayment,
  ContractPaymentSchedule,
  PaymentAllocation,
  Sale,
  Task as TaskType,
} from "../types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const scheduleStatusStyle: Record<string, string> = {
  paid:     'text-green-700 bg-green-50 border-green-200',
  partial:  'text-amber-700 bg-amber-50 border-amber-200',
  late:     'text-red-700 bg-red-50 border-red-200',
  due:      'text-amber-700 bg-amber-50 border-amber-200',
  upcoming: 'text-muted-foreground bg-muted/40 border-border',
};


export const ContractShow = () => {
  return (
    <ShowBase>
      <ContractShowContent />
    </ShowBase>
  );
};

const ContractShowContent = () => {
  const { record, isPending } = useShowContext<AccountContract>();

  const { data: payments } = useGetList<AccountPayment>(
    "account_payments",
    {
      filter: { contract_id: record?.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "date_received", order: "ASC" },
    },
    { enabled: !!record?.id },
  );

  if (isPending || !record) return null;

  const fee = Number(record.fee ?? 0);
  const totalReceived = payments?.reduce((sum, p) => sum + (p.type === 'payment' ? Number(p.amount) : 0), 0) ?? 0;
  const totalAdjustments = payments?.reduce((sum, p) => sum + (p.type === 'write_off' || p.type === 'discount' ? Number(p.amount) : 0), 0) ?? 0;
  const balance = fee - totalReceived - totalAdjustments;
  const paymentCount = payments?.filter(p => p.type === 'payment')?.length ?? 0;

  return (
    <div className="mt-2 mb-2 flex gap-8 pb-20 md:pb-0">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h5 className="text-xl font-semibold">
                  {record.contract_number || `Contract #${record.id}`}
                </h5>
                {record.status && (
                  <Badge
                    variant="outline"
                    className={`text-xs py-0 px-1.5 ${contractStatusColors[record.status] ?? ""}`}
                  >
                    {record.status}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {record.case_type && <span>{record.case_type}</span>}
                {record.date_opened && (
                  <span>
                    {record.case_type && " \u00b7 "}
                    Opened {record.date_opened}
                  </span>
                )}
              </div>
            </div>

            {fee > 0 && (
              <div className="flex flex-wrap gap-x-6 mb-6 text-sm border-t border-b py-3">
                <div>
                  <span className="text-muted-foreground">Contracted: </span>
                  <span className="font-medium">${fmt(fee)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Received: </span>
                  <span className="font-medium">${fmt(totalReceived)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Balance: </span>
                  <span className={`font-medium ${balance > 0 ? "text-destructive" : "text-green-600"}`}>
                    ${fmt(balance)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Payments: </span>
                  <span className="font-medium">
                    {record.num_payments
                      ? `${paymentCount} of ${record.num_payments}`
                      : paymentCount}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <h6 className="text-lg font-semibold">Terms</h6>
                <Field label="Fee" value={record.fee != null ? `$${Number(record.fee).toLocaleString()}` : undefined} />
                <Field label="Retainer" value={record.retainer != null ? `$${Number(record.retainer).toLocaleString()}` : undefined} />
                <Field label="Monthly Payment" value={record.monthly_payment != null ? `$${Number(record.monthly_payment).toLocaleString()}` : undefined} />
                <Field label="# Payments" value={record.num_payments?.toString()} />
                <Field label="Final Payment" value={record.final_payment != null ? `$${Number(record.final_payment).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined} />
              </div>
              <div className="flex flex-col gap-3">
                <h6 className="text-lg font-semibold">Dates & Details</h6>
                <Field label="Date Opened" value={record.date_opened} />
                <Field label="Date Retainer" value={record.date_retainer} />
                <Field label="Date First Payment" value={record.date_first_payment} />
                <Field label="Work Description" value={record.work_description} />
              </div>
            </div>
          </CardContent>
        </Card>
        <ContractLinkedItems record={record} payments={payments} />
      </div>
      <ContractAside />
    </div>
  );
};

const ScheduleTable = ({
  schedule,
  payments,
  accountId,
  contractId,
}: {
  schedule: ContractPaymentSchedule[];
  payments?: AccountPayment[];
  accountId: any;
  contractId: any;
}) => {
  const [create] = useCreate();
  const [deleteOne] = useDelete();
  const refresh = useRefresh();
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const [pendingLinkRow, setPendingLinkRow] = useState<ContractPaymentSchedule | null>(null);

  // Fetch allocations for all schedule rows in this contract
  const scheduleIds = schedule.map((r) => Number(r.id));
  const { data: allocations } = useGetList<PaymentAllocation>(
    "payment_allocations",
    {
      filter: { "schedule_id@in": `(${scheduleIds.join(",")})` },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "ASC" },
    },
    { enabled: scheduleIds.length > 0 },
  );

  const paymentById = new Map((payments ?? []).map((p) => [Number(p.id), p]));

  // Build map: scheduleId → allocations[]
  const allocsBySchedule = new Map<number, PaymentAllocation[]>();
  for (const a of allocations ?? []) {
    const sid = Number(a.schedule_id);
    const list = allocsBySchedule.get(sid) ?? [];
    list.push(a);
    allocsBySchedule.set(sid, list);
  }

  // Track total allocated per payment to compute available amount
  const allocatedByPayment = new Map<number, number>();
  for (const a of allocations ?? []) {
    const pid = Number(a.payment_id);
    allocatedByPayment.set(pid, (allocatedByPayment.get(pid) ?? 0) + Number(a.amount_applied));
  }

  const availablePayments = (payments ?? []).filter((p) => {
    const allocatableTypes = ["payment", "discount", "write_off"];
    if (!allocatableTypes.includes(p.type ?? "payment")) return false;
    const amt = Math.abs(Number(p.amount));
    if (amt <= 0) return false;
    const used = allocatedByPayment.get(Number(p.id)) ?? 0;
    return amt - used > 0.01;
  });

  const hasPaid = schedule.some((r) => (Number(r.amount_paid) || 0) > 0);

  const handleAllocate = (scheduleRow: ContractPaymentSchedule, paymentId: string) => {
    const pmt = paymentById.get(Number(paymentId));
    if (!pmt) return;
    const pmtAvailable = Math.abs(Number(pmt.amount)) - (allocatedByPayment.get(Number(pmt.id)) ?? 0);
    const schedRemaining = Number(scheduleRow.balance_remaining) || Number(scheduleRow.amount);
    const amount = Math.min(pmtAvailable, schedRemaining);
    create(
      "payment_allocations",
      { data: { payment_id: Number(paymentId), schedule_id: Number(scheduleRow.id), amount_applied: amount } },
      {
        onSuccess: () => { notify("Payment allocated", { type: "success" }); refresh(); },
        onError: () => notify("Failed to allocate payment", { type: "error" }),
      },
    );
  };

  const handleDeallocate = (allocationId: number) => {
    deleteOne(
      "payment_allocations",
      { id: allocationId },
      {
        onSuccess: () => { notify("Payment deallocated", { type: "success" }); refresh(); },
        onError: () => notify("Failed to deallocate", { type: "error" }),
      },
    );
  };

  const handleCreateSuccess = (newPayment: AccountPayment) => {
    if (!pendingLinkRow) return;
    const row = pendingLinkRow;
    const schedRemaining = Number(row.balance_remaining) || Number(row.amount);
    const amount = Math.min(Math.abs(Number(newPayment.amount)), schedRemaining);
    if (amount > 0) {
      create(
        "payment_allocations",
        { data: { payment_id: Number(newPayment.id), schedule_id: Number(row.id), amount_applied: amount } },
        {
          onSuccess: () => {
            notify("Payment created and allocated", { type: "success" });
            setPendingLinkRow(null);
            refresh();
          },
          onError: () => {
            notify("Payment created but could not auto-allocate", { type: "warning" });
            setPendingLinkRow(null);
            refresh();
          },
        },
      );
    } else {
      setPendingLinkRow(null);
      refresh();
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left py-1 pr-3 font-medium">#</th>
              <th className="text-left py-1 pr-3 font-medium">Due Date</th>
              <th className="text-right py-1 pr-3 font-medium">Amount</th>
              <th className="text-left py-1 pr-3 font-medium">Status</th>
              {hasPaid && <th className="text-right py-1 pr-3 font-medium">Paid</th>}
              {hasPaid && <th className="text-left py-1 pr-3 font-medium">Date</th>}
              {hasPaid && <th className="text-left py-1 pr-3 font-medium">Method</th>}
              {hasPaid && <th className="text-left py-1 font-medium">Ref #</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {schedule.map((row) => {
              const st = row.status ?? 'upcoming';
              const rowAllocs = allocsBySchedule.get(Number(row.id)) ?? [];
              const amountPaid = Number(row.amount_paid) || 0;
              const isFullyPaid = st === 'paid';
              const isPartial = st === 'partial';
              const showAllocateDropdown = !isFullyPaid;

              return (
                <>
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {row.payment_number === 0 ? 'R' : row.payment_number}
                    </td>
                    <td className="py-1.5 pr-3">{row.due_date}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      ${fmt(Number(row.amount))}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-block text-xs px-1.5 py-0.5 rounded border ${scheduleStatusStyle[st]}`}>
                          {st === 'paid' ? 'Paid'
                            : st === 'partial' ? `$${fmt(amountPaid)} / $${fmt(Number(row.amount))}`
                            : st === 'late' ? 'Late'
                            : st === 'due' ? 'Due'
                            : 'Upcoming'}
                        </span>
                        {showAllocateDropdown && (
                          <Select onValueChange={(val) => {
                            if (val === "__new__") {
                              setPendingLinkRow(row);
                            } else {
                              handleAllocate(row, val);
                            }
                          }}>
                            <SelectTrigger className="h-6 text-xs w-32 border-dashed">
                              <SelectValue placeholder="Allocate…" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePayments.map((p) => {
                                const avail = Math.abs(Number(p.amount)) - (allocatedByPayment.get(Number(p.id)) ?? 0);
                                const typeLabel = p.type && p.type !== "payment" ? ` [${p.type}]` : '';
                                return (
                                  <SelectItem key={p.id} value={String(p.id)}>
                                    {p.date_received} · ${fmt(avail)} avail · {p.payment_method}{typeLabel}
                                    {p.reference_number ? ` · #${p.reference_number}` : ''}
                                  </SelectItem>
                                );
                              })}
                              <SelectItem value="__new__" className="text-primary font-medium">
                                + Create new payment…
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </span>
                    </td>
                    {hasPaid && rowAllocs.length <= 1 && (
                      <>
                        <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">
                          {rowAllocs.length === 1 ? `$${fmt(Number(rowAllocs[0].amount_applied))}` : '—'}
                        </td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {rowAllocs.length === 1 ? paymentById.get(Number(rowAllocs[0].payment_id))?.date_received ?? '—' : '—'}
                        </td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {rowAllocs.length === 1 ? paymentById.get(Number(rowAllocs[0].payment_id))?.payment_method ?? '—' : '—'}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {rowAllocs.length === 1 ? paymentById.get(Number(rowAllocs[0].payment_id))?.reference_number ?? '—' : '—'}
                            {rowAllocs.length === 1 && (
                              <button
                                onClick={() => handleDeallocate(Number(rowAllocs[0].id))}
                                className="text-xs text-muted-foreground hover:text-destructive"
                                title="Deallocate payment"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        </td>
                      </>
                    )}
                    {hasPaid && rowAllocs.length > 1 && (
                      <>
                        <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">
                          ${fmt(amountPaid)}
                        </td>
                        <td colSpan={3} className="py-1.5 text-xs text-muted-foreground">
                          {rowAllocs.length} payments
                        </td>
                      </>
                    )}
                  </tr>
                  {/* Allocation sub-rows for multi-allocation schedule rows */}
                  {hasPaid && rowAllocs.length > 1 && rowAllocs.map((alloc) => {
                    const pmt = paymentById.get(Number(alloc.payment_id));
                    return (
                      <tr key={`alloc-${alloc.id}`} className="bg-muted/10">
                        <td className="py-1 pr-3" />
                        <td className="py-1 pr-3" />
                        <td className="py-1 pr-3" />
                        <td className="py-1 pr-3" />
                        <td className="py-1 pr-3 text-right font-mono text-xs text-muted-foreground">
                          ${fmt(Number(alloc.amount_applied))}
                        </td>
                        <td className="py-1 pr-3 text-xs text-muted-foreground">
                          {pmt?.date_received ?? '—'}
                        </td>
                        <td className="py-1 pr-3 text-xs text-muted-foreground">
                          {pmt?.payment_method ?? '—'}
                        </td>
                        <td className="py-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {pmt?.reference_number ?? '—'}
                            <button
                              onClick={() => handleDeallocate(Number(alloc.id))}
                              className="text-xs text-muted-foreground hover:text-destructive"
                              title="Deallocate payment"
                            >
                              ×
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendingLinkRow && identity && (
        <CreateBase
          resource="account_payments"
          record={{
            account_id: accountId,
            contract_id: contractId ?? null,
            user_id: identity.id,
            amount: Number(pendingLinkRow.balance_remaining) || Number(pendingLinkRow.amount),
            date_received: pendingLinkRow.due_date,
          }}
          transform={(data: any) => {
            const isAdjustment = data.type === "discount" || data.type === "write_off";
            const amount = data.type === "refund"
              ? -Math.abs(Number(data.amount))
              : Math.abs(Number(data.amount));
            return {
              ...data,
              amount,
              account_id: accountId,
              contract_id: isAdjustment ? null : (data.contract_id || null),
              payment_method: isAdjustment ? "N/A" : data.payment_method,
              user_id: identity.id,
            };
          }}
          mutationOptions={{ onSuccess: handleCreateSuccess }}
        >
          <Dialog
            open={!!pendingLinkRow}
            onOpenChange={(open) => { if (!open) setPendingLinkRow(null); }}
          >
            <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
              <Form className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>
                    Add payment ·{" "}
                    {pendingLinkRow.payment_number === 0
                      ? "Retainer"
                      : `Payment ${pendingLinkRow.payment_number}`}
                    {" "}(${fmt(Number(pendingLinkRow.balance_remaining) || Number(pendingLinkRow.amount))} due {pendingLinkRow.due_date})
                  </DialogTitle>
                </DialogHeader>
                <AccountPaymentInputs />
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

const ContractLinkedItems = ({
  record,
  payments,
}: {
  record: AccountContract;
  payments?: AccountPayment[];
}) => {
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);

  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const isAdmin = !!currentUser?.administrator;

  const { data: schedule } = useGetList<ContractPaymentSchedule>(
    "contract_payment_schedule",
    {
      filter: { "contract_id@eq": record.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "payment_number", order: "ASC" },
    },
    { enabled: !!record.id },
  );

  // Fetch allocations for this contract's schedule to show per-payment allocation status
  const scheduleIds = (schedule ?? []).map((r) => Number(r.id));
  const { data: contractAllocations } = useGetList<PaymentAllocation>(
    "payment_allocations",
    {
      filter: { "schedule_id@in": `(${scheduleIds.join(",")})` },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: scheduleIds.length > 0 },
  );
  const allocatedByPayment = new Map<number, number>();
  for (const a of contractAllocations ?? []) {
    const pid = Number(a.payment_id);
    allocatedByPayment.set(pid, (allocatedByPayment.get(pid) ?? 0) + Number(a.amount_applied));
  }

  const { data: tasks } = useGetList<TaskType>("tasks", {
    filter: {
      parent_type: "account_contract",
      parent_id: record.id,
    },
    sort: { field: "due_date", order: "ASC" },
    pagination: { page: 1, perPage: 50 },
  });

  const { data: activities } = useGetList<AccountActivity>(
    "account_activities",
    {
      filter: {
        parent_type: "account_contract",
        parent_id: record.id,
      },
      sort: { field: "date", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
  );

  const now = Date.now();

  if (!schedule?.length && !tasks?.length && !activities?.length && !payments?.length) return null;

  return (
    <div className="mt-4 flex flex-col gap-4">
      {schedule && schedule.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Accordion type="single" collapsible>
              <AccordionItem value="schedule" className="border-0">
                <AccordionTrigger className="px-6 py-4 text-lg font-semibold hover:no-underline">
                  Payment Schedule
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({schedule.length} item{schedule.length !== 1 ? 's' : ''})
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <ScheduleTable
                    schedule={schedule}
                    payments={payments}
                    accountId={record.account_id}
                    contractId={record.id}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {payments && payments.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Accordion type="single" collapsible>
              <AccordionItem value="payments" className="border-0">
                <AccordionTrigger className="px-6 py-4 text-lg font-semibold hover:no-underline">
                  Payments
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({payments.length} received)
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="divide-y">
                    {payments.map((payment) => (
                      <PaymentRow
                        key={payment.id}
                        payment={payment}
                        isAdmin={isAdmin}
                        onEdit={setEditingPaymentId}
                        totalAllocated={allocatedByPayment.get(Number(payment.id))}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {tasks && tasks.length > 0 && (
        <Card>
          <CardContent>
            <h6 className="text-lg font-semibold mb-2">Tasks</h6>
            <div className="divide-y">
              {tasks.map((task) => (
                <div key={task.id} className="py-1">
                  <Task task={task} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activities && activities.length > 0 && (
        <Card>
          <CardContent>
            <h6 className="text-lg font-semibold mb-2">Activities</h6>
            <div className="divide-y">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 py-2"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{activity.subject}</span>
                      {activity.type && (
                        <Badge
                          variant="outline"
                          className={`text-xs py-0 px-1.5 ${activityTypeColors[activity.type] ?? ""}`}
                        >
                          {activity.type}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5 truncate">
                      {activity.date && formatRelative(activity.date, now)}
                      {activity.body && <span> &middot; {activity.body}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {editingPaymentId != null && (
        <AccountPaymentEditSheet
          open={editingPaymentId != null}
          onOpenChange={(open) => { if (!open) setEditingPaymentId(null); }}
          paymentId={editingPaymentId}
        />
      )}
    </div>
  );
};

const Field = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <span className="text-muted-foreground">{label}:</span>{" "}
    {value || "\u2014"}
  </div>
);

const ContractStatusSelect = () => {
  const record = useRecordContext<AccountContract>();
  const { contractStatuses } = useConfigurationContext();
  const [update] = useUpdate();

  if (!record) return null;

  const handleChange = (value: string) => {
    update("account_contracts", {
      id: record.id,
      data: { status: value },
      previousData: record,
    });
  };

  return (
    <AsideSection title="Status">
      <Select value={record.status || "In process"} onValueChange={handleChange}>
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {contractStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${(contractStatusColors[status] ?? "").split(" ")[0]}`}
                />
                {status}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </AsideSection>
  );
};

const RegenerateScheduleButton = ({ contractId }: { contractId: any }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("generate_payment_schedule", {
        p_contract_id: contractId,
      });
      if (error) throw error;
      notify("Payment schedule regenerated", { type: "success" });
      refresh();
    } catch {
      notify("Could not regenerate schedule", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRegenerate}
      disabled={loading}
      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50 text-left"
    >
      {loading ? "Regenerating…" : "Regenerate schedule"}
    </button>
  );
};

export const ContractAside = () => {
  const record = useRecordContext<AccountContract>();
  const { identity } = useGetIdentity();
  const { data: currentUser } = useGetOne<Sale>(
    "users",
    { id: identity?.id! },
    { enabled: !!identity },
  );
  const isAdmin = !!currentUser?.administrator;

  if (!record) return null;

  return (
    <div className="hidden sm:block w-64 min-w-64 text-sm">
      <div className="mb-4 -ml-1">
        <EditButton label="Edit Contract" />
      </div>

      <ContractStatusSelect />

      <AccountInfo accountId={record.account_id} />

      <div className="mt-6 pt-6 border-t flex flex-col gap-2">
        <AddTask
          account_id={record.account_id}
          parent_type="account_contract"
          parent_id={record.id}
        />
        <AddActivity
          account_id={record.account_id}
          parent_type="account_contract"
          parent_id={record.id}
        />
        <AddPayment
          account_id={record.account_id}
          contract_id={record.id}
        />
        {isAdmin && (
          <RegenerateScheduleButton contractId={record.id} />
        )}
      </div>

      <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
        <DeleteButton
          className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
          size="sm"
          confirmContent={<ContractDeleteWarning />}
        />
      </div>
    </div>
  );
};

const AccountInfo = ({ accountId }: { accountId: any }) => {
  const { data: account, isPending } = useGetOne<Account>("accounts", {
    id: accountId,
  }, { enabled: !!accountId });

  if (isPending || !account) return null;

  return (
    <AsideSection title="Account">
      <div className="flex flex-col gap-1">
        <Link
          to={`/accounts/${account.id}/show`}
          className="text-primary hover:underline font-medium"
        >
          {account.name}
        </Link>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground">{account.account_number}</span>
          {account.categories && (
            <Badge
              variant="outline"
              className={`text-xs py-0 px-1.5 ${accountCategoryColors[account.categories] ?? ""}`}
            >
              {account.categories}
            </Badge>
          )}
        </div>
      </div>
    </AsideSection>
  );
};
