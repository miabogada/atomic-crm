-- Clarklaw Immigration Law Office Schema
-- Replaces Exchange 2003 public folder + Outlook forms CRM

-- ============================================================
-- Lookup table: contact_types
-- ============================================================

create table "public"."contact_types" (
    "id" bigint generated always as identity not null,
    "name" text unique not null
);

alter table "public"."contact_types" enable row level security;

CREATE UNIQUE INDEX contact_types_pkey ON public.contact_types USING btree (id);
alter table "public"."contact_types" add constraint "contact_types_pkey" PRIMARY KEY using index "contact_types_pkey";

insert into "public"."contact_types" ("name") values
    ('petitioner'),
    ('beneficiary'),
    ('billing'),
    ('spouse'),
    ('employer'),
    ('other');

-- ============================================================
-- accounts (replaces IPM.Post.Account info + tblClients)
-- ============================================================

create table "public"."accounts" (
    "id" bigint generated always as identity not null,
    "account_number" text unique not null,
    "name" text not null,
    "phone" text,
    "email" text,
    "attorney_id" bigint,
    "law_clerk_id" bigint,
    "legal_assistant_id" bigint,
    "date_opened" date,
    "date_closed" date,
    "date_first_consult" date,
    "categories" text default 'In Process',
    "referred_by" text,
    "notes" text,
    "archived" boolean not null default false,
    "archive_year" integer,
    "stripe_customer_id" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    "sales_id" bigint
);

alter table "public"."accounts" enable row level security;

CREATE UNIQUE INDEX accounts_pkey ON public.accounts USING btree (id);
alter table "public"."accounts" add constraint "accounts_pkey" PRIMARY KEY using index "accounts_pkey";

alter table "public"."accounts" add constraint "accounts_attorney_id_fkey" FOREIGN KEY (attorney_id) REFERENCES sales(id) not valid;
alter table "public"."accounts" validate constraint "accounts_attorney_id_fkey";

alter table "public"."accounts" add constraint "accounts_law_clerk_id_fkey" FOREIGN KEY (law_clerk_id) REFERENCES sales(id) not valid;
alter table "public"."accounts" validate constraint "accounts_law_clerk_id_fkey";

alter table "public"."accounts" add constraint "accounts_legal_assistant_id_fkey" FOREIGN KEY (legal_assistant_id) REFERENCES sales(id) not valid;
alter table "public"."accounts" validate constraint "accounts_legal_assistant_id_fkey";

alter table "public"."accounts" add constraint "accounts_sales_id_fkey" FOREIGN KEY (sales_id) REFERENCES sales(id) not valid;
alter table "public"."accounts" validate constraint "accounts_sales_id_fkey";

-- ============================================================
-- account_contacts (replaces IPM.Contact.Account contact)
-- ============================================================

create table "public"."account_contacts" (
    "id" bigint generated always as identity not null,
    "account_id" bigint not null,
    "contact_type_id" bigint,
    "is_billing_contact" boolean not null default false,
    "full_name" text not null,
    "email" text,
    "phone" text,
    "address_street" text,
    "address_city" text,
    "address_state" text,
    "address_postal_code" text,
    "address_country" text,
    "created_at" timestamptz not null default now(),
    "sales_id" bigint
);

alter table "public"."account_contacts" enable row level security;

CREATE UNIQUE INDEX account_contacts_pkey ON public.account_contacts USING btree (id);
alter table "public"."account_contacts" add constraint "account_contacts_pkey" PRIMARY KEY using index "account_contacts_pkey";

-- At most one billing contact per account
CREATE UNIQUE INDEX account_contacts_billing_unique ON public.account_contacts (account_id) WHERE is_billing_contact = true;

alter table "public"."account_contacts" add constraint "account_contacts_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
alter table "public"."account_contacts" validate constraint "account_contacts_account_id_fkey";

