import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AccountPayment, PaymentType } from "../types";

type Props = {
  payment: AccountPayment;
  isAdmin?: boolean;
  onEdit?: (id: number) => void;
  contractLabel?: string;
};

const typeConfig: Record<PaymentType, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  payment: { label: "Payment", variant: "default" },
  refund: { label: "Refund", variant: "destructive" },
  discount: { label: "Discount", variant: "secondary" },
  write_off: { label: "Write-off", variant: "outline" },
};

export const PaymentRow = ({ payment, isAdmin, onEdit, contractLabel }: Props) => {
  const type = payment.type ?? "payment";
  const config = typeConfig[type];
  const isAdjustment = type !== "payment";

  return (
    <div className="flex items-center gap-4 py-2 px-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm flex items-center gap-2">
          {isAdjustment && (
            <Badge variant={config.variant} className="text-xs px-1.5 py-0">
              {config.label}
            </Badge>
          )}
          <span className={`font-medium ${Number(payment.amount) < 0 ? "text-destructive" : ""}`}>
            {Number(payment.amount) < 0 ? "-" : ""}$
            {Math.abs(Number(payment.amount)).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          {payment.date_received && (
            <span className="text-muted-foreground">&middot; {payment.date_received}</span>
          )}
          {!isAdjustment && payment.payment_method && (
            <span className="text-muted-foreground">&middot; {payment.payment_method}</span>
          )}
          {!isAdjustment && payment.reference_number && (
            <span className="text-muted-foreground">&middot; #{payment.reference_number}</span>
          )}
          {contractLabel && (
            <span className="text-muted-foreground">&middot; {contractLabel}</span>
          )}
        </div>
        {payment.notes && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {payment.notes}
          </div>
        )}
      </div>
      {isAdmin && onEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-auto"
          onClick={() => onEdit(payment.id as number)}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
