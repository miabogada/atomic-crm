-- ============================================================
-- Soft delete infrastructure
--
-- Adds deleted_at column to main tables. Records are never
-- hard-deleted from the UI — the dataProvider sets deleted_at
-- instead. Views filter out soft-deleted records.
--
-- Cascade: soft-deleting an account cascades to its children.
-- FK ON DELETE changed from CASCADE to RESTRICT to prevent
-- accidental hard deletes via SQL.
-- ============================================================

-- 1. Add deleted_at to main tables
alter table "public"."accounts"
  add column "deleted_at" timestamptz;

alter table "public"."account_contacts"
  add column "deleted_at" timestamptz;

alter table "public"."account_contracts"
  add column "deleted_at" timestamptz;

alter table "public"."account_payments"
  add column "deleted_at" timestamptz;

alter table "public"."account_activities"
  add column "deleted_at" timestamptz;

alter table "public"."tasks"
  add column "deleted_at" timestamptz;

-- 2. Indexes for filtering (partial index on non-null for future purge queries)
create index idx_accounts_deleted_at on accounts (deleted_at) where deleted_at is not null;
create index idx_account_contacts_deleted_at on account_contacts (deleted_at) where deleted_at is not null;
create index idx_account_contracts_deleted_at on account_contracts (deleted_at) where deleted_at is not null;
create index idx_account_payments_deleted_at on account_payments (deleted_at) where deleted_at is not null;
create index idx_account_activities_deleted_at on account_activities (deleted_at) where deleted_at is not null;
create index idx_tasks_deleted_at on tasks (deleted_at) where deleted_at is not null;

-- 3. Cascade soft-delete trigger function
--    When an account is soft-deleted, cascade to all children.
--    When an account is restored (deleted_at set back to NULL), restore children too.
create or replace function soft_delete_cascade_account()
returns trigger as $$
begin
  if NEW.deleted_at is not null and OLD.deleted_at is null then
    -- Soft-deleting: cascade to children
    update account_contacts   set deleted_at = NEW.deleted_at where account_id = NEW.id and deleted_at is null;
    update account_contracts  set deleted_at = NEW.deleted_at where account_id = NEW.id and deleted_at is null;
    update account_payments   set deleted_at = NEW.deleted_at where account_id = NEW.id and deleted_at is null;
    update account_activities set deleted_at = NEW.deleted_at where account_id = NEW.id and deleted_at is null;
    update tasks              set deleted_at = NEW.deleted_at where account_id = NEW.id and deleted_at is null;
  elsif NEW.deleted_at is null and OLD.deleted_at is not null then
    -- Restoring: un-delete children that were cascade-deleted at the same timestamp
    update account_contacts   set deleted_at = null where account_id = NEW.id and deleted_at = OLD.deleted_at;
    update account_contracts  set deleted_at = null where account_id = NEW.id and deleted_at = OLD.deleted_at;
    update account_payments   set deleted_at = null where account_id = NEW.id and deleted_at = OLD.deleted_at;
    update account_activities set deleted_at = null where account_id = NEW.id and deleted_at = OLD.deleted_at;
    update tasks              set deleted_at = null where account_id = NEW.id and deleted_at = OLD.deleted_at;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_soft_delete_cascade_account
  after update of deleted_at on accounts
  for each row
  execute function soft_delete_cascade_account();

-- Similarly, soft-deleting a contract cascades to its payment schedule
create or replace function soft_delete_cascade_contract()
returns trigger as $$
begin
  if NEW.deleted_at is not null and OLD.deleted_at is null then
    update contract_payment_schedule set payment_id = null
      where contract_id = NEW.id;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_soft_delete_cascade_contract
  after update of deleted_at on account_contracts
  for each row
  execute function soft_delete_cascade_contract();

-- 4. Change FK constraints from CASCADE to RESTRICT
--    This prevents accidental hard deletes. Only the DBA purge script
--    should hard-delete, and it handles children explicitly.

-- accounts → account_contacts
alter table "public"."account_contacts"
  drop constraint "account_contacts_account_id_fkey",
  add constraint "account_contacts_account_id_fkey"
    foreign key (account_id) references accounts(id)
    on update cascade on delete restrict;

-- accounts → account_contracts
alter table "public"."account_contracts"
  drop constraint "account_contracts_account_id_fkey",
  add constraint "account_contracts_account_id_fkey"
    foreign key (account_id) references accounts(id)
    on update cascade on delete restrict;

-- accounts → account_payments
alter table "public"."account_payments"
  drop constraint "account_payments_account_id_fkey",
  add constraint "account_payments_account_id_fkey"
    foreign key (account_id) references accounts(id)
    on update cascade on delete restrict;

