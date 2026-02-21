-- Backfill existing contract numbers to {account_number}{alpha_suffix} format.
-- row_number() starts at 1, so chr(64 + 1) = 'A', chr(64 + 2) = 'B', etc.
update public.account_contracts ac
set contract_number = sub.new_contract_number
from (
  select
    ac2.id,
    a.account_number || chr(
      64 + row_number() over (
        partition by ac2.account_id
        order by ac2.created_at, ac2.id
      )::integer
    ) as new_contract_number
  from public.account_contracts ac2
  join public.accounts a on a.id = ac2.account_id
) sub
where ac.id = sub.id;
