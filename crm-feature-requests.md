---
date: 2026-02-18T01:06:00
---
# List of things that need fix

### Post migration feedback
- [x] task due dates incorrect, seem like created dates from outlook
- [x] imported payments are mostly not connected to contracts, need logic to infer and correct
	- [ ] bug: inccomplete association. e.g. http://localhost:5173/#/account_contracts/262/show
- [x] activities in an account view or contract view should be consolidated with tasks, because users complain of "disappearing" activity items upon creation when parent item is a task.
- [x] imported accounts all show Linnette as all 3 roles, she should be the attorney, should use the roles defined in Users to apply to the accounts when imported, need to apply a correction.
- [ ] overall central width changes as you move through top menu, should be consistent
- [ ] overall central width changes again in accounts/show when you navigate inner tabs. it would make sense that the central content stays same width as when you navigate top menu, leaving room for left or right asides as they appear.
- [x] task item reschedule ends up on 1 day prior to the intended reschedule date
- [x] imported credit card payments were impored as type CHECK but Check Number is non-integer, need to change to type Credit Card
- [x] imported accounts seem to have null Opened date as shown in right aside on accounts/x/show
- [x] additional 26 accounts as of 3/14 need to be migrated, list on google drive https://docs.google.com/document/d/1fkyR1PusREl6xg6Zx6UZZx8yf868eGgvH3BOh8XrXDg/edit?tab=t.0
- [x] some payments created on 2/26/26 missing from crm: 
1. Edgar Medina 24091001 $350
2. Calixto Martinez 25090501 $500
3. Jorge Serna 25091101 $400
4. Santos Cruz #07022201 $400
5. Edgar Lopez and Ana Soriano 15030101 $400
6. Ana Avila 14041501
7. Eduarda Olivera and Felipe Zuniga 2403501
### LMC feedback
/accounts/create
- [x] remove or hide Date first consult
- [x] title case the name, street, city field inputs
- [x] unclear if phone should be numeric only or formatted input
- [x] country dropdown default to US
- [x] Team fields not needed or can hide. 
- [x] Attorney and Account Manager always Linnette, make default
- [x] add State field dropdown picker
- [x] bug: phone field accepted more than 10 digits but only displayed 10, so once saved there were extra digits shown. e.g. +15551212111
/account_contacts/create
- [x] Contact Type add child
- [x] unclear if phone should be numeric only
- [x] title case phone, address, city
- [x] country dropdown default to US
- [x] State field dropdown picker
/account_contracts/create
- [x] status picker default to In process (To do is not needed)
- [x] bug: observed Status empty in form, expected Status = In process selected in form
- [x] bug when final payment = monthly payment, expect $0
	- e.g. $1000 fee = $250 retainer + $150/mo x 5 + $0 but shows $150 as final payment
- [x] after saving a contract, it's difficult to navigate back to the accounts//show with Contracts tab selected and the new contract shown so that the first payment / retainer could be created. Is there a way to make this automatic?
/accounts//show
- [x] if more than 1 account contact, show billing contact item first in list
/tasks
- [x] left column filters: Assigned To should be first, should include filters for any user not just Me
- [x] need status filter "Not done" = To do OR In Process OR Blocked
- [ ] add task type Appearance or change existing type Court Date to Appearance (confirm w/ Linnette first)
- [x] task items should be clickable, open to a view dialog
/activities
- [x] activity items should be clickable, open to a view dialog
/users/create
- [x] bug: expected the user role (attorney, law clerk, etc.) field is exposed in the form, observed no role field visible, other than Administrator toggle.
- [x] Delete should not be available to non-admin users. Delete for admin users should have a confirmation step. Deleted items should not really be deleted in db.
 - Delete account → cascade to contacts, contracts, payments, tasks, activities (already works)
 - Delete contract → cascade to payments linked to that contract, Tasks/activities with parent_type=account_contract, parent_id=contract.id, and Payment schedule rows
 - Delete contact → standalone, no cascade needed, warn if Billing contact
 - Delete payment → standalone (for now, may require additional if linked to Stripe at some point)
 - Delete task → cascade to child activities
 - Delete activity → standalone  
 - Any Delete warning dialog should list the child items to also be deleted.
 

