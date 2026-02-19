---
date: 2026-02-18T01:06:00
---
# List of things that need fix

All views
- [x] make a reusable filter panel based on the one in /contacts, apply it to /accounts, /contracts, /tasks 
	- [ ] bug: /x/contacts?filter Contact Type filters error: "column contact_summary.contact_type_id does not exist"
- [ ] badge colors: To do (yellow), In process (blue)

Dashboard
- [x] Task items should display Assignee
- [ ] Hot Contacts left side is not needed, maybe replace with Performance (booked contracts, booked sales, payment volume, maybe against targets) / Late Payments (contract list and amounts) / Deadlines panel (not sure if linked to tasks or contracts directly)
- [x] Add Completed Tasks
- [ ] Contracts count, bookings, fees collected / mo graph or table
	- [ ] A way to set monthly sales goal

Tasks
- [x] add a /tasks page with top menu item
- [x] menu order should be Dashboard, Accounts, Contracts, Tasks, Contacts
- [x] add a Status field to tasks, it should be extensible enums: To do, In Process, Blocked, Done. 
- [x] Task status should be visible in /accounts/x/show and /account_contracts/x/show
- [x] If logged in as admin, then Dashboard should show tasks from all users
- [ ] Task Status changes should be logged with a Date Status Change field.
- [x] Tasks with status Done should show date of completion
- [ ] kanban view

account_contracts?create
- [ ] contract number should be based on account number appended with uppercase alpha starting with A, which is the same scheme used in outlook script
- [ ] when creating a contract, need an auto calculated field for final payment amount if different from monthly payment
- [ ] generate a schedule of payments once amount fields are filled

account_contracts/1/show
- [x] Task items should display Assignee
- [ ] tasks and activities including payments made should have a view option of threaded or list
- [ ] contract should show a running balance due (once the payments are hooked up)
- [ ] contract should show a schedule of payments and due dates
- [x] filter view by Contract Status = To do / In process / In progress - Past due / Stopped - Past due / In process - Paid / Done - Paid / Canceled
	- [x] add status badge to contract items
	- [x] add method to change contract status
- [ ] click on a contract item should open it in /x/account_contracts/x/show
- [ ] click on a contact item should open it in /x/account_contacts/x/show

Add Task dialog in any view
- [x] needs an Assignee field
- [ ] needs a Type = Document Request

/accounts/x/show
- [x] Task items should display Assignee

Every item type
- needs a Created by (user) and a Date Created, which could be different from the Date Opened field. This is for system logging and access records.

Activities
- [ ] if type = document, then should have a pointer to the file
- [ ] if type = payment, then should have a pointer to the payment item (maybe reference stripe somehow)
- [ ] if type = payment, then should have fields similar to outlook payment form (amount, type, check number). maybe the payments are already a schedule created with contract and then the activity type=payment will link to the next payment item in the schedule

Users
- [x] for some reason the path and headline are Sales instead of Users?
- accounts.sales_id/attorney_id/law_clerk_id/legal_assistant_id should be types of Users, not separate fields

/contacts/create
- don't require Position: Title, Company fields
- don't require Linkedin field
- could use Relation: Petitioner, Beneficiary, ? (ask Linnette)
- Email should default to Home
- Phone should default to Mobile

## regression after Sales -> Users rename
- [x] /accounts/create in Billing Contact heading, Copy from existing contact selector does not contain the newly created first contact as an option. (as-designed, log out / in to get onboarding)