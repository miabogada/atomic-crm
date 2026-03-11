-- Audit query: tasks whose due dates were set or changed via the CRM UI
-- and may be off by 1 day due to the timezone bug (Pacific Time / UTC-7 PDT).
--
-- HOW THE BUG WORKS:
--   The UI stored due dates as UTC midnight (create path: via wrong local→UTC
--   conversion; edit path: as bare YYYY-MM-DD which Postgres cast to UTC midnight).
--   In PDT (UTC-7), UTC midnight displays as the PREVIOUS day at 5 PM local.
--   So a user who picked March 16 sees March 15 — and after the migration it
--   will STAY as March 15. The intended date is unrecoverable automatically.
--
-- SCOPE:
--   Only tasks created or updated via the CRM after the production go-live
--   (2026-03-10). Imported tasks are excluded from the review (they already
--   have wrong dates from the Exchange import — see Issue 1 in post-migration-plan.md).
--
-- ACTION:
--   Share the output with staff. For each task they should ask: "Is this the
--   correct due date, or should it be 1 day later?" They can correct via Edit.
--   High-priority items: court appearances, filing deadlines, client appointments.

SELECT
  a.account_number,
  a.name                                                AS account_name,
  t.id                                                  AS task_id,
  t.type                                                AS task_type,
  t.text                                                AS task_text,
  (t.due_date AT TIME ZONE 'America/Los_Angeles')::date AS due_date_displayed,
  CASE
    WHEN t.done_date IS NOT NULL
      THEN 'Done ' || (t.done_date AT TIME ZONE 'America/Los_Angeles')::date::text
    ELSE t.status
  END                                                   AS status,
  CASE
    WHEN t.created_at > '2026-03-10 00:00:00+00'
      THEN 'created in CRM'
    ELSE 'edited in CRM'
  END                                                   AS origin,
  (t.created_at  AT TIME ZONE 'America/Los_Angeles')::date AS created_date,
  (t.updated_at  AT TIME ZONE 'America/Los_Angeles')::date AS last_updated_date,
  u.first_name || ' ' || u.last_name                   AS assigned_to
FROM tasks t
LEFT JOIN accounts a  ON a.id  = t.account_id
LEFT JOIN users    u  ON u.id  = t.user_id
WHERE
  t.deleted_at IS NULL
  AND t.due_date IS NOT NULL
  AND (
    -- created via CRM after go-live
    t.created_at > '2026-03-10 00:00:00+00'
    OR
    -- imported task whose due date was subsequently changed via CRM
    (
      t.created_at <= '2026-03-10 00:00:00+00'
      AND t.updated_at > t.created_at + INTERVAL '2 minutes'
    )
  )
ORDER BY
  t.done_date IS NOT NULL,   -- open tasks first
  a.account_number,
  t.due_date;
