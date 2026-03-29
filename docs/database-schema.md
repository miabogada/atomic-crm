# Database Schema Reference

> Auto-generated from production on 2026-03-29. Update by querying `information_schema.columns`.

## Tables

### accounts
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| account_number | text | NO | |
| name | text | NO | |
| phone | text | YES | |
| email | text | YES | |
| attorney_id | bigint | YES | |
| law_clerk_id | bigint | YES | |
| legal_assistant_id | bigint | YES | |
| date_opened | date | YES | |
| date_closed | date | YES | |
| date_first_consult | date | YES | |
| categories | text | YES | 'In Process' |
| referred_by | text | YES | |
| notes | text | YES | |
| archived | boolean | NO | false |
| archive_year | integer | YES | |
| stripe_customer_id | text | YES | |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| user_id | bigint | YES | |
| deleted_at | timestamptz | YES | |

### account_contacts
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| account_id | bigint | NO | FK → accounts |
| contact_type_id | bigint | YES | FK → contact_types |
| is_billing_contact | boolean | NO | false |
| email | text | YES | |
| phone | text | YES | |
| address_street | text | YES | |
| address_city | text | YES | |
| address_state | text | YES | |
| address_postal_code | text | YES | |
| address_country | text | YES | |
| created_at | timestamptz | NO | now() |
| user_id | bigint | YES | |
| first_name | text | NO | |
| last_name | text | YES | '' |
| deleted_at | timestamptz | YES | |

### account_contracts
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| account_id | bigint | NO | FK → accounts |
| contract_number | text | YES | |
| case_type | text | YES | |
| fee | numeric | YES | |
| retainer | numeric | YES | |
| monthly_payment | numeric | YES | |
| num_payments | integer | YES | |
| date_opened | date | YES | |
| date_retainer | date | YES | |
| date_first_payment | date | YES | |
| work_description | text | YES | |
| created_at | timestamptz | NO | now() |
| user_id | bigint | YES | |
| status | text | NO | 'In process' |
| final_payment | numeric | YES | |
| deleted_at | timestamptz | YES | |

### account_payments
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| account_id | bigint | NO | FK → accounts |
| contract_id | bigint | YES | FK → account_contracts |
| date_received | date | NO | |
| amount | numeric | NO | |
| payment_method | text | NO | |
| reference_number | text | YES | |
| notes | text | YES | |
| user_id | bigint | YES | |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| type | text | NO | 'payment' |
| deleted_at | timestamptz | YES | |

### account_activities
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| account_id | bigint | NO | FK → accounts |
| parent_type | text | YES | |
| parent_id | bigint | YES | |
| type | text | YES | |
| subject | text | NO | |
| body | text | YES | |
| date | timestamptz | YES | |
| attachments | text[] | YES | |
| created_at | timestamptz | NO | now() |
| user_id | bigint | YES | |
| deleted_at | timestamptz | YES | |

### contract_payment_schedule
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| contract_id | bigint | NO | FK → account_contracts |
| account_id | bigint | NO | FK → accounts |
| payment_number | integer | NO | 0 = retainer, 1..N = installments |
| due_date | date | NO | |
| amount | numeric | NO | |
| created_at | timestamptz | NO | now() |

### payment_allocations
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| payment_id | bigint | NO | FK → account_payments |
| schedule_id | bigint | NO | FK → contract_payment_schedule |
| amount_applied | numeric | NO | CHECK > 0 |
| created_at | timestamptz | NO | now() |

Unique constraint: `(payment_id, schedule_id)`

### tasks
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| contact_id | bigint | YES | |
| type | text | YES | |
| text | text | YES | |
| due_date | date | YES | |
| done_date | timestamptz | YES | |
| user_id | bigint | YES | |
| account_id | bigint | YES | FK → accounts |
| parent_type | text | YES | |
| parent_id | bigint | YES | |
| status | text | NO | 'To do' |
| deleted_at | timestamptz | YES | |
| notes | text | YES | |

### users
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| first_name | text | NO | 'Pending' |
| last_name | text | NO | 'Pending' |
| email | text | NO | |
| administrator | boolean | NO | |
| user_id | uuid | NO | FK → auth.users |
| avatar | jsonb | YES | |
| disabled | boolean | NO | false |
| role | text | YES | |

### contacts
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| first_name | text | YES | |
| last_name | text | YES | |
| gender | text | YES | |
| title | text | YES | |
| background | text | YES | |
| avatar | jsonb | YES | |
| first_seen | timestamptz | YES | |
| last_seen | timestamptz | YES | |
| has_newsletter | boolean | YES | |
| status | text | YES | |
| tags | text[] | YES | |
| company_id | bigint | YES | FK → companies |
| user_id | bigint | YES | |
| linkedin_url | text | YES | |
| email_jsonb | jsonb | YES | |
| phone_jsonb | jsonb | YES | |

### contact_notes
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| contact_id | bigint | NO | FK → contacts |
| text | text | YES | |
| date | timestamptz | YES | now() |
| user_id | bigint | YES | |
| status | text | YES | |
| attachments | text[] | YES | |

### contact_types
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| name | text | NO | |

### companies
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| created_at | timestamptz | NO | now() |
| name | text | NO | |
| sector | text | YES | |
| size | smallint | YES | |
| linkedin_url | text | YES | |
| website | text | YES | |
| phone_number | text | YES | |
| address | text | YES | |
| zipcode | text | YES | |
| city | text | YES | |
| state_abbr | text | YES | |
| user_id | bigint | YES | |
| context_links | json | YES | |
| country | text | YES | |
| description | text | YES | |
| revenue | text | YES | |
| tax_identifier | text | YES | |
| logo | jsonb | YES | |

### deals
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| name | text | NO | |
| company_id | bigint | YES | FK → companies |
| contact_ids | bigint[] | YES | |
| category | text | YES | |
| stage | text | NO | |
| description | text | YES | |
| amount | bigint | YES | |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| archived_at | timestamptz | YES | |
| expected_closing_date | timestamptz | YES | |
| user_id | bigint | YES | |
| index | smallint | YES | |

### deal_notes
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| deal_id | bigint | NO | FK → deals |
| type | text | YES | |
| text | text | YES | |
| date | timestamptz | YES | now() |
| user_id | bigint | YES | |
| attachments | text[] | YES | |

### tags
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| name | text | NO | |
| color | text | NO | |

### favicons_excluded_domains
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | |
| domain | text | NO | |

## Views

### accounts_summary
Aggregates: `billing_street`, `billing_city`, `billing_state`, `billing_postal_code`, `billing_country`, `billing_contact_name`, `nb_contacts`, `nb_contracts`, `nb_open_tasks`, `total_received`, `total_refunds`, `total_adjustments`, `total_contracted`, `balance_due`

### contacts_summary
Aggregates: `company_name`, `nb_tasks`, `email_fts`, `phone_fts`

### companies_summary
Aggregates: `nb_deals`, `nb_contacts`

### contract_payment_schedule_view
Extends `contract_payment_schedule` with: `contract_number`, `case_type`, `account_name`, `account_number`, `amount_paid`, `balance_remaining`, `status` (paid/partial/late/due/upcoming)

### init_state
Single row: `is_initialized` (count of accounts)
