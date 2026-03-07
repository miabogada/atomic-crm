-- Fix: when final_payment is 0 or null, use monthly_payment for the last installment.
-- Previously, final_payment = 0 would create a $0 last payment row.

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
               and v_contract.final_payment > 0
            then v_contract.final_payment
          else v_contract.monthly_payment
        end
      );
    end loop;
  end if;
end;
$$;
