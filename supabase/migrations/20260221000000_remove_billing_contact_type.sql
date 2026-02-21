-- Migrate contacts using the 'billing' contact type to is_billing_contact=true,
-- then remove 'billing' from contact_types so the two concepts no longer overlap.

UPDATE public.account_contacts
SET
  is_billing_contact = true,
  contact_type_id    = NULL
WHERE contact_type_id = (
  SELECT id FROM public.contact_types WHERE name = 'billing' LIMIT 1
);

DELETE FROM public.contact_types WHERE name = 'billing';
