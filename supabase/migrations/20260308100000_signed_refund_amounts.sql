-- ============================================================
-- Switch refunds to signed (negative) amounts
--
-- Refunds are stored as negative values because they represent
-- money returned to the client (reduces net received).
-- Discounts and write-offs stay positive because they reduce
-- the balance owed (same effect as a payment).
--
-- Simplified balance formula:
--   balance_due = total_contracted - SUM(all payment amounts)
--
-- Example: contracted=$3500, payment=$1000, refund=-$50, discount=$500
--   SUM = 1000 + (-50) + 500 = 1450
--   balance = 3500 - 1450 = 2050 ✓
-- ============================================================

-- 1. Drop the positive-only constraint
alter table "public"."account_payments"
  drop constraint if exists "account_payments_amount_positive";

-- 2. Add non-zero constraint (refunds are negative, everything else positive)
alter table "public"."account_payments"
  add constraint "account_payments_amount_nonzero"
  check (amount != 0);

-- 3. Negate existing refund amounts (convert positive → negative)
update "public"."account_payments"
  set amount = -abs(amount)
  where type = 'refund'
    and amount > 0;

-- 4. Recreate accounts_summary view with simplified balance
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
    -- Financial aggregates
    coalesce((select sum(ap.amount) from account_payments ap
              where ap.account_id = a.id and ap.type = 'payment'), 0) as total_received,
    coalesce((select -sum(ap.amount) from account_payments ap
              where ap.account_id = a.id and ap.type = 'refund'), 0) as total_refunds,
    coalesce((select sum(ap.amount) from account_payments ap
              where ap.account_id = a.id and ap.type in ('discount', 'write_off')), 0) as total_adjustments,
    coalesce((select sum(acon2.fee) from account_contracts acon2
              where acon2.account_id = a.id), 0) as total_contracted,
    -- balance = contracted - SUM(all payment amounts)
    coalesce((select sum(acon2.fee) from account_contracts acon2
              where acon2.account_id = a.id), 0)
    - coalesce((select sum(ap.amount) from account_payments ap
                where ap.account_id = a.id), 0)
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
