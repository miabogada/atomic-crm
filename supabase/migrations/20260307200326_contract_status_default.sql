-- Change contract status default from 'To do' to 'In process'
ALTER TABLE account_contracts ALTER COLUMN status SET DEFAULT 'In process';

-- Update any existing contracts with 'To do' status
UPDATE account_contracts SET status = 'In process' WHERE status = 'To do';
