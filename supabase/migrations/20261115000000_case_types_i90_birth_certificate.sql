-- Add two case types found during the legacy case type cleanup (2026-11-15):
-- I-90 and Birth Certificate Amendment had old contracts with no match on the
-- approved list, and staff entered a new I-90 contract on 2026-11-11.
-- See docs/plan-multiple-case-types.md
INSERT INTO public.case_types (name) VALUES
    ('I-90'),
    ('Birth Certificate Amendment')
ON CONFLICT (name) DO NOTHING;
