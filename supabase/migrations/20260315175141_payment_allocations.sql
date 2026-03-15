-- ============================================================
-- Migration: payment_allocations
-- Replaces the 1:1 payment_id FK on contract_payment_schedule
-- with a many-to-many junction table supporting partial payments,
-- lump sums, and split payments.
-- ============================================================

-- 1a. Create junction table
CREATE TABLE public.payment_allocations (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_id     BIGINT NOT NULL REFERENCES account_payments(id) ON DELETE CASCADE,
    schedule_id    BIGINT NOT NULL REFERENCES contract_payment_schedule(id) ON DELETE CASCADE,
    amount_applied NUMERIC(10,2) NOT NULL CHECK (amount_applied > 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(payment_id, schedule_id)
);

CREATE INDEX idx_payment_allocations_schedule ON payment_allocations(schedule_id);
CREATE INDEX idx_payment_allocations_payment  ON payment_allocations(payment_id);

-- 1b. RLS + grants
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select payment_allocations"
    ON payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert payment_allocations"
    ON payment_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update payment_allocations"
    ON payment_allocations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated can delete payment_allocations"
    ON payment_allocations FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON payment_allocations TO authenticated;
GRANT ALL ON payment_allocations TO service_role;

-- 1c. Data migration: DO NOT use the old payment_id links — they have drift from
-- the buggy 1:1 algorithm. Run link_payment_schedule.py after this migration to
-- populate payment_allocations correctly with proper chronological allocation.

-- 1d. Replace the view to compute status from allocations
-- Must DROP first because column list changed (payment_id removed, amount_paid/balance_remaining added)
DROP VIEW IF EXISTS public.contract_payment_schedule_view;
CREATE VIEW public.contract_payment_schedule_view
    WITH (security_invoker = on)
AS
SELECT
    cps.id,
    cps.contract_id,
    cps.account_id,
    cps.payment_number,
    cps.due_date,
    cps.amount,
    cps.created_at,
    ac.contract_number,
    ac.case_type,
    a.name         AS account_name,
    a.account_number,
    COALESCE(alloc.total_applied, 0)              AS amount_paid,
    cps.amount - COALESCE(alloc.total_applied, 0) AS balance_remaining,
    CASE
        WHEN COALESCE(alloc.total_applied, 0) >= cps.amount THEN 'paid'
        WHEN COALESCE(alloc.total_applied, 0) > 0 THEN 'partial'
        WHEN cps.due_date < CURRENT_DATE THEN 'late'
        WHEN cps.due_date = CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
    END AS status
FROM public.contract_payment_schedule cps
JOIN public.account_contracts ac ON ac.id = cps.contract_id
JOIN public.accounts          a  ON a.id  = cps.account_id
LEFT JOIN LATERAL (
    SELECT SUM(pa.amount_applied) AS total_applied
    FROM payment_allocations pa
    WHERE pa.schedule_id = cps.id
) alloc ON TRUE;

GRANT SELECT ON public.contract_payment_schedule_view TO authenticated;

-- 1e. Update generate_payment_schedule() to use allocations instead of payment_id
CREATE OR REPLACE FUNCTION public.generate_payment_schedule(p_contract_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_contract record;
  i          integer;
BEGIN
  SELECT * INTO v_contract
  FROM public.account_contracts
  WHERE id = p_contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found: %', p_contract_id;
  END IF;

  -- Remove existing rows that have NO allocations so we can regenerate cleanly.
  -- Rows with any allocation (even partial) are preserved.
  DELETE FROM public.contract_payment_schedule
  WHERE contract_id = p_contract_id
    AND id NOT IN (
        SELECT DISTINCT schedule_id FROM payment_allocations
        WHERE schedule_id IN (
            SELECT id FROM contract_payment_schedule WHERE contract_id = p_contract_id
        )
    );

  -- Retainer row (payment_number = 0)
  IF v_contract.retainer IS NOT NULL AND v_contract.retainer > 0
     AND v_contract.date_retainer IS NOT NULL THEN
    INSERT INTO public.contract_payment_schedule
      (contract_id, account_id, payment_number, due_date, amount)
    VALUES
      (p_contract_id, v_contract.account_id, 0,
       v_contract.date_retainer, v_contract.retainer);
  END IF;

  -- Installment rows (payment_number = 1..N)
  -- num_payments = count of regular monthly installments; final_payment is an
  -- ADDITIONAL row after those (not a replacement for the last one).
  -- Formula: fee = retainer + num_payments × monthly_payment + final_payment
  IF v_contract.num_payments IS NOT NULL AND v_contract.num_payments > 0
     AND v_contract.monthly_payment IS NOT NULL AND v_contract.monthly_payment > 0
     AND v_contract.date_first_payment IS NOT NULL THEN
    FOR i IN 1..v_contract.num_payments LOOP
      INSERT INTO public.contract_payment_schedule
        (contract_id, account_id, payment_number, due_date, amount)
      VALUES (
        p_contract_id,
        v_contract.account_id,
        i,
        (v_contract.date_first_payment + make_interval(months => i - 1))::date,
        v_contract.monthly_payment
      );
    END LOOP;

    -- Final payment row (payment_number = num_payments + 1)
    IF v_contract.final_payment IS NOT NULL AND v_contract.final_payment > 0 THEN
      INSERT INTO public.contract_payment_schedule
        (contract_id, account_id, payment_number, due_date, amount)
      VALUES (
        p_contract_id,
        v_contract.account_id,
        v_contract.num_payments + 1,
        (v_contract.date_first_payment + make_interval(months => v_contract.num_payments))::date,
        v_contract.final_payment
      );
    END IF;
  END IF;
END;
$$;

-- 1f. Drop the old payment_id column
ALTER TABLE contract_payment_schedule DROP COLUMN payment_id;
