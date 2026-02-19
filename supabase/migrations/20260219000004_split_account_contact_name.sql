-- Split account_contacts.full_name into first_name + last_name

-- 1. Add new columns
ALTER TABLE account_contacts ADD COLUMN first_name text;
ALTER TABLE account_contacts ADD COLUMN last_name text;

-- 2. Migrate data: split full_name on first space
UPDATE account_contacts
SET first_name = split_part(full_name, ' ', 1),
    last_name  = CASE
      WHEN position(' ' in full_name) > 0
        THEN substring(full_name from position(' ' in full_name) + 1)
      ELSE ''
    END;

-- 3. Make first_name NOT NULL (last_name can be empty)
ALTER TABLE account_contacts ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE account_contacts ALTER COLUMN last_name SET DEFAULT '';

-- 4. Drop view that depends on full_name BEFORE dropping the column
DROP VIEW IF EXISTS accounts_summary;

-- 5. Drop old column
ALTER TABLE account_contacts DROP COLUMN full_name;

-- 6. Recreate accounts_summary view with first_name/last_name
CREATE VIEW accounts_summary
    WITH (security_invoker=on) AS
SELECT
    a.*,
    bc.address_street AS billing_street,
    bc.address_city AS billing_city,
    bc.address_state AS billing_state,
    bc.address_postal_code AS billing_postal_code,
    bc.address_country AS billing_country,
    bc.first_name || ' ' || bc.last_name AS billing_contact_name,
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
    bc.address_postal_code, bc.address_country, bc.first_name, bc.last_name;

-- 7. Flush PostgREST cache
NOTIFY pgrst, 'reload schema';
