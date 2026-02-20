-- ============================================================
-- account_payments (replaces IPM.Post.Account payment + tblPaymentsReceived)
-- ============================================================

create table "public"."account_payments" (
    "id" bigint generated always as identity not null,
    "account_id" bigint not null,
    "contract_id" bigint,
    "date_received" date not null,
    "amount" numeric(10,2) not null check (amount > 0),
    "payment_method" text not null,
    "reference_number" text,
    "notes" text,
    "user_id" bigint,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

alter table "public"."account_payments" enable row level security;

CREATE UNIQUE INDEX account_payments_pkey ON public.account_payments USING btree (id);
alter table "public"."account_payments" add constraint "account_payments_pkey" PRIMARY KEY using index "account_payments_pkey";

alter table "public"."account_payments" add constraint "account_payments_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
alter table "public"."account_payments" validate constraint "account_payments_account_id_fkey";

alter table "public"."account_payments" add constraint "account_payments_contract_id_fkey" FOREIGN KEY (contract_id) REFERENCES account_contracts(id) ON DELETE SET NULL not valid;
alter table "public"."account_payments" validate constraint "account_payments_contract_id_fkey";

alter table "public"."account_payments" add constraint "account_payments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) not valid;
alter table "public"."account_payments" validate constraint "account_payments_user_id_fkey";

-- ============================================================
-- Update accounts_summary view to include payment totals
-- Use correlated subqueries to avoid double-counting from
-- multiple left joins on one-to-many relations.
-- ============================================================

create or replace view "public"."accounts_summary"
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
    coalesce((select sum(ap.amount) from account_payments ap where ap.account_id = a.id), 0) as total_received,
    coalesce((select sum(acon2.fee) from account_contracts acon2 where acon2.account_id = a.id), 0) as total_contracted,
    coalesce((select sum(acon2.fee) from account_contracts acon2 where acon2.account_id = a.id), 0) -
        coalesce((select sum(ap.amount) from account_payments ap where ap.account_id = a.id), 0) as balance_due
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

-- ============================================================
-- Grants
-- ============================================================

grant select on table "public"."account_payments" to "authenticated";
grant insert on table "public"."account_payments" to "authenticated";
grant update on table "public"."account_payments" to "authenticated";
grant delete on table "public"."account_payments" to "authenticated";

grant select on table "public"."account_payments" to "service_role";
grant insert on table "public"."account_payments" to "service_role";
grant update on table "public"."account_payments" to "service_role";
grant delete on table "public"."account_payments" to "service_role";
grant references on table "public"."account_payments" to "service_role";
grant trigger on table "public"."account_payments" to "service_role";
grant truncate on table "public"."account_payments" to "service_role";

-- ============================================================
-- RLS Policies: permissive for authenticated (matches stock pattern)
-- Admin enforcement is handled in the frontend.
-- ============================================================

create policy "Enable read access for authenticated users" on "public"."account_payments" as permissive for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on "public"."account_payments" as permissive for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on "public"."account_payments" as permissive for update to authenticated using (true) with check (true);
create policy "Account Payment Delete Policy" on "public"."account_payments" as permissive for delete to authenticated using (true);
