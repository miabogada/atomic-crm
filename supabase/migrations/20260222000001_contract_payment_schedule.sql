-- ============================================================
-- Table: contract_payment_schedule
-- Stores the expected payment schedule for each contract.
-- payment_number = 0 → retainer; 1..N → installments
-- ============================================================

create table public.contract_payment_schedule (
  id             bigint generated always as identity not null,
  contract_id    bigint not null,
  account_id     bigint not null,
  payment_number integer not null,
  due_date       date not null,
  amount         numeric(10,2) not null,
  payment_id     bigint,
  created_at     timestamptz not null default now()
);

create unique index contract_payment_schedule_pkey
  on public.contract_payment_schedule using btree (id);
alter table public.contract_payment_schedule
  add constraint contract_payment_schedule_pkey
  primary key using index contract_payment_schedule_pkey;

alter table public.contract_payment_schedule
  add constraint cps_contract_id_fkey
  foreign key (contract_id) references public.account_contracts(id)
  on update cascade on delete cascade not valid;
alter table public.contract_payment_schedule
  validate constraint cps_contract_id_fkey;

alter table public.contract_payment_schedule
  add constraint cps_account_id_fkey
  foreign key (account_id) references public.accounts(id)
  on update cascade on delete cascade not valid;
alter table public.contract_payment_schedule
  validate constraint cps_account_id_fkey;

alter table public.contract_payment_schedule
  add constraint cps_payment_id_fkey
  foreign key (payment_id) references public.account_payments(id)
  on delete set null not valid;
alter table public.contract_payment_schedule
  validate constraint cps_payment_id_fkey;

create index on public.contract_payment_schedule (contract_id);
create index on public.contract_payment_schedule (due_date);
create index on public.contract_payment_schedule (account_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.contract_payment_schedule enable row level security;

create policy "authenticated can select contract_payment_schedule"
  on public.contract_payment_schedule for select to authenticated using (true);
create policy "authenticated can insert contract_payment_schedule"
  on public.contract_payment_schedule for insert to authenticated with check (true);
create policy "authenticated can update contract_payment_schedule"
  on public.contract_payment_schedule for update to authenticated using (true);
create policy "authenticated can delete contract_payment_schedule"
  on public.contract_payment_schedule for delete to authenticated using (true);

-- ============================================================
-- Function: generate_payment_schedule(p_contract_id bigint)
-- Regenerates unpaid schedule rows from current contract terms.
-- Retainer row uses payment_number = 0.
-- Installments use payment_number = 1..N, aligned to same day
-- of month as date_first_payment using make_interval(months=>).
-- ============================================================

create or replace function public.generate_payment_schedule(p_contract_id bigint)
returns void
language plpgsql
as $$
declare
  v_contract record;
  i          integer;
begin
  select * into v_contract
  from public.account_contracts
  where id = p_contract_id;

  if not found then
    raise exception 'Contract not found: %', p_contract_id;
  end if;

  -- Remove existing unpaid rows so we can regenerate cleanly.
  -- Paid rows (payment_id IS NOT NULL) are preserved.
  delete from public.contract_payment_schedule
  where contract_id = p_contract_id
    and payment_id is null;

  -- Retainer row (payment_number = 0)
  if v_contract.retainer is not null and v_contract.retainer > 0
     and v_contract.date_retainer is not null then
    insert into public.contract_payment_schedule
      (contract_id, account_id, payment_number, due_date, amount)
    values
      (p_contract_id, v_contract.account_id, 0,
       v_contract.date_retainer, v_contract.retainer);
  end if;

  -- Installment rows (payment_number = 1..N)
  -- Due dates stay on the same calendar day as date_first_payment.
  if v_contract.num_payments is not null and v_contract.num_payments > 0
     and v_contract.monthly_payment is not null and v_contract.monthly_payment > 0
     and v_contract.date_first_payment is not null then
    for i in 1..v_contract.num_payments loop
      insert into public.contract_payment_schedule
        (contract_id, account_id, payment_number, due_date, amount)
      values (
        p_contract_id,
        v_contract.account_id,
        i,
        (v_contract.date_first_payment + make_interval(months => i - 1))::date,
        case
          when i = v_contract.num_payments
               and v_contract.final_payment is not null
            then v_contract.final_payment
          else v_contract.monthly_payment
        end
      );
    end loop;
  end if;
end;
$$;

-- ============================================================
-- Trigger: auto-generate schedule after contract insert
-- ============================================================

create or replace function public.trg_fn_generate_payment_schedule()
returns trigger
language plpgsql
as $$
begin
  perform public.generate_payment_schedule(new.id);
  return new;
end;
$$;

create trigger trg_generate_payment_schedule
  after insert on public.account_contracts
  for each row
  execute function public.trg_fn_generate_payment_schedule();

-- ============================================================
-- View: contract_payment_schedule_view
-- Adds computed status and denormalized account/contract info.
-- status is computed at query time so it never goes stale.
-- ============================================================

create or replace view public.contract_payment_schedule_view
  with (security_invoker = on)
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
  a.name         as account_name,
  a.account_number,
  case
    when cps.payment_id is not null then 'paid'
    when cps.due_date  < current_date then 'late'
    when cps.due_date  = current_date then 'due'
    else 'upcoming'
  end as status
from public.contract_payment_schedule cps
join public.account_contracts ac on ac.id = cps.contract_id
join public.accounts          a  on a.id  = cps.account_id;

grant select on public.contract_payment_schedule_view to authenticated;
