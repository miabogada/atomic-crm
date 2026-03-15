import { Banknote } from "lucide-react";
import { useGetList } from "ra-core";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ContractPaymentSchedule } from "../types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const todayStr = () => new Date().toISOString().split("T")[0];
const futureStr = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const daysPast = (due: string) =>
  Math.floor((Date.now() - new Date(due).getTime()) / (1000 * 60 * 60 * 24));

export const Receivables = () => {
  const today = todayStr();
  const in30 = futureStr(30);
  const in90 = futureStr(90);

  const { data: overdueRows, isPending: pendingOverdue } =
    useGetList<ContractPaymentSchedule>("contract_payment_schedule", {
      filter: { "balance_remaining@gt": 0, "due_date@lt": today },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
    });

  const { data: upcomingRows, isPending: pendingUpcoming } =
    useGetList<ContractPaymentSchedule>("contract_payment_schedule", {
      filter: { "balance_remaining@gt": 0, "due_date@gte": today, "due_date@lte": in90 },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
    });

  if (pendingOverdue || pendingUpcoming) return null;

  const overdue = overdueRows ?? [];
  const upcoming = upcomingRows ?? [];
  const upcoming30 = upcoming.filter((r) => r.due_date <= in30);
  const overdueTotal = overdue.reduce((s, r) => s + Number(r.balance_remaining ?? r.amount), 0);
  const upcoming30Total = upcoming30.reduce((s, r) => s + Number(r.balance_remaining ?? r.amount), 0);
  const upcoming90Total = upcoming.reduce((s, r) => s + Number(r.balance_remaining ?? r.amount), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <Banknote className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground flex-1">
          Receivables
        </h2>
      </div>
      <Card className="px-4 mb-2">
        <Accordion type="multiple">
          {/* ── Overdue ── */}
          <AccordionItem value="overdue">
            <AccordionTrigger className="text-xs uppercase tracking-wider font-medium py-3 hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">Overdue</span>
                {overdue.length > 0 && (
                  <span className="text-red-500 normal-case text-xs">
                    {overdue.length} item{overdue.length !== 1 ? "s" : ""} · ${fmt(overdueTotal)}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {overdue.length === 0 ? (
                <p className="text-sm text-green-600">All payments current</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {overdue.slice(0, 8).map((row) => (
                    <div key={row.id} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/account_contracts/${row.contract_id}/show`}
                          className="text-red-500 hover:underline font-medium truncate block"
                        >
                          {row.account_name ?? `Contract #${row.contract_id}`}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {row.contract_number} · {daysPast(row.due_date)}d overdue
                        </span>
                      </div>
                      <span className="ml-3 text-sm font-medium text-red-500 shrink-0">
                        ${fmt(Number(row.balance_remaining ?? row.amount))}
                      </span>
                    </div>
                  ))}
                  {overdue.length > 8 && (
                    <p className="text-xs text-muted-foreground">+{overdue.length - 8} more</p>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ── Next 30 days ── */}
          <AccordionItem value="next30">
            <AccordionTrigger className="text-xs uppercase tracking-wider font-medium py-3 hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">Next 30 days</span>
                {upcoming30.length > 0 && (
                  <span className="normal-case font-normal text-foreground text-xs">
                    ${fmt(upcoming30Total)}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {upcoming30.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments due</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {upcoming30.slice(0, 10).map((row) => (
                    <div key={row.id} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/account_contracts/${row.contract_id}/show`}
                          className="hover:underline font-medium truncate block"
                        >
                          {row.account_name ?? `Contract #${row.contract_id}`}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {row.due_date}
                          {row.payment_number === 0 ? " · Retainer" : ""}
                        </span>
                      </div>
                      <span className="ml-3 text-sm font-medium shrink-0">
                        ${fmt(Number(row.balance_remaining ?? row.amount))}
                      </span>
                    </div>
                  ))}
                  {upcoming30.length > 10 && (
                    <p className="text-xs text-muted-foreground">+{upcoming30.length - 10} more</p>
                  )}
                </div>
              )}
              {/* ── 90-day lookahead ── */}
              {upcoming.length > upcoming30.length && (
                <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  Next 90 days: <span className="font-medium text-foreground">${fmt(upcoming90Total)}</span>
                  {" across "}{upcoming.length} payment{upcoming.length !== 1 ? "s" : ""}
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
};
