-- Generate a contract number: {account_number}{alpha_suffix}
-- where alpha_suffix = A for the first contract, B for the second, etc.
create or replace function public.generate_contract_number(p_account_id bigint)
returns text
language plpgsql
as $$
declare
  v_account_number text;
  v_count          integer;
begin
  select account_number into v_account_number
  from public.accounts
  where id = p_account_id;

  if v_account_number is null then
    raise exception 'Account not found: %', p_account_id;
  end if;

  select count(*) into v_count
  from public.account_contracts
  where account_id = p_account_id;

  if v_count >= 26 then
    raise exception 'Maximum contracts per account (26) exceeded for account %', p_account_id;
  end if;

  return v_account_number || chr(65 + v_count);
end;
$$;

-- Trigger function: auto-set contract_number on insert if not provided
create or replace function public.set_contract_number()
returns trigger
language plpgsql
as $$
begin
  if new.contract_number is null or new.contract_number = '' then
    new.contract_number := public.generate_contract_number(new.account_id);
  end if;
  return new;
end;
$$;

create trigger trg_set_contract_number
  before insert on public.account_contracts
  for each row
  execute function public.set_contract_number();
