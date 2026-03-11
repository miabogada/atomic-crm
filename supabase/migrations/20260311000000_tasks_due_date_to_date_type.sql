-- Change tasks.due_date from timestamptz to date.
--
-- The timestamptz column caused an off-by-one-day bug for users in negative
-- UTC offsets (e.g. Pacific Time UTC-8): the frontend transform parsed the
-- YYYY-MM-DD string as UTC midnight, then set it to local midnight before
-- calling toISOString(), shifting the stored timestamp one day behind the
-- intended date.
--
-- Switching to the date type eliminates timezone handling entirely. The
-- USING clause recovers the local date from existing stored UTC timestamps
-- using the America/Chicago timezone.

ALTER TABLE tasks
  ALTER COLUMN due_date TYPE date
  USING (due_date AT TIME ZONE 'America/Los_Angeles')::date;