alter table "public"."account_contacts" add constraint "account_contacts_contact_type_id_fkey" FOREIGN KEY (contact_type_id) REFERENCES contact_types(id) not valid;
alter table "public"."account_contacts" validate constraint "account_contacts_contact_type_id_fkey";

alter table "public"."account_contacts" add constraint "account_contacts_sales_id_fkey" FOREIGN KEY (sales_id) REFERENCES sales(id) not valid;
alter table "public"."account_contacts" validate constraint "account_contacts_sales_id_fkey";

-- ============================================================
-- account_contracts (replaces IPM.Post.Account contract + tblContracts)
-- ============================================================

create table "public"."account_contracts" (
    "id" bigint generated always as identity not null,
    "account_id" bigint not null,
    "contract_number" text,
    "case_type" text,
    "fee" numeric,
    "retainer" numeric,
    "monthly_payment" numeric,
    "num_payments" integer,
    "date_opened" date,
    "date_retainer" date,
    "date_first_payment" date,
    "work_description" text,
    "created_at" timestamptz not null default now(),
    "sales_id" bigint
);

alter table "public"."account_contracts" enable row level security;

CREATE UNIQUE INDEX account_contracts_pkey ON public.account_contracts USING btree (id);
alter table "public"."account_contracts" add constraint "account_contracts_pkey" PRIMARY KEY using index "account_contracts_pkey";

alter table "public"."account_contracts" add constraint "account_contracts_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
alter table "public"."account_contracts" validate constraint "account_contracts_account_id_fkey";

alter table "public"."account_contracts" add constraint "account_contracts_sales_id_fkey" FOREIGN KEY (sales_id) REFERENCES sales(id) not valid;
alter table "public"."account_contracts" validate constraint "account_contracts_sales_id_fkey";

-- ============================================================
-- account_tasks (replaces IPM.Task.Account task)
-- ============================================================

create table "public"."account_tasks" (
    "id" bigint generated always as identity not null,
    "account_id" bigint not null,
    "parent_type" text,
    "parent_id" bigint,
    "subject" text not null,
    "body" text,
    "due_date" date,
    "done_date" date,
    "assigned_to" bigint,
    "created_at" timestamptz not null default now(),
    "sales_id" bigint
);

alter table "public"."account_tasks" enable row level security;

CREATE UNIQUE INDEX account_tasks_pkey ON public.account_tasks USING btree (id);
alter table "public"."account_tasks" add constraint "account_tasks_pkey" PRIMARY KEY using index "account_tasks_pkey";

alter table "public"."account_tasks" add constraint "account_tasks_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
alter table "public"."account_tasks" validate constraint "account_tasks_account_id_fkey";

alter table "public"."account_tasks" add constraint "account_tasks_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES sales(id) not valid;
alter table "public"."account_tasks" validate constraint "account_tasks_assigned_to_fkey";

alter table "public"."account_tasks" add constraint "account_tasks_sales_id_fkey" FOREIGN KEY (sales_id) REFERENCES sales(id) not valid;
alter table "public"."account_tasks" validate constraint "account_tasks_sales_id_fkey";

-- ============================================================
-- account_activities (replaces IPM.Activity.Account activity + notes)
-- ============================================================

create table "public"."account_activities" (
    "id" bigint generated always as identity not null,
    "account_id" bigint not null,
    "parent_type" text,
    "parent_id" bigint,
    "type" text,
    "subject" text not null,
    "body" text,
    "date" timestamptz,
    "attachments" jsonb[],
    "created_at" timestamptz not null default now(),
    "sales_id" bigint
);

alter table "public"."account_activities" enable row level security;

CREATE UNIQUE INDEX account_activities_pkey ON public.account_activities USING btree (id);
alter table "public"."account_activities" add constraint "account_activities_pkey" PRIMARY KEY using index "account_activities_pkey";

alter table "public"."account_activities" add constraint "account_activities_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
alter table "public"."account_activities" validate constraint "account_activities_account_id_fkey";

