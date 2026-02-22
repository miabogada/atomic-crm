---
date: 2026-02-18T01:06:00
---
# List of things that need fix

All views
- [x] make a reusable filter panel based on the one in /contacts, apply it to /accounts, /contracts, /tasks 
	- [x] bug: /x/contacts?filter Contact Type filters error: "column contact_summary.contact_type_id does not exist"
- [x] badge colors: To do (yellow), In process (blue)

Dashboard
- [x] Task items should display Assignee
- [ ] Hot Contacts left side is not needed, maybe replace with Performance (booked contracts, booked sales, payment volume, maybe against targets) / Late Payments (contract list and amounts) / Deadlines panel (not sure if linked to tasks or contracts directly)
- [x] Add Completed Tasks
- [ ] Contracts count, bookings, fees collected / mo graph or table
	- [ ] A way to set monthly sales goal
- [x] bug: Latest Activities not displaying any
- [ ] Latest Activity should include activities, tasks completed, and payments received.

Phone menu
- [ ] bottom phone nav needs a back arrow, left side, only shown in detail views

Tasks
- [x] add a /tasks page with top menu item
- [x] menu order should be Dashboard, Accounts, Contracts, Tasks, Contacts
- [x] add a Status field to tasks, it should be extensible enums: To do, In Process, Blocked, Done. 
- [x] Task status should be visible in /accounts/x/show and /account_contracts/x/show
- [x] If logged in as admin, then Dashboard should show tasks from all users
- [ ] Task Status changes should be logged with a Date Status Change field.
- [x] Tasks with status Done should show date of completion
- [ ] kanban view in desktop
- [x] entire task item should be clickable, same for account_contacts
- [x] editing task to Done status does not update the dashboard, maybe there's a separate task complete binary field

account_contracts?create
- [x] contract number should be based on account number appended with uppercase alpha starting with A, which is the same scheme used in outlook script
- [x] when creating a contract, need an auto calculated field for final payment amount if different from monthly payment
- [x] generate a schedule of payments once amount fields are filled
- [ ] a payment?create item should be opened when saving the account_contract the first time if the Retainer field is non-zero amount

account_contracts/1/show
- [x] Task items should display Assignee
- [ ] tasks and activities including payments made should have a view option of threaded or list
- [x] contract should show a running balance due (once the payments are hooked up)
- [x] contract should show a schedule of payments and due dates when click "# Payments: 18" (under Terms)
- [x] contract should show list of payments received 
- [x] filter view by Contract Status = To do / In process / In progress - Past due / Stopped - Past due / In process - Paid / Done - Paid / Canceled
	- [x] add status badge to contract items
	- [x] add method to change contract status


Add Task dialog in any view
- [x] needs an Assignee field
- [x] needs a Type = Document Request

/accounts/create
- [ ] form fields:
	- [x] Full Name vs. First, Last separately
	- [x] account name show as Last, First number
	- Country should be dropdown w/ US pre selected
	- does phone -> home?
	- phone types should be home / cell / work / other (for all contacts context)
	- address: integrate w/ google places to autofill
- [ ] account status = New is needed, should apply before the first contract is created, should be yellow like To do is

/accounts/x/show
- [x] Task items should display Assignee
- [x] need a way to add more contacts to an account
- [ ] show tags as badges on account contact
- [x] click on a contract item should open it in /x/account_contracts/x/show
- [x] click on a contact item should open it in /x/account_contacts/x/show
	- [ ] expand clickable area of account_contact beyond description text
- [x] account and each contract should show contracted amount, received amount, balance.  Each contract item should show this as well as payment x of n.

Every item type
- [ ] needs a Created by (user) and a Date Created (which could be different from Date Opened for example). This is for system logging and access records. Likely exists in db but needs to be displayed.

Activities
- [ ] if type = document, then should have a pointer to the file
	- [ ] google drive integration

Payments
- [x] add payments type
- [x]  payment item should have fields similar to outlook payment form (amount, type, check number). maybe the payments are already a schedule created with contract and then the activity type=payment will link to the next payment item in the schedule
- [x] Add Payment button from /account_contracts/x/show page
- [x] Add Payment button from /accounts/x/show page if Payments tab selected
- [ ] payment should have a pointer to the actual payment item (maybe reference stripe somehow)
	- [ ] stripe integration
- [ ]

Users
- [x] for some reason the path and headline are Sales instead of Users?
- accounts.sales_id/attorney_id/law_clerk_id/legal_assistant_id should be types of Users, not separate fields

/contacts/create
- [x] deprecate contacts type in favor of account_contacts type
	- [x] don't require Position: Title, Company fields
	- [x] don't require Linkedin field
- could use Relation: Petitioner, Beneficiary, ? (ask Linnette)
- Email should default to Home
- Phone should default to Mobile

## Settings page (admin UI for CRM configuration)
- [ ] Adapt upstream 4b9c52a "Add Settings page" for Clark Law schema. Don't cherry-pick directly — too many conflicts in ConfigurationContext.tsx and CRM.tsx. Instead:
  - Cherry-pick the `app_configuration` DB migration and `storedConfiguration.ts` / ConfigurationContext runtime-loading infrastructure
  - Build a Clark Law-specific Settings page exposing: Case Types, Contract Statuses, Account Categories, Activity Types, Task Types, Note Statuses
  - Goal: attorney admin can update config lists without a code deployment

## regression after Sales -> Users rename
- [x] /accounts/create in Billing Contact heading, Copy from existing contact selector does not contain the newly created first contact as an option. (as-designed, log out / in to get onboarding)