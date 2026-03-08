-- ============================================================
-- Payment adjustments: type column + updated balance view
--
-- Adds a `type` column to account_payments to support:
--   payment   — normal payment received (existing behavior)
--   refund    — money returned to client (increases balance)
--   discount  — fee reduction applied to contract (reduces balance)
--   write_off — unpaid amount forgiven at account level (reduces balance)
--
-- Balance formula:
--   balance_due = total_contracted
--               - payments + refunds
--               - discounts - write_offs
--
-- Also adds total_adjustments (discounts + write_offs) and
-- total_refunds to accounts_summary for transparency.
-- ============================================================

-- 1. Add type column with default 'payment' (no-lock backfill)
alter table "public"."account_payments"
  add column "type" text not null default 'payment';

alter table "public"."account_payments"
  add constraint "account_payments_type_check"
  check (type in ('payment', 'refund', 'discount', 'write_off'));

-- 2. Drop the amount > 0 check — refunds were previously blocked.
--    We keep amounts positive; the type determines accounting direction.
--    (Constraint name from the inline CHECK in the CREATE TABLE.)
alter table "public"."account_payments"
  drop constraint if exists "account_payments_amount_check";

-- Re-add: amount must be positive (type handles direction)
alter table "public"."account_payments"
  add constraint "account_payments_amount_positive"
  check (amount > 0);

-- 3. Index for type-filtered queries
create index if not exists idx_account_payments_type
  on "public"."account_payments" (type);

-- 4. Recreate accounts_summary view with type-aware balance
--    DROP required because new columns change the view signature
--    (CREATE OR REPLACE cannot add/reorder columns)
drop view if exists "public"."accounts_summary";
create view "public"."accounts_summary"
    with (security_invoker=on)
    as
select
    a.*,
    bc.address_street as billing_street,
    bc.address_city as billing_city,
    bc.address_state as billing_state,
    bc.address_postal_code as billing_postal_code,
    bc.address_country as billing_country,
    bc.first_name || ' ' || bc.last_name as billing_contact_name,
    count(distinct ac.id) as nb_contacts,
    count(distinct acon.id) as nb_contracts,
    count(distinct t.id) filter (where t.done_date is null) as nb_open_tasks,
    -- Financial aggregates (type-aware)
    coalesce((select sum(ap.amount) from account_payments ap
              where ap.account_id = a.id and ap.type = 'payment'), 0) as total_received,
    coalesce((select sum(ap.amount) from account_payments ap
              where ap.account_id = a.id and ap.type = 'refund'), 0) as total_refunds,
    coalesce((select sum(ap.amount) from account_payments ap
              where ap.account_id = a.id and ap.type in ('discount', 'write_off')), 0) as total_adjustments,
    coalesce((select sum(acon2.fee) from account_contracts acon2
              where acon2.account_id = a.id), 0) as total_contracted,
    -- balance = contracted - (payments - refunds) - (discounts + write_offs)
    coalesce((select sum(acon2.fee) from account_contracts acon2
              where acon2.account_id = a.id), 0)
    - coalesce((select sum(ap.amount) from account_payments ap
                where ap.account_id = a.id and ap.type = 'payment'), 0)
    + coalesce((select sum(ap.amount) from account_payments ap
                where ap.account_id = a.id and ap.type = 'refund'), 0)
    - coalesce((select sum(ap.amount) from account_payments ap
                where ap.account_id = a.id and ap.type in ('discount', 'write_off')), 0)
    as balance_due
from
    "public"."accounts" a
left join
    "public"."account_contacts" bc on a.id = bc.account_id and bc.is_billing_contact = true
left join
    "public"."account_contacts" ac on a.id = ac.account_id
left join
    "public"."account_contracts" acon on a.id = acon.account_id
left join
    "public"."tasks" t on a.id = t.account_id
group by
    a.id, bc.address_street, bc.address_city, bc.address_state,
    bc.address_postal_code, bc.address_country, bc.first_name, bc.last_name;
