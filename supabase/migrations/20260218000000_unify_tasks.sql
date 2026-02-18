-- Unify tasks: extend `tasks` table to support accounts, migrate account_tasks data, drop account_tasks

-- ============================================================
-- 1. Extend the tasks table
-- ============================================================

-- Allow tasks without a contact (account-only tasks)
alter table "public"."tasks" alter column "contact_id" drop not null;

-- Add account and parent columns
alter table "public"."tasks" add column "account_id" bigint;
alter table "public"."tasks" add column "parent_type" text;
alter table "public"."tasks" add column "parent_id" bigint;

-- FK to accounts
alter table "public"."tasks" add constraint "tasks_account_id_fkey"
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON UPDATE CASCADE ON DELETE CASCADE not valid;
alter table "public"."tasks" validate constraint "tasks_account_id_fkey";

-- ============================================================
-- 2. Migrate account_tasks rows into tasks
-- ============================================================

insert into "public"."tasks" (contact_id, type, text, due_date, done_date, sales_id, account_id, parent_type, parent_id)
select
    null,                                          -- no contact
    'None',                                        -- default type
    at.subject,                                    -- subject → text
    at.due_date::timestamptz,                      -- date → timestamptz
    at.done_date::timestamptz,                     -- date → timestamptz
    at.sales_id,
    at.account_id,
    at.parent_type,
    at.parent_id
from "public"."account_tasks" at;

-- ============================================================
-- 3. Recreate accounts_summary view joining tasks instead of account_tasks
-- ============================================================

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
    bc.full_name as billing_contact_name,
    count(distinct ac.id) as nb_contacts,
    count(distinct acon.id) as nb_contracts,
    count(distinct t.id) filter (where t.done_date is null) as nb_open_tasks
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
    bc.address_postal_code, bc.address_country, bc.full_name;

-- ============================================================
-- 4. Drop account_tasks table (cascades RLS policies, indexes)
-- ============================================================

drop table "public"."account_tasks" cascade;
