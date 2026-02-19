-- Add status column to account_contracts
alter table "public"."account_contracts"
  add column "status" text not null default 'To do';

notify pgrst, 'reload schema';