alter table "public"."account_activities" add constraint "account_activities_sales_id_fkey" FOREIGN KEY (sales_id) REFERENCES sales(id) not valid;
alter table "public"."account_activities" validate constraint "account_activities_sales_id_fkey";

-- ============================================================
-- Function: generate_account_number()
-- Implements YYMMDD## auto-generation with daily sequence
-- ============================================================

create or replace function public.generate_account_number()
returns text
language plpgsql
as $$
declare
    date_prefix text;
    seq integer;
    candidate text;
begin
    date_prefix := to_char(now(), 'YYMMDD');
    -- Find the max sequence for today's prefix
    select coalesce(
        max(substring(account_number from 7 for 2)::integer),
        0
    ) + 1
    into seq
    from public.accounts
    where account_number like date_prefix || '%';

    candidate := date_prefix || lpad(seq::text, 2, '0');

    -- Safety: if somehow the candidate exists, keep incrementing
    while exists (select 1 from public.accounts where account_number = candidate) loop
        seq := seq + 1;
        candidate := date_prefix || lpad(seq::text, 2, '0');
    end loop;

    return candidate;
end;
$$;

-- ============================================================
-- View: accounts_summary
-- Joins accounts with billing contact address and counts
-- ============================================================

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
    count(distinct at2.id) filter (where at2.done_date is null) as nb_open_tasks
from
    "public"."accounts" a
left join
    "public"."account_contacts" bc on a.id = bc.account_id and bc.is_billing_contact = true
left join
    "public"."account_contacts" ac on a.id = ac.account_id
left join
    "public"."account_contracts" acon on a.id = acon.account_id
left join
    "public"."account_tasks" at2 on a.id = at2.account_id
group by
    a.id, bc.address_street, bc.address_city, bc.address_state,
    bc.address_postal_code, bc.address_country, bc.full_name;

-- ============================================================
-- Grants: authenticated + service_role for all new tables
-- ============================================================

-- contact_types
grant select on table "public"."contact_types" to "authenticated";
grant insert on table "public"."contact_types" to "authenticated";
grant update on table "public"."contact_types" to "authenticated";
grant delete on table "public"."contact_types" to "authenticated";

grant select on table "public"."contact_types" to "service_role";
grant insert on table "public"."contact_types" to "service_role";
grant update on table "public"."contact_types" to "service_role";
grant delete on table "public"."contact_types" to "service_role";
grant references on table "public"."contact_types" to "service_role";
grant trigger on table "public"."contact_types" to "service_role";
grant truncate on table "public"."contact_types" to "service_role";

-- accounts
grant select on table "public"."accounts" to "authenticated";
grant insert on table "public"."accounts" to "authenticated";
grant update on table "public"."accounts" to "authenticated";
grant delete on table "public"."accounts" to "authenticated";

grant select on table "public"."accounts" to "service_role";
grant insert on table "public"."accounts" to "service_role";
grant update on table "public"."accounts" to "service_role";
grant delete on table "public"."accounts" to "service_role";
grant references on table "public"."accounts" to "service_role";
grant trigger on table "public"."accounts" to "service_role";
grant truncate on table "public"."accounts" to "service_role";

-- account_contacts
grant select on table "public"."account_contacts" to "authenticated";
grant insert on table "public"."account_contacts" to "authenticated";
grant update on table "public"."account_contacts" to "authenticated";
grant delete on table "public"."account_contacts" to "authenticated";

grant select on table "public"."account_contacts" to "service_role";
grant insert on table "public"."account_contacts" to "service_role";
grant update on table "public"."account_contacts" to "service_role";
grant delete on table "public"."account_contacts" to "service_role";
grant references on table "public"."account_contacts" to "service_role";
grant trigger on table "public"."account_contacts" to "service_role";
grant truncate on table "public"."account_contacts" to "service_role";

-- account_contracts
grant select on table "public"."account_contracts" to "authenticated";
grant insert on table "public"."account_contracts" to "authenticated";
grant update on table "public"."account_contracts" to "authenticated";
grant delete on table "public"."account_contracts" to "authenticated";

