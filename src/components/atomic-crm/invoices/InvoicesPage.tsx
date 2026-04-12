import { memo, useCallback, useMemo, useState } from "react";
import { BlobProvider } from "@react-pdf/renderer";
import { Download, Loader2, FileText, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { supabase } from "../providers/supabase/supabase";
import { fetchAllInvoiceData } from "./fetchInvoiceData";
import { InvoiceDocument, InvoiceBatchDocument } from "./InvoiceDocument";
import type { InvoiceData } from "./types";

type GenerationState =
  | { status: "idle" }
  | { status: "fetching" }
  | { status: "ready"; invoices: InvoiceData[] }
  | { status: "error"; message: string };

export const InvoicesPage = () => {
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    setState({ status: "fetching" });
    try {
      const results = await fetchAllInvoiceData(supabase);
      const invoices = results.map((r) => r.data);
      setState({ status: "ready", invoices });
      setSelected(new Set(invoices.map((i) => i.accountNumber)));
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const toggleOne = useCallback((accountNumber: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountNumber)) {
        next.delete(accountNumber);
      } else {
        next.add(accountNumber);
      }
      return next;
    });
  }, []);

  const invoices =
    state.status === "ready" ? state.invoices : [];

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selected.has(i.accountNumber)),
    [invoices, selected],
  );

  const allSelected =
    invoices.length > 0 && selected.size === invoices.length;
  const someSelected =
    selected.size > 0 && selected.size < invoices.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map((i) => i.accountNumber)));
    }
  };

  const yearMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Generate PDF invoices for all accounts with an outstanding balance.
          </p>

          <div className="flex gap-2 flex-wrap items-center">
            <Button
              onClick={handleGenerate}
              disabled={state.status === "fetching"}
            >
              {state.status === "fetching" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching account data...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  {state.status === "ready"
                    ? "Regenerate All"
                    : "Generate All Invoices"}
                </>
              )}
            </Button>

            {selectedInvoices.length > 0 && (
              <BulkActions
                invoices={selectedInvoices}
                yearMonth={yearMonth}
              />
            )}
          </div>

          {state.status === "error" && (
            <div className="text-destructive text-sm mt-4">
              Error: {state.message}
            </div>
          )}

          {state.status === "ready" && (
            <div className="mt-6">
              <p className="text-sm text-muted-foreground mb-2">
                {invoices.length} invoice(s) ready
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <InvoiceRow
                      key={invoice.accountNumber}
                      invoice={invoice}
                      yearMonth={yearMonth}
                      isSelected={selected.has(invoice.accountNumber)}
                      onToggle={toggleOne}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

InvoicesPage.path = "/invoices";

/**
 * Renders a single BlobProvider for all selected invoices combined into one PDF.
 * Memoized so it only re-renders when the selected invoice list changes.
 */
const BulkActions = memo(function BulkActions({
  invoices,
  yearMonth,
}: {
  invoices: InvoiceData[];
  yearMonth: string;
}) {
  const filename = `invoices-${yearMonth}.pdf`;

  return (
    <BlobProvider document={<InvoiceBatchDocument invoices={invoices} />}>
      {({ blob, loading, error }) => {
        if (loading) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Rendering {invoices.length} invoice(s)...
            </div>
          );
        }
        if (error) {
          return (
            <span className="text-destructive text-sm">
              PDF error: {error.message}
            </span>
          );
        }
        if (!blob) return null;

        const url = URL.createObjectURL(blob);

        return (
          <>
            <Button variant="outline" asChild>
              <a href={url} download={filename}>
                <Download className="w-4 h-4" />
                Download ({invoices.length})
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const w = window.open(url);
                if (w) {
                  w.addEventListener("load", () => w.print());
                }
              }}
            >
              <Printer className="w-4 h-4" />
              Print ({invoices.length})
            </Button>
          </>
        );
      }}
    </BlobProvider>
  );
});

const InvoiceRow = memo(function InvoiceRow({
  invoice,
  yearMonth,
  isSelected,
  onToggle,
}: {
  invoice: InvoiceData;
  yearMonth: string;
  isSelected: boolean;
  onToggle: (accountNumber: string) => void;
}) {
  const filename = `invoice-${invoice.accountNumber}-${yearMonth}.pdf`;

  return (
    <TableRow>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={() => onToggle(invoice.accountNumber)} />
      </TableCell>
      <TableCell className="font-mono">{invoice.accountNumber}</TableCell>
      <TableCell>{invoice.clientName}</TableCell>
      <TableCell className="text-right">
        ${invoice.amountDue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="text-right">
        ${invoice.accountBalance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="text-right">
        <BlobProvider document={<InvoiceDocument data={invoice} />}>
          {({ blob, loading, error }) => {
            if (loading) {
              return (
                <Loader2 className="w-4 h-4 animate-spin inline-block" />
              );
            }
            if (error) {
              return (
                <span className="text-destructive text-xs">Error</span>
              );
            }
            if (!blob) return null;

            const url = URL.createObjectURL(blob);

            return (
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" asChild>
                  <a href={url} download={filename}>
                    <Download className="w-4 h-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const w = window.open(url);
                    if (w) {
                      w.addEventListener("load", () => w.print());
                    }
                  }}
                >
                  <Printer className="w-4 h-4" />
                </Button>
              </div>
            );
          }}
        </BlobProvider>
      </TableCell>
    </TableRow>
  );
});
