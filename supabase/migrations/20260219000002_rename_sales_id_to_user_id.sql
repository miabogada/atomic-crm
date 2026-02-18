-- Rename column: sales_id → user_id on all tables
-- Completes the sales → users rename started in 20260219000000_rename_sales_to_users.sql.
-- That migration renamed the TABLE but left FK columns as sales_id. This one finishes the job.

-- ============================================================
-- 1. Rename the column on every table that has it
-- ============================================================

ALTER TABLE accounts          RENAME COLUMN sales_id TO user_id;
ALTER TABLE account_contacts  RENAME COLUMN sales_id TO user_id;
ALTER TABLE account_contracts RENAME COLUMN sales_id TO user_id;
ALTER TABLE account_activities RENAME COLUMN sales_id TO user_id;
ALTER TABLE companies         RENAME COLUMN sales_id TO user_id;
ALTER TABLE contacts          RENAME COLUMN sales_id TO user_id;
ALTER TABLE contact_notes     RENAME COLUMN sales_id TO user_id;
ALTER TABLE deals             RENAME COLUMN sales_id TO user_id;
ALTER TABLE deal_notes        RENAME COLUMN sales_id TO user_id;
ALTER TABLE tasks             RENAME COLUMN sales_id TO user_id;

-- ============================================================
-- 2. Replace trigger function (CASCADE drops all 6 triggers)
-- ============================================================

DROP FUNCTION IF EXISTS set_sales_id_default() CASCADE;

CREATE OR REPLACE FUNCTION set_user_id_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT id INTO NEW.user_id FROM public.users WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers with new names
CREATE TRIGGER set_task_user_id_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();

CREATE TRIGGER set_contact_user_id_trigger
  BEFORE INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();

CREATE TRIGGER set_contact_notes_user_id_trigger
  BEFORE INSERT ON contact_notes
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();

CREATE TRIGGER set_company_user_id_trigger
  BEFORE INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();

CREATE TRIGGER set_deal_user_id_trigger
  BEFORE INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();

CREATE TRIGGER set_deal_notes_user_id_trigger
  BEFORE INSERT ON deal_notes
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();

-- ============================================================
-- 3. Recreate contacts_summary view (explicitly references column)
-- ============================================================

DROP VIEW IF EXISTS contacts_summary;

CREATE VIEW contacts_summary AS
SELECT
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.email_jsonb,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text AS email_fts,
    co.phone_jsonb,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text AS phone_fts,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.user_id,
    co.linkedin_url,
    c.name AS company_name,
    count(distinct t.id) AS nb_tasks
FROM
    contacts co
LEFT JOIN
    tasks t ON co.id = t.contact_id
LEFT JOIN
    companies c ON co.company_id = c.id
GROUP BY
    co.id, c.name;

-- ============================================================
-- 4. Recreate companies_summary view
--    (uses c.* which Postgres auto-updates, but recreate to be safe)
-- ============================================================

DROP VIEW IF EXISTS companies_summary;

CREATE VIEW companies_summary
    WITH (security_invoker=on) AS
SELECT
    c.*,
    count(distinct d.id) AS nb_deals,
    count(distinct co.id) AS nb_contacts
FROM
    companies c
LEFT JOIN
    deals d ON c.id = d.company_id
LEFT JOIN
    contacts co ON c.id = co.company_id
GROUP BY
    c.id;

-- ============================================================
-- 5. Recreate accounts_summary view
-- ============================================================

DROP VIEW IF EXISTS accounts_summary;

CREATE VIEW accounts_summary
    WITH (security_invoker=on) AS
SELECT
    a.*,
    bc.address_street AS billing_street,
    bc.address_city AS billing_city,
    bc.address_state AS billing_state,
    bc.address_postal_code AS billing_postal_code,
    bc.address_country AS billing_country,
    bc.full_name AS billing_contact_name,
    count(distinct ac.id) AS nb_contacts,
    count(distinct acon.id) AS nb_contracts,
    count(distinct t.id) FILTER (WHERE t.done_date IS NULL) AS nb_open_tasks
FROM
    accounts a
LEFT JOIN
    account_contacts bc ON a.id = bc.account_id AND bc.is_billing_contact = true
LEFT JOIN
    account_contacts ac ON a.id = ac.account_id
LEFT JOIN
    account_contracts acon ON a.id = acon.account_id
LEFT JOIN
    tasks t ON a.id = t.account_id
GROUP BY
    a.id, bc.address_street, bc.address_city, bc.address_state,
    bc.address_postal_code, bc.address_country, bc.full_name;

-- ============================================================
-- 6. Recreate merge_contacts() with user_id
-- ============================================================

