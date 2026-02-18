-- Rename table: sales → users
-- FKs, indexes, and constraints referencing the table are updated automatically by Postgres.
-- We must manually update: functions, triggers, views, and RLS policies that reference "sales" by name.

-- ============================================================
-- 1. Rename the table
-- ============================================================

alter table "public"."sales" rename to "users";

-- ============================================================
-- 2. Recreate handle_new_user() to reference "users" table
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  user_count int;
begin
  select count(id) into user_count
  from public.users;

  insert into public.users (first_name, last_name, email, user_id, administrator)
  values (
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    new.id,
    case when user_count > 0 then FALSE else TRUE end
  );
  return new;
end;
$$;

-- ============================================================
-- 3. Recreate handle_update_user() to reference "users" table
-- ============================================================

create or replace function public.handle_update_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.users
  set
    first_name = new.raw_user_meta_data ->> 'first_name',
    last_name = new.raw_user_meta_data ->> 'last_name',
    email = new.email
  where user_id = new.id;

  return new;
end;
$$;

-- ============================================================
-- 4. Recreate set_sales_id_default() to reference "users" table
-- ============================================================

CREATE OR REPLACE FUNCTION set_sales_id_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM public.users WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Recreate init_state view to reference "users" table
-- ============================================================

drop view if exists init_state;

create view init_state
  with (security_invoker=off)
  as
select count(id) as is_initialized
from public.users
limit 1;

-- ============================================================
-- 6. Recreate accounts_summary view (references are fine since
--    account_contacts/account_contracts/tasks don't change name,
--    but the view must be recreated if it joins users anywhere)
-- ============================================================
-- accounts_summary doesn't join sales/users directly, so no change needed.

-- ============================================================
-- 7. Grant permissions on renamed table
-- ============================================================
-- ALTER TABLE RENAME preserves grants, so no action needed.

-- ============================================================
-- 8. Reload PostgREST schema cache
-- ============================================================

notify pgrst, 'reload schema';
