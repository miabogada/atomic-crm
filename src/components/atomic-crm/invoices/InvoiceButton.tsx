import { useState } from "react";
import { BlobProvider } from "@react-pdf/renderer";
import { FileText, Download, Printer, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceDocument } from "./InvoiceDocument";
import { useInvoiceGeneration } from "./useInvoiceGeneration";

export function InvoiceButton({ accountId }: { accountId: number }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error, generate } = useInvoiceGeneration(accountId);

  const handleOpen = () => {
    setOpen(true);
    generate();
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <FileText />
        Invoice
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading invoice data...
            </div>
          )}

          {error && (
            <div className="text-destructive text-sm py-4">
              Error: {error}
            </div>
          )}

          {data && !loading && (
            <BlobProvider document={<InvoiceDocument data={data} />}>
              {({ blob, loading: pdfLoading, error: pdfError }) => {
                if (pdfLoading) {
                  return (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rendering PDF...
                    </div>
                  );
                }

                if (pdfError) {
                  return (
                    <div className="text-destructive text-sm py-4">
                      PDF render error: {pdfError.message}
                    </div>
                  );
                }

                if (!blob) return null;

                const url = URL.createObjectURL(blob);
                const filename = `invoice-${data.accountNumber}-${new Date().toISOString().slice(0, 7)}.pdf`;

                return (
                  <DialogFooter className="flex gap-2 sm:justify-start">
                    <Button
                      variant="outline"
                      asChild
                    >
                      <a href={url} download={filename}>
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </Button>
                    <Button
                      onClick={() => {
                        const printWindow = window.open(url);
                        if (printWindow) {
                          printWindow.addEventListener("load", () => {
                            printWindow.print();
                          });
                        }
                      }}
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </Button>
                  </DialogFooter>
                );
              }}
            </BlobProvider>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
