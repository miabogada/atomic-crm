-- ============================================================
-- Expand soft-delete cascades for contracts and tasks
--
-- Contract delete → cascade to linked payments, tasks,
--   activities, and payment schedule rows
-- Task delete → cascade to child activities
-- ============================================================

-- 1. Replace contract cascade trigger with expanded version
create or replace function soft_delete_cascade_contract()
returns trigger as $$
begin
  if NEW.deleted_at is not null and OLD.deleted_at is null then
    -- Soft-deleting: cascade to children
    update account_payments   set deleted_at = NEW.deleted_at
      where contract_id = NEW.id and deleted_at is null;
    update tasks              set deleted_at = NEW.deleted_at
      where parent_type in ('account_contract', 'account_contracts')
        and parent_id = NEW.id and deleted_at is null;
    update account_activities set deleted_at = NEW.deleted_at
      where parent_type in ('account_contract', 'account_contracts')
        and parent_id = NEW.id and deleted_at is null;
    -- Clear payment schedule links (schedule rows are not soft-deleted,
    -- they become orphaned and will be cleaned up if contract is purged)
    update contract_payment_schedule set payment_id = null
      where contract_id = NEW.id;
  elsif NEW.deleted_at is null and OLD.deleted_at is not null then
    -- Restoring: un-delete children cascade-deleted at the same timestamp
    update account_payments   set deleted_at = null
      where contract_id = NEW.id and deleted_at = OLD.deleted_at;
    update tasks              set deleted_at = null
      where parent_type in ('account_contract', 'account_contracts')
        and parent_id = NEW.id and deleted_at = OLD.deleted_at;
    update account_activities set deleted_at = null
      where parent_type in ('account_contract', 'account_contracts')
        and parent_id = NEW.id and deleted_at = OLD.deleted_at;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- 2. Add task cascade trigger (task → child activities)
create or replace function soft_delete_cascade_task()
returns trigger as $$
begin
  if NEW.deleted_at is not null and OLD.deleted_at is null then
    update account_activities set deleted_at = NEW.deleted_at
      where parent_type = 'tasks'
        and parent_id = NEW.id and deleted_at is null;
  elsif NEW.deleted_at is null and OLD.deleted_at is not null then
    update account_activities set deleted_at = null
      where parent_type = 'tasks'
        and parent_id = NEW.id and deleted_at = OLD.deleted_at;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_soft_delete_cascade_task
  after update of deleted_at on tasks
  for each row
  execute function soft_delete_cascade_task();
