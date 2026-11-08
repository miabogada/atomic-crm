-- Multiple case types per contract.
-- See docs/plan-multiple-case-types.md
--
-- 1. case_types: lookup table, seeded with the approved list (2026-11-08)
-- 2. account_contract_case_types: normalized contract <-> case type join table
-- 3. account_contracts_summary: contracts + aggregated case types (read path)
-- 4. contract_payment_schedule_view: append case type label
--
-- The legacy free-text column account_contracts.case_type is kept (read-only in
-- the UI) until legacy values are mapped; it will be dropped in a later migration.

-- ============================================================
-- 1. case_types
-- ============================================================
CREATE TABLE public.case_types (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        text        NOT NULL UNIQUE,
    active      boolean     NOT NULL DEFAULT true,  -- retire instead of delete
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read case_types"
    ON public.case_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert case_types"
    ON public.case_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update case_types"
    ON public.case_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- No DELETE policy: case types are retired via active = false.

GRANT SELECT, INSERT, UPDATE ON public.case_types TO authenticated;
GRANT ALL ON public.case_types TO service_role;

INSERT INTO public.case_types (name) VALUES
    ('Adjustment of Status'),
    ('Adjustment of Status (No Representation)'),
    ('Advance Parole'),
    ('Asylum'),
    ('BIA Appeal'),
    ('Cancellation of Removal'),
    ('Citizenship Inquiry'),
    ('Court Representation'),
    ('DACA'),
    ('DACA Renewal'),
    ('Deportation'),
    ('EAD'),
    ('EAD Renewal'),
    ('FBI'),
    ('FOIA'),
    ('Humanitarian Parole'),
    ('I-130'),
    ('I-131F / Family Reunification Parole'),
    ('I-192'),
    ('I-212'),
    ('I-601 Waiver'),
    ('I-601A'),
    ('I-751'),
    ('I-824'),
    ('Inquiry'),
    ('K Visa'),
    ('Late Amnesty'),
    ('Legalization'),
    ('Letter'),
    ('Military Parole in Place'),
    ('Motion to Close'),
    ('Motion to Reopen'),
    ('Motion to Terminate'),
    ('N-400'),
    ('N-400 (No Representation)'),
    ('NACARA'),
    ('Non-Client Consult'),
    ('NVC & Consular Processing'),
    ('Review File'),
    ('Suspension of Deportation'),
    ('T Visa'),
    ('T-2 Visa'),
    ('T-4 Visa'),
    ('TPS'),
    ('TPS Renewal'),
    ('U Visa'),
    ('U-2 Visa'),
    ('U-4 Visa'),
    ('V Visa'),
    ('VAWA');

-- ============================================================
-- 2. account_contract_case_types
-- ============================================================
CREATE TABLE public.account_contract_case_types (
    contract_id   bigint      NOT NULL REFERENCES public.account_contracts(id) ON DELETE CASCADE,
    case_type_id  bigint      NOT NULL REFERENCES public.case_types(id)        ON DELETE RESTRICT,
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contract_id, case_type_id)
);

-- PK covers lookups by contract; this covers "all contracts with case type X".
CREATE INDEX idx_account_contract_case_types_case_type
    ON public.account_contract_case_types (case_type_id);

ALTER TABLE public.account_contract_case_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read account_contract_case_types"
    ON public.account_contract_case_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert account_contract_case_types"
    ON public.account_contract_case_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can delete account_contract_case_types"
    ON public.account_contract_case_types FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, DELETE ON public.account_contract_case_types TO authenticated;
GRANT ALL ON public.account_contract_case_types TO service_role;

-- ============================================================
-- 3. account_contracts_summary (read path for the account_contracts resource)
-- ============================================================
CREATE VIEW public.account_contracts_summary
    WITH (security_invoker = on)
AS
SELECT
    ac.*,
    COALESCE(ct.ids,   '{}'::bigint[]) AS case_type_ids,
    COALESCE(ct.names, '{}'::text[])   AS case_type_names,
    -- Display/search label; falls back to the legacy free-text value
    COALESCE(array_to_string(ct.names, ', '), ac.case_type) AS case_types_label
FROM public.account_contracts ac
LEFT JOIN LATERAL (
    SELECT array_agg(t.id   ORDER BY t.name) AS ids,
           array_agg(t.name ORDER BY t.name) AS names
    FROM public.account_contract_case_types x
    JOIN public.case_types t ON t.id = x.case_type_id
    WHERE x.contract_id = ac.id
) ct ON TRUE;

GRANT SELECT ON public.account_contracts_summary TO authenticated;
GRANT SELECT ON public.account_contracts_summary TO service_role;

-- ============================================================
-- 4. contract_payment_schedule_view: append case_types_label
--    (CREATE OR REPLACE may only add columns at the end)
-- ============================================================
CREATE OR REPLACE VIEW public.contract_payment_schedule_view
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
    END AS status,
    acs.case_types_label
FROM public.contract_payment_schedule cps
JOIN public.account_contracts          ac  ON ac.id  = cps.contract_id
JOIN public.account_contracts_summary  acs ON acs.id = cps.contract_id
JOIN public.accounts                   a   ON a.id   = cps.account_id
LEFT JOIN LATERAL (
    SELECT SUM(pa.amount_applied) AS total_applied
    FROM payment_allocations pa
    WHERE pa.schedule_id = cps.id
) alloc ON TRUE;