CREATE OR REPLACE FUNCTION merge_contacts(loser_id bigint, winner_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  winner_contact contacts%ROWTYPE;
  loser_contact contacts%ROWTYPE;
  deal_record RECORD;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
BEGIN
  -- Fetch both contacts
  SELECT * INTO winner_contact FROM contacts WHERE id = winner_id;
  SELECT * INTO loser_contact FROM contacts WHERE id = loser_id;

  IF winner_contact IS NULL OR loser_contact IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- 1. Reassign tasks from loser to winner
  UPDATE tasks SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 2. Reassign contact notes from loser to winner
  UPDATE "contact_notes" SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 3. Update deals - replace loser with winner in contact_ids array
  FOR deal_record IN
    SELECT id, contact_ids
    FROM deals
    WHERE contact_ids @> ARRAY[loser_id]
  LOOP
    UPDATE deals
    SET contact_ids = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          array_remove(deal_record.contact_ids, loser_id) || ARRAY[winner_id]
        )
      )
    )
    WHERE id = deal_record.id;
  END LOOP;

  -- 4. Merge contact data

  -- Get email arrays
  winner_emails := COALESCE(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := COALESCE(loser_contact.email_jsonb, '[]'::jsonb);

  -- Merge emails with deduplication by email address
  email_map := '{}'::jsonb;

  IF jsonb_array_length(winner_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_emails)-1 LOOP
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    END LOOP;
  END IF;

  IF jsonb_array_length(loser_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_emails)-1 LOOP
      IF NOT email_map ? (loser_emails->i->>'email') THEN
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      END IF;
    END LOOP;
  END IF;

  merged_emails := (SELECT jsonb_agg(value) FROM jsonb_each(email_map));
  merged_emails := COALESCE(merged_emails, '[]'::jsonb);

  -- Get phone arrays
  winner_phones := COALESCE(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := COALESCE(loser_contact.phone_jsonb, '[]'::jsonb);

  phone_map := '{}'::jsonb;

  IF jsonb_array_length(winner_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_phones)-1 LOOP
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    END LOOP;
  END IF;

  IF jsonb_array_length(loser_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_phones)-1 LOOP
      IF NOT phone_map ? (loser_phones->i->>'number') THEN
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      END IF;
    END LOOP;
  END IF;

  merged_phones := (SELECT jsonb_agg(value) FROM jsonb_each(phone_map));
  merged_phones := COALESCE(merged_phones, '[]'::jsonb);

  -- Merge tags (remove duplicates)
  merged_tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(winner_contact.tags, ARRAY[]::bigint[]) ||
      COALESCE(loser_contact.tags, ARRAY[]::bigint[])
    )
  );

  -- 5. Update winner with merged data
  UPDATE contacts SET
    avatar = COALESCE(winner_contact.avatar, loser_contact.avatar),
    gender = COALESCE(winner_contact.gender, loser_contact.gender),
    first_name = COALESCE(winner_contact.first_name, loser_contact.first_name),
    last_name = COALESCE(winner_contact.last_name, loser_contact.last_name),
    title = COALESCE(winner_contact.title, loser_contact.title),
    company_id = COALESCE(winner_contact.company_id, loser_contact.company_id),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    linkedin_url = COALESCE(winner_contact.linkedin_url, loser_contact.linkedin_url),
    background = COALESCE(winner_contact.background, loser_contact.background),
    has_newsletter = COALESCE(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = LEAST(COALESCE(winner_contact.first_seen, loser_contact.first_seen), COALESCE(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = GREATEST(COALESCE(winner_contact.last_seen, loser_contact.last_seen), COALESCE(loser_contact.last_seen, winner_contact.last_seen)),
    user_id = COALESCE(winner_contact.user_id, loser_contact.user_id),
    tags = merged_tags
  WHERE id = winner_id;

  -- 6. Delete loser contact
  DELETE FROM contacts WHERE id = loser_id;

  RETURN winner_id;
END;
$$;

-- ============================================================
-- 7. Rename FK constraints
-- ============================================================

ALTER TABLE companies         RENAME CONSTRAINT "companies_sales_id_fkey"          TO "companies_user_id_fkey";
ALTER TABLE contact_notes     RENAME CONSTRAINT "contactNotes_sales_id_fkey"       TO "contact_notes_user_id_fkey";
ALTER TABLE contacts          RENAME CONSTRAINT "contacts_sales_id_fkey"           TO "contacts_user_id_fkey";
ALTER TABLE deal_notes        RENAME CONSTRAINT "dealNotes_sales_id_fkey"          TO "deal_notes_user_id_fkey";
ALTER TABLE deals             RENAME CONSTRAINT "deals_sales_id_fkey"              TO "deals_user_id_fkey";
ALTER TABLE accounts          RENAME CONSTRAINT "accounts_sales_id_fkey"           TO "accounts_user_id_fkey";
ALTER TABLE account_contacts  RENAME CONSTRAINT "account_contacts_sales_id_fkey"   TO "account_contacts_user_id_fkey";
ALTER TABLE account_contracts RENAME CONSTRAINT "account_contracts_sales_id_fkey"  TO "account_contracts_user_id_fkey";
ALTER TABLE account_activities RENAME CONSTRAINT "account_activities_sales_id_fkey" TO "account_activities_user_id_fkey";

-- ============================================================
-- 8. Reload PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
