-- Add status column with default 'To do'
alter table "public"."tasks" add column "status" text not null default 'To do';

-- Backfill: tasks with done_date get 'Done', others stay 'To do'
update "public"."tasks" set status = 'Done' where done_date is not null;

notify pgrst, 'reload schema';