All views
- [x] make a reusable filter panel based on the one in /contacts, apply it to /accounts, /contracts, /tasks 
	- [x] bug: /x/contacts?filter Contact Type filters error: "column contact_summary.contact_type_id does not exist"
- [x] badge colors: To do (yellow), In process (blue)
- [x] bug: balances in the proposed migration list csv file identified discrepancy between balance and actual balance, depending on what table claude was looking at in access. root cause was identified. Claude identified root cause as incorrect table reference in Access, found correct table. Also minor discrepancy between Exchange payments and Access due to end user workaround for discount and payment reversals. 

Dashboard
- [x] Task items should display Assignee
- [x] Hot Contacts left side is not needed, 
- [x] Late Payments (contract list and amounts) 
- [x] Add Completed Tasks
- [ ] Left panel "Performance" show new Contracts count, bookings, fees collected / mo graph or table - low priority
	- [ ] A way to set monthly sales goal - low priority
- [x] bug: Latest Activities not displaying any
- [x] Latest Activity should include activities, tasks completed, and payments received.
- [x] non-admin users should not see the Dashboard. they can go to accounts after login
- [x] admin user attorney doesn't like business of Latest Activity panel. Just hide it. 

Phone menu
- [ ] bottom phone nav needs a back arrow, left side, only shown in detail views - low priority

Tasks
- [x] add a /tasks page with top menu item
- [x] menu order should be Dashboard, Accounts, Contracts, Tasks, Contacts
- [x] add a Status field to tasks, it should be extensible enums: To do, In Process, Blocked, Done. 
- [x] Task status should be visible in /accounts/x/show and /account_contracts/x/show
- [x] If logged in as admin, then Dashboard should show tasks from all users
- [ ] Task Status changes should be logged with a Date Status Change field.
- [x] Tasks with status Done should show date of completion
- [ ] kanban view in desktop - low priority
- [x] entire task item should be clickable, same for account_contacts
- [x] editing task to Done status does not update the dashboard, maybe there's a separate task complete binary field

account_contracts?create
- [x] contract number should be based on account number appended with uppercase alpha starting with A, which is the same scheme used in outlook script
- [x] when creating a contract, need an auto calculated field for final payment amount if different from monthly payment
- [x] generate a schedule of payments once amount fields are filled
- [ ] a payment?create item should be opened when saving the account_contract the first time if the Retainer field is non-zero amount

account_contracts/1/show
- [x] Task items should display Assignee
- [x] tasks and activities including payments made should have a view option of threaded
- [x] contract should show a running balance due (once the payments are hooked up)
- [x] contract should show a schedule of payments and due dates when click "# Payments: 18" (under Terms)
- [x] contract should show list of payments received 
- [x] filter view by Contract Status = To do / In process / In progress - Past due / Stopped - Past due / In process - Paid / Done - Paid / Canceled
	- [x] add status badge to contract items
	- [x] add method to change contract status
- [ ] the entire Account block in the right aside area should be clickable, not just the account number


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
- [ ] account status = New is needed, should apply before the first contract is created, should be yellow like To do is -- won't do

/accounts/x/show
- [x] Task items should display Assignee
- [x] need a way to add more contacts to an account
- [ ] show tags as badges on account contact
- [x] click on a contract item should open it in /x/account_contracts/x/show
- [x] click on a contact item should open it in /x/account_contacts/x/show
	- [x] expand clickable area of account_contact beyond description text
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
- [x] ability to apply a discount to the contract amount later after the fact that should come out of the balance
- [x] ability to reverse a payment later or apply a partial reversal to a payment that should come out of the balance
- [x] ability to mark unpaid balances as a write-off
- [ ] ability to manually allocate a write-off/discount/payment to specific schedule rows (e.g. "Link to schedule" action on unallocated payment items in contract view)

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