# Clarklaw CRM — Administrator Guide

---

## Logging In

1. Go to **https://crm.tanoclark.com**.
2. Enter your email address and password.
3. Click **Sign In**.

---

## Opening a New Client Matter

This is the full workflow for setting up a brand-new client from scratch.

### Step 1 — Create the Account

1. Go to the **Accounts** tab.
2. Click **Create**.
3. Fill out:
   - **Category** — Select account status (In Process *default*, Closed, Archived, or Consultation Only).
   - **Date Opened** — When the account was opened.
   - **Account Manager** — Defaults to Linnette.
   - **Referred By** — How the client found us (optional).
4. Under **Billing Contact**, either type an existing contact's name to auto-fill, or enter new contact details manually (first name, last name, email, phone, address).
5. Add **Notes** if needed.
6. Click **Save**.

The system automatically generates an account number (format: YYMMDD##).

### Step 2 — (optional) Add Additional Contacts

1. Open the account and go to the **Contacts** tab.
2. Click **+ Add Contact** for each additional person.
3. Fill out:
   - **Contact Type** — Select the person's role (client, opposing party, witness, etc.)
   - **First Name** (required), **Last Name**, **Email**, **Phone**
   - **Address** — Street, city, state, zip, country
4. Click **Save**.

### Step 3 — Create the Contract

1. Open the account and go to the **Contracts** tab.
2. Click **Add Contract**.
3. Fill out:
   - **Case Type** — e.g., Adjustment of Status, Asylum, I-130, N-400, etc.
   - **Status** — Defaults to "In process"
   - **Fee** — Total fee for this contract
   - **Retainer** — Retainer amount
   - **Monthly Payment** — Installment amount
   - **# Payments** and **Final Payment** will be Auto-calculated
   - **Date Opened**, **Date First Payment**
   - **Work Description** — Optional scope of work notes
4. Click **Save**. The payment schedule is automatically created.

### Step 4 — Record the Retainer Payment

1. On the contract detail page, scroll down to the **Payment Schedule**.
2. Find the **R** (retainer) row.
3. Click the **"Allocate..."** dropdown → **+ Create new payment...**.
4. Fill in date, amount, payment method, and reference number.
5. Click **Save**. The payment is created and automatically allocated to the retainer row.

### Step 5 — Create Initial Tasks

From the contract detail page, click **Add Task** for each action item. Tasks created here are automatically linked to the contract.
   - Linking a task to a Contract is preferred. Some imported tasks may be linked to the Account.

---

## Managing Tasks

### Viewing Tasks

1. Click the **Tasks** tab to see all open tasks, sorted by due date.
2. Use the filter sidebar to narrow by account, assignee, or status.

To see tasks for a specific account, open the account and click its **Tasks** tab.

### Viewing Task Details

Click on the **task text** (not the checkbox) to open the Task View panel. This shows the description, notes, account, contract, assignee, due date, and status. From here you can **Edit** or **Add Activity**.

### Creating a Task

Tasks can be linked to an **Account** or to a specific **Contract**. **Prefer linking to a contract** when the task relates to a specific contract — this keeps the task history as specific as possible and makes reporting cleaner.

**Preferred — from the contract detail page:**
1. Open the account → **Contracts** tab → click the contract.
2. Click **Add Task**. The task is automatically linked to that contract.

**From an account:**
1. Open the account → **Tasks** tab → **Add Task**.
2. A contract picker appears — select the contract this task belongs to, or choose **Account level** if it does not relate to a specific contract.
3. Fill in the task form and click **Save**.

**From the Tasks page:**
1. Go to **Tasks** → **Add Task** in the toolbar.
2. Select the account manually, then optionally select a contract.

**Task fields:**
- **Task Text** (required), **Task Type**, **Account**, **Contract** *(prefer filling this)*, **Assigned To**, **Due Date**, **Status**, **Notes**

### Updating a Task

Click the task text → **Edit**, or use the **⋯** menu → **Edit**. Make changes and click **Save**.

**Quick postpone** (via ⋯ menu): Postpone to tomorrow or next week.

### Completing a Task

Click the **checkbox** next to the task. This sets status to Done, records today's date, and shows strikethrough text.

### Deleting a Task

Use the **⋯** menu → **Delete**. Deletion is soft — the record is hidden but not permanently removed. Forrest can undelete if needed. The delete dialog will list any linked activities before you confirm.

---

## Managing Activities (Journal Entries)

Activities record what happened — calls, emails, meetings, notes. An activity can be linked to an **Account** or to a specific **Contract**. **Prefer linking to a contract** when the work relates to a specific contract, so the history is as detailed and searchable as possible.

When you add an activity from a task that is already linked to a contract, the activity automatically inherits that contract link.

### Adding an Activity

**From a Task (recommended — links activity to the task and its contract):**
- Click the task text → **Add Activity** in the panel footer, or
- Click **⋯** on the task row → **Add Activity**

**From the Account Tasks tab:**
1. Open the account → **Tasks** tab → **Add Activity**.
2. A three-step picker appears:
   - **Step 1** — Choose what to attach to: *A task*, *A contract*, or *Account level*.
   - **Step 2** — If you chose a task, select the task from the list. If you chose a contract, select the contract.
   - **Step 3** — Fill in the activity form and click **Save**.
3. If a contract is already selected in the **Filter by Contract** sidebar, steps 1 and 2 are skipped and the form pre-fills that contract.

**Activity fields:**
- **Subject** (required), **Details**, **Date** (defaults to today), **Type** (Call, Email, Meeting, Document, Note, Payment, etc.), **Contract** *(prefer filling this when applicable)*

### Viewing Activities

The **Tasks** tab on an account shows a combined feed of tasks and activities in chronological order. Activities linked to a task are nested beneath that task. Account-level activities appear interleaved with tasks in the feed.

Click any activity to open the Activity View dialog showing the full body, type, date, and parent task/contract link.

At the bottom of every account page there is also an **All Activity** timeline showing a chronological history of everything on the account — tasks, activities, notes, and more. If you don't see it, scroll to the bottom of the page and click on it to expand it.

### Filtering by Contract

On the account detail page, the right panel shows a **Filter by Contract** section when you are on the Tasks or Payments tab. Click a contract name to filter the feed to only tasks and activities linked to that contract. Click again to clear the filter. This also applies to the Payments tab.

---

## Recording Payments

### Preferred Workflow (via Payment Schedule)

1. Open the account → **Contracts** tab → click the contract.
2. Scroll to the **Payment Schedule** table.
3. Find the row to record (R = retainer, then 1, 2, 3…).
4. Click the **"Allocate..."** dropdown and choose:
   - An existing payment with available (unallocated) funds, or
   - **+ Create new payment...** — fill in date, amount, method, reference number, notes.
5. Click **Save**. The row updates to show the allocated amount and payment details.

**How allocation works:**
- A payment can be split across multiple schedule rows (e.g., a $1,500 lump sum covering three $500 installments).
- A schedule row can receive multiple payments (e.g., two $150 payments covering a $300 installment).
- Partially paid rows show an amber badge like **$200 / $400** instead of "Paid".
- Fully paid rows show a green **Paid** badge.
- If a row has multiple payments, they appear as indented sub-rows showing each payment's amount, date, method, and reference number.

To remove an allocation, click the **×** next to the payment details on the schedule row (or sub-row).

### Alternative (via Account Payments Tab)

Open the account → **Payments** tab → **Add Payment**. Payments added this way must be manually allocated to schedule rows from the contract page.

### Payment Adjustments

To record a refund, discount, or write-off, use **Add Payment** and select the appropriate **Type** (Refund, Discount, Write-off). Write-offs and discounts reduce the account balance.

---

## Checking an Account Balance

1. Open the account from the **Accounts** tab.
2. The **Financial Summary** at the top shows:
   - **Contracted** — Total fees across all contracts
   - **Received** — Total payments received
   - **Refunds** — Total refunds issued
   - **Adjustments** — Discounts and write-offs
   - **Balance Due** — What the client still owes (red = money owed, green = fully paid)

---

## Managing Contacts

### Updating a Contact

1. Go to **Contacts** (or open an account → Contacts tab).
2. Click the contact's name → **Edit**.
3. Update fields and click **Save**.

### Billing Contacts

The billing contact entered when creating an account automatically becomes a contact record for that account. You can toggle the **Billing Contact** flag on any contact via Edit.

---

## Dashboard

The Dashboard (admin only) shows:
- **Receivables** — Overdue accounts and upcoming 30-day forecast.
- **Tasks** — Incomplete and recently completed tasks across all staff.

---

## Managing Users

1. Click your name or avatar in the top right → **Users**.
2. From here you can:
   - **Create** new users (email, password, name, role)
   - **Edit** existing users
   - **Disable** accounts (users cannot be deleted to preserve data integrity)
   - Assign roles: Attorney, Law Clerk, Legal Assistant
   - Grant **Administrator** access

---

## Deleting Records

Admins can delete accounts, contracts, tasks, activities, and contacts. Deletion is **soft** — records are hidden in the CRM but not permanently removed from the database.

- The delete dialog lists all linked records (tasks, activities, payments) before you confirm.
- If something is deleted by mistake, Forrest can run the undelete script to restore it.

---

## Importing Data

Historical data imports (from Outlook/Exchange or other sources) are done via scripts Forrest runs. Contact Forrest to request an import.

---

## Tips

- **Search**: Use the search box on any list page to find records quickly.
- **Sort**: Click any column header to sort by that field.
- **Filter**: Use the filter sidebar to narrow by date, assignee, status, category, etc.
- **Mobile**: The CRM works on phones and tablets.