grant select on table "public"."account_contracts" to "service_role";
grant insert on table "public"."account_contracts" to "service_role";
grant update on table "public"."account_contracts" to "service_role";
grant delete on table "public"."account_contracts" to "service_role";
grant references on table "public"."account_contracts" to "service_role";
grant trigger on table "public"."account_contracts" to "service_role";
grant truncate on table "public"."account_contracts" to "service_role";

-- account_tasks
grant select on table "public"."account_tasks" to "authenticated";
grant insert on table "public"."account_tasks" to "authenticated";
grant update on table "public"."account_tasks" to "authenticated";
grant delete on table "public"."account_tasks" to "authenticated";

grant select on table "public"."account_tasks" to "service_role";
grant insert on table "public"."account_tasks" to "service_role";
grant update on table "public"."account_tasks" to "service_role";
grant delete on table "public"."account_tasks" to "service_role";
grant references on table "public"."account_tasks" to "service_role";
grant trigger on table "public"."account_tasks" to "service_role";
grant truncate on table "public"."account_tasks" to "service_role";

-- account_activities
grant select on table "public"."account_activities" to "authenticated";
grant insert on table "public"."account_activities" to "authenticated";
grant update on table "public"."account_activities" to "authenticated";
grant delete on table "public"."account_activities" to "authenticated";

grant select on table "public"."account_activities" to "service_role";
grant insert on table "public"."account_activities" to "service_role";
grant update on table "public"."account_activities" to "service_role";
grant delete on table "public"."account_activities" to "service_role";
grant references on table "public"."account_activities" to "service_role";
grant trigger on table "public"."account_activities" to "service_role";
grant truncate on table "public"."account_activities" to "service_role";

-- ============================================================
-- RLS Policies: permissive for authenticated (matches stock pattern)
-- ============================================================

-- contact_types (read-only for most users, but allow full access)
create policy "Enable read access for authenticated users" on "public"."contact_types" as permissive for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on "public"."contact_types" as permissive for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on "public"."contact_types" as permissive for update to authenticated using (true) with check (true);
create policy "Enable delete for authenticated users" on "public"."contact_types" as permissive for delete to authenticated using (true);

-- accounts
create policy "Enable read access for authenticated users" on "public"."accounts" as permissive for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on "public"."accounts" as permissive for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on "public"."accounts" as permissive for update to authenticated using (true) with check (true);
create policy "Account Delete Policy" on "public"."accounts" as permissive for delete to authenticated using (true);

-- account_contacts
create policy "Enable read access for authenticated users" on "public"."account_contacts" as permissive for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on "public"."account_contacts" as permissive for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on "public"."account_contacts" as permissive for update to authenticated using (true) with check (true);
create policy "Account Contact Delete Policy" on "public"."account_contacts" as permissive for delete to authenticated using (true);

-- account_contracts
create policy "Enable read access for authenticated users" on "public"."account_contracts" as permissive for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on "public"."account_contracts" as permissive for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on "public"."account_contracts" as permissive for update to authenticated using (true) with check (true);
create policy "Account Contract Delete Policy" on "public"."account_contracts" as permissive for delete to authenticated using (true);

-- account_tasks
create policy "Enable read access for authenticated users" on "public"."account_tasks" as permissive for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on "public"."account_tasks" as permissive for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on "public"."account_tasks" as permissive for update to authenticated using (true) with check (true);
create policy "Account Task Delete Policy" on "public"."account_tasks" as permissive for delete to authenticated using (true);

-- account_activities
create policy "Enable read access for authenticated users" on "public"."account_activities" as permissive for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on "public"."account_activities" as permissive for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on "public"."account_activities" as permissive for update to authenticated using (true) with check (true);
create policy "Account Activity Delete Policy" on "public"."account_activities" as permissive for delete to authenticated using (true);
