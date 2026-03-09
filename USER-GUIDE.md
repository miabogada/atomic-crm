# Clarklaw CRM User Guide

## Getting Started

Log in at https://crm.tanoclark.com . After logging in, you will see the main navigation bar at the top of the screen with tabs for **Accounts**, **Contracts**, **Tasks**, and **Contacts**. Administrators also see a **Dashboard** tab.

---

## Accounts

### Creating an Account

1. Go to the **Accounts** tab.
2. Click the **Create** button.
3. Fill out the required fields:
   - **Category** — Select the account status (In Process *default*, Closed, Archived, or Consultation Only).
   - **Date Opened** — When the account was opened.
   - **Account Manager** — defaults to Linnette.
   - **Referred By** — How the client found us (optional).
4. Under **Billing Contact**, either:
   - Type an existing contact's name in the lookup field to auto-fill their information, or
   - Enter the new contact details manually (first name, last name, email, phone, address).
5. Optional add **Notes** about the account if needed.
6. Click **Save**.

The system automatically generates an account number (format: YYMMDD##).

### Viewing an Account

Click on any account in the list to open its detail page. You will see:

- **Header** — Account name, number, and category badge.
- **Financial Summary** — Contracted total, payments received, refunds, adjustments, and balance due. Red if money is owed, green if fully paid.

Below the header are five tabs:

| Tab | What It Shows |
|-----|---------------|
| **Contacts** | All contacts linked to this account |
| **Contracts** | All contracts/cases for this account |
| **Tasks** | Open tasks, sorted by due date |
| **Activities** | Activity log (calls, emails, notes, journal entries) |
| **Payments** | All payment records |

An **Activity Log** timeline appears below the tabs, showing a chronological history of everything that has happened on the account. You may need to click the Activity Log to expand it if you don't see anything.

### Editing an Account

From the account detail page, click the **Edit** button to modify any account fields.

---

## Contacts

Contacts are people associated with an account — clients, opposing parties, witnesses, etc.

### Adding a Contact to an Account

1. Open the account and go to the **Contacts** tab.
2. Click **+ Add Contact**.
3. Fill out the contact form:
   - **Account** — Pre-filled with the current account.
   - **Contact Type** — Select the contact's role from the dropdown.
   - **First Name** (required) and **Last Name**.
   - **Email** and **Phone**.
   - **Address** — Street, city, state (dropdown), postal code, country.
   - **Billing Contact** — Toggle on if this person is the billing contact for the account.
4. Click **Save**.

You can also create contacts from the **Contacts** tab in the main navigation and then assign the contact to an account.

### Billing Contacts

When you create an account, the billing contact information you enter automatically creates a contact record marked as the billing contact for that account.

---

## Contracts

Contracts represent legal cases or agreements tied to an account. Each contract tracks the case type, fees, payment terms, and status.

### Creating a Contract

1. Open the account and go to the **Contracts** tab.
2. Click **Add Contract**. This opens a full-page contract form.
3. The form pre-fills the **Account**, today's date for **Date Opened** and **Date Retainer**, and assigns you as the contract owner.
4. Fill out the top row:
   - **Case Type** — Select from the list (e.g., Adjustment of Status, Asylum, I-130, N-400, etc.).
   - **Status** — Set the initial status (defaults to "In process"):
     - *In process* — Active case
     - *In process - Past due* — Active but payments overdue
     - *Stopped - Past due* — Work paused due to non-payment
     - *In process - Paid* — Active and fully paid
     - *Done - Paid* — Case complete, fully paid
     - *Canceled* — Case canceled
5. Fill out the **Terms** column (left side):
   - **Fee** — Total fee amount for this contract.
   - **Retainer** — Retainer amount.
   - **Monthly Payment** — Monthly installment amount.
   - **# Payments** — Auto-calculated from the fee, retainer, and monthly payment.
   - **Final Payment** — Auto-calculated (adjusts if the last payment differs from the monthly amount).
6. Fill out the **Dates & Details** column (right side):
   - **Date Opened** — Pre-filled with today (editable).
   - **Date Retainer** — Pre-filled with today (editable).
   - **Date First Payment** — When the first installment is due.
   - **Work Description** — Optional details about the scope of work.
7. Click **Save**. You are taken to the contract detail page. 
The payment schedule will be automatically created below the contract info.
8. The retainer payment needs to be entered separately after the contract is created.
   - Find the first payment in the payment schedule, it should have "R" next to it.
   - Click the "Attach payment" dropdown and choose "New payment". Proceed with usual payment details and save.

### Viewing a Contract

Click on a contract from the account's **Contracts** tab or from the main **Contracts** page. The contract detail page shows:

- Case type, status, and contract number
- Fee, retainer, and payment terms
- Work description
- Payment schedule information
- Link back to the parent account

### Viewing the Payment Schedule

1. Go to the **Accounts** tab.
2. Click on the account.
3. Go to the **Contracts** tab.
4. Click on the contract (case number).
5. The contract detail shows the payment terms (fee, retainer, monthly payment, number of payments, final payment).
   - You might need to click to expand at the bottom to see activities and tasks for the contract. 
---

## Tasks

Tasks track work items that need to be done, linked to an account and optionally to a specific contract.

- **Preferred workflow:** Create the task from the **Contract detail page** — it is automatically linked to that contract in one step.
- If you create a task from the **Account** page or the **Tasks** list, it is linked to the account only. You can then attach it to a contract by editing the task and using the **Contract** dropdown.
- Tasks imported from Outlook are at the account level.
- Tasks imported from Outlook retain their original Owner assignment from Outlook.

### Creating a Task

**From an Account:**
1. Open the account and go to the **Tasks** tab.
2. Click **Add Task** (on the right side of the tasks panel).
3. Fill out the task form:
   - **Task Text** (required) — What needs to be done.
   - **Task Type** — Select the category:
     - None, Email, Call, Meeting, Follow-up, Document Review, Filing, Court Date, Client Request, Document Request
   - **Account** — Pre-filled with the current account.
   - **Assigned To** — Who should do this task.
   - **Due Date** — When it's due.
   - **Status** — To do, In Process, Blocked, or Done.
   - **Notes** — Additional details or a progression journal.
4. Click **Save**.

**From the Tasks Page:**
1. Go to the **Tasks** tab in the main navigation.
2. Click **Add Task** in the toolbar.
3. Fill out the form (same fields as above, but you'll need to select the account manually).
4. Click **Save**.

### Completing a Task

Click the **checkbox** next to any task to mark it as done. This automatically:
- Sets the status to "Done"
- Records today's date as the completion date
- Shows the task with strikethrough text

### Task Actions

Click the **three-dot menu** (⋯) on any task for additional options:
- **Postpone to tomorrow** — Moves the due date to the next day.
- **Postpone to next week** — Moves the due date forward one week.
- **Edit** — Open the task edit form.
- **Add Activity** — Create a journal entry linked to this task (only available if the task is linked to an account).
- **Delete** — Remove the task (admin only).

### Viewing Task Details

Click on the task text (not the checkbox) to open a read-only **Task View** dialog showing all task details including notes, assignee, account, and dates. From here you can click **Edit** or **Add Activity**.

---

## Activities (Journal Entries)

Activities are log entries that record what happened on an account — phone calls, emails, meetings, notes, and other events. They appear in the **Activities** tab and the activity timeline on the account detail page.

### Adding an Activity

There are several ways to add an activity:

**From a Task (two options):**
- **Option A — Task View dialog:** Click on the task text to open the Task View dialog, then click the **Add Activity** button in the dialog footer.
- **Option B — Dropdown menu:** Click the three-dot menu (⋯) on the task row and select **Add Activity**.

Both options are only available if the task is linked to an account. The activity is automatically linked to the parent task.

**From the Account Page:**
1. Open the account and go to the **Activities** tab.
2. Click **Add Activity**.

**Activity Form Fields:**
- **Subject** (required) — Brief description of the activity.
- **Details** — Full text of the journal entry.
- **Date** — Defaults to today (editable).
- **Type** — Call, Email, Meeting, Document, Note, Payment, etc.

Click **Save**. Activities linked to tasks will show a reference to the parent task in the activity timeline.

### Viewing Activities

Click on any activity in the list to open a read-only **Activity View** dialog showing the full body, type badge, date, and parent link (if linked to a task or contract).

---

## Payments

Payments track money received, refunded, or discounts applied on a contract.

### Recording a Payment (Preferred Workflow)

The best way to record a payment is through the contract's payment schedule:

1. Go to the **Account** → **Contracts** tab → click on the contract.
2. Scroll down to the **Payment Schedule** table. Click to expand if it's not visible.
3. Find the payment row you want to record (the retainer is marked **R**, then payments are numbered 1, 2, 3, etc.).
4. In the **Status** column, click the **"Link payment..."** dropdown for that row.
5. Choose one of:
   - **An existing unlinked payment** — if the payment was already entered elsewhere, select it to link it to this schedule row.
   - **+ Create new payment...** — to enter a new payment. Fill out:
     - **Date Received** — When the payment was received.
     - **Amount** — Payment amount (pre-filled from the schedule).
     - **Payment Method** — Check, Money Order, Cash, Credit Card, or Wire Transfer.
     - **Reference Number** — Check number, wire reference, etc.
     - **Notes** — Additional details (optional).
6. Click **Save**. The payment is created and automatically linked to that schedule row. The row updates to show "Paid" with the payment date, method, and reference number.

To unlink a payment from a schedule row, click the **×** next to the "Paid" badge.

### Recording a Payment (Alternative)

You can also add payments directly from the account's **Payments** tab using the **Add Payment** button. Payments added this way will need to be manually linked to a payment schedule row from the contract detail page.

---


---

## Common Workflows

### Opening a New Client Matter

1. **Create the Account** — Accounts tab → Create → fill out billing contact info and account details → Save.
2. **Add Additional Contacts** — Open the account → Contacts tab → + Add Contact for each additional person.
3. **Create the Contract** — Open the account → Contracts tab → Add Contract → fill out case type, fee, payment terms → Save.
4. **Record the Retainer** — On the contract detail page, find the **R** row in the payment schedule → Link payment → + Create new payment → fill out details → Save.
5. **Create Initial Tasks** — From the contract detail page, click Add Task for each action item (tasks are automatically linked to the contract).

### Recording a Payment

1. Go to the **Account** → **Contracts** tab → click the contract.
2. Find the next unpaid row in the payment schedule.
3. Click **"Link payment..."** → **+ Create new payment...** → fill out amount, date, method → Save.
4. The financial summary updates automatically.

### Checking Account Balance

1. Go to the **Accounts** tab → click the account.
2. The **Financial Summary** at the top shows:
   - **Contracted** — Total fees across all contracts
   - **Received** — Total payments received
   - **Refunds** — Total refunds issued
   - **Adjustments** — Discounts and write-offs
   - **Balance Due** — What the client still owes

### Adding an Activity (Journal Entry) to a Task

1. Click on the task text to open the **Task View** dialog.
2. Click the **Add Activity** button at the bottom of the dialog.
3. Fill in the subject and details, then click **Save**.
4. The activity appears in the account's activity timeline, linked to the task.

Alternatively, use the three-dot menu (⋯) on the task row and select **Add Activity**.

---

## Tips

- **Filters**: Use the filter sidebar on list pages to narrow down accounts, contracts, or tasks.
- **Sorting**: Click column headers on list pages to sort by that field.
- **Search**: Use the search box on list pages to find records quickly.
- **Mobile**: The CRM works on mobile devices with a touch-friendly layout.

---

## For Administrators

### Dashboard

The Dashboard (visible only to admins) shows:
- **Receivables** — Overdue accounts receivable and upcoming 30-day forecast.
- **Tasks** — Incomplete and recently completed tasks.

### Managing Users

1. Click **Users** in the user menu (top right).
2. From here you can:
   - **Create** new users with email, password, name, and role.
   - **Edit** existing users.
   - **Disable** accounts (users cannot be deleted to preserve data integrity).
   - Assign roles: Attorney, Law Clerk, Legal Assistant, or no role.
   - Grant **Administrator** access.

### Importing Data

This is done via scripts Forrest can run.

### Deleting 

Admins can delete items but it's not permanent. It only marks them as deleted in the database, so they appear deleted in the CRM web pages.  
- When you delete an item that has linked tasks, activities, payments, the delete dialog box will list them for you first.
- If you decide later that you don't want an item deleted, Forrest can run the undelete script for you to bring them back.
