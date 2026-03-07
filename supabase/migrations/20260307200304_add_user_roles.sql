-- Add role column to users table for auto-assignment of team fields on accounts
ALTER TABLE users ADD COLUMN role text;

-- Backfill existing users
UPDATE users SET role = 'attorney' WHERE email = 'lmc@tanoclark.com';
UPDATE users SET role = 'law_clerk' WHERE email = 'assistant@tanoclark.com';
UPDATE users SET role = 'legal_assistant' WHERE email = 'clerk@tanoclark.com';
-- fcc@tanoclark.com (admin/dev) has no role intentionally
