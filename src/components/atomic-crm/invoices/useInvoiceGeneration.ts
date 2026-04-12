import { useCallback, useEffect, useState } from "react";

import { supabase } from "../providers/supabase/supabase";
import { fetchInvoiceData } from "./fetchInvoiceData";
import type { InvoiceData } from "./types";

export function useInvoiceGeneration(accountId: number | null) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (accountId == null) return;
    setLoading(true);
    setError(null);
    try {
      const invoiceData = await fetchInvoiceData(supabase, accountId);
      setData(invoiceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  // Reset when account changes
  useEffect(() => {
    setData(null);
    setError(null);
  }, [accountId]);

  return { data, loading, error, generate };
}