-- accounts → account_activities
alter table "public"."account_activities"
  drop constraint "account_activities_account_id_fkey",
  add constraint "account_activities_account_id_fkey"
    foreign key (account_id) references accounts(id)
    on update cascade on delete restrict;

-- accounts → tasks
alter table "public"."tasks"
  drop constraint "tasks_account_id_fkey",
  add constraint "tasks_account_id_fkey"
    foreign key (account_id) references accounts(id)
    on update cascade on delete restrict;

-- account_contracts → contract_payment_schedule
alter table "public"."contract_payment_schedule"
  drop constraint "cps_contract_id_fkey",
  add constraint "cps_contract_id_fkey"
    foreign key (contract_id) references account_contracts(id)
    on update cascade on delete restrict;

-- accounts → contract_payment_schedule
alter table "public"."contract_payment_schedule"
  drop constraint "cps_account_id_fkey",
  add constraint "cps_account_id_fkey"
    foreign key (account_id) references accounts(id)
    on update cascade on delete restrict;

-- 5. Recreate views to filter out soft-deleted records

-- accounts_summary
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
              where ap.account_id = a.id and ap.type = 'payment' and ap.deleted_at is null), 0) as total_received,
    coalesce((select -sum(ap.amount) from account_payments ap
              where ap.account_id = a.id and ap.type = 'refund' and ap.deleted_at is null), 0) as total_refunds,
    coalesce((select sum(ap.amount) from account_payments ap
              where ap.account_id = a.id and ap.type in ('discount', 'write_off') and ap.deleted_at is null), 0) as total_adjustments,
    coalesce((select sum(acon2.fee) from account_contracts acon2
              where acon2.account_id = a.id and acon2.deleted_at is null), 0) as total_contracted,
    coalesce((select sum(acon2.fee) from account_contracts acon2
              where acon2.account_id = a.id and acon2.deleted_at is null), 0)
    - coalesce((select sum(ap.amount) from account_payments ap
                where ap.account_id = a.id and ap.deleted_at is null), 0)
    as balance_due
from
    "public"."accounts" a
left join
    "public"."account_contacts" bc on a.id = bc.account_id and bc.is_billing_contact = true and bc.deleted_at is null
left join
    "public"."account_contacts" ac on a.id = ac.account_id and ac.deleted_at is null
left join
    "public"."account_contracts" acon on a.id = acon.account_id and acon.deleted_at is null
left join
    "public"."tasks" t on a.id = t.account_id and t.deleted_at is null
where
    a.deleted_at is null
group by
    a.id, bc.address_street, bc.address_city, bc.address_state,
    bc.address_postal_code, bc.address_country, bc.first_name, bc.last_name;

-- contract_payment_schedule_view
drop view if exists "public"."contract_payment_schedule_view";
create view "public"."contract_payment_schedule_view"
    with (security_invoker=on)
    as
select
    cps.id,
    cps.contract_id,
    cps.account_id,
    cps.payment_number,
    cps.due_date,
    cps.amount,
    cps.payment_id,
    cps.created_at,
    ac.contract_number,
    ac.case_type,
    a.name as account_name,
    a.account_number,
    case
        when cps.payment_id is not null then 'paid'
        when cps.due_date < current_date then 'late'
        when cps.due_date = current_date then 'due'
        else 'upcoming'
    end as status
from contract_payment_schedule cps
join account_contracts ac on ac.id = cps.contract_id
join accounts a on a.id = cps.account_id
where ac.deleted_at is null
  and a.deleted_at is null;

-- contacts_summary (upstream contacts — not account_contacts, but filter deleted tasks)
drop view if exists "public"."contacts_summary";
create view "public"."contacts_summary"
    with (security_invoker=on)
    as
select
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.email_jsonb,
    jsonb_path_query_array(co.email_jsonb, '$[*]."email"')::text as email_fts,
    co.phone_jsonb,
    jsonb_path_query_array(co.phone_jsonb, '$[*]."number"')::text as phone_fts,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.user_id,
    co.linkedin_url,
    c.name as company_name,
    count(distinct t.id) as nb_tasks
from contacts co
left join tasks t on co.id = t.contact_id and t.deleted_at is null
left join companies c on co.company_id = c.id
group by co.id, c.name;

-- companies_summary (unchanged except rebuild after view dependency)
drop view if exists "public"."companies_summary";
create view "public"."companies_summary"
    with (security_invoker=on)
    as
select
    c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.user_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts
from companies c
left join deals d on c.id = d.company_id
left join contacts co on c.id = co.company_id
group by c.id;
