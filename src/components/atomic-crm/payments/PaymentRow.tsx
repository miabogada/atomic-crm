import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccountPayment } from "../types";

type Props = {
  payment: AccountPayment;
  isAdmin?: boolean;
  onEdit?: (id: number) => void;
  contractLabel?: string;
};

export const PaymentRow = ({ payment, isAdmin, onEdit, contractLabel }: Props) => (
  <div className="flex items-center gap-4 py-2 px-2">
    <div className="flex-1 min-w-0">
      <div className="text-sm">
        <span className="font-medium">
          ${Number(payment.amount).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        {payment.date_received && (
          <span className="text-muted-foreground"> &middot; {payment.date_received}</span>
        )}
        {payment.payment_method && (
          <span className="text-muted-foreground"> &middot; {payment.payment_method}</span>
        )}
        {payment.reference_number && (
          <span className="text-muted-foreground"> &middot; #{payment.reference_number}</span>
        )}
        {contractLabel && (
          <span className="text-muted-foreground"> &middot; {contractLabel}</span>
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
