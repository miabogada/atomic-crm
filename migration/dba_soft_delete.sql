-- ============================================================
-- DBA Soft Delete Management Scripts
--
-- These queries are meant to be run manually by a DBA when
-- needed. They are NOT part of the application flow.
-- ============================================================

-- ============================================================
-- 1. VIEW: List all soft-deleted records
-- ============================================================

-- Soft-deleted accounts (with child counts)
SELECT
  a.id,
  a.account_number,
  a.name,
  a.deleted_at,
  (SELECT count(*) FROM account_contacts   WHERE account_id = a.id AND deleted_at IS NOT NULL) AS deleted_contacts,
  (SELECT count(*) FROM account_contracts   WHERE account_id = a.id AND deleted_at IS NOT NULL) AS deleted_contracts,
  (SELECT count(*) FROM account_payments    WHERE account_id = a.id AND deleted_at IS NOT NULL) AS deleted_payments,
  (SELECT count(*) FROM tasks               WHERE account_id = a.id AND deleted_at IS NOT NULL) AS deleted_tasks,
  (SELECT count(*) FROM account_activities  WHERE account_id = a.id AND deleted_at IS NOT NULL) AS deleted_activities
FROM accounts a
WHERE a.deleted_at IS NOT NULL
ORDER BY a.deleted_at DESC;

-- All soft-deleted records across tables
SELECT 'accounts' AS resource, id, deleted_at FROM accounts WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'account_contacts', id, deleted_at FROM account_contacts WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'account_contracts', id, deleted_at FROM account_contracts WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'account_payments', id, deleted_at FROM account_payments WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'account_activities', id, deleted_at FROM account_activities WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'tasks', id, deleted_at FROM tasks WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;


-- ============================================================
-- 2. RESTORE: Un-delete a soft-deleted account and its children
--
-- PREFERRED: Use the interactive script instead of raw SQL:
--   python scripts/undelete.py --list
--   python scripts/undelete.py accounts <ID>
--   python scripts/undelete.py --prod accounts <ID>
--
-- The cascade trigger on accounts automatically restores
-- children that were deleted at the same timestamp.
-- ============================================================

-- Restore by account ID:
-- UPDATE accounts SET deleted_at = NULL WHERE id = <ACCOUNT_ID>;

-- Restore a single child record (e.g. a contact deleted independently):
-- UPDATE account_contacts SET deleted_at = NULL WHERE id = <CONTACT_ID>;


-- ============================================================
-- 3. HARD DELETE: Permanently remove soft-deleted records
--
-- Run children first (bottom-up) to satisfy FK constraints.
-- FK constraints are ON DELETE RESTRICT, so parent deletion
-- will fail if children still exist.
-- ============================================================

-- Hard delete all records soft-deleted more than 90 days ago:
/*
BEGIN;

-- Children first
DELETE FROM contract_payment_schedule
WHERE contract_id IN (
  SELECT id FROM account_contracts WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days'
);

DELETE FROM account_activities
WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days';

DELETE FROM tasks
WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days';

DELETE FROM account_payments
WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days';

DELETE FROM account_contracts
WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days';

DELETE FROM account_contacts
WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days';

-- Parents last
DELETE FROM accounts
WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days';

COMMIT;
*/

-- Hard delete a specific account and all its children:
/*
BEGIN;

DELETE FROM contract_payment_schedule
WHERE account_id = <ACCOUNT_ID>;

DELETE FROM account_activities
WHERE account_id = <ACCOUNT_ID>;

DELETE FROM tasks
WHERE account_id = <ACCOUNT_ID>;

DELETE FROM account_payments
WHERE account_id = <ACCOUNT_ID>;

DELETE FROM account_contracts
WHERE account_id = <ACCOUNT_ID>;

DELETE FROM account_contacts
WHERE account_id = <ACCOUNT_ID>;

DELETE FROM accounts
WHERE id = <ACCOUNT_ID>;

COMMIT;
*/
