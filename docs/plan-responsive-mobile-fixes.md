# Plan: Responsive / Mobile Viewport Fixes

**Date:** 2026-02-21
**Scope:** Active workflow UI only — Dashboard, Accounts, Account Contracts, Tasks, Account Contacts, plus shared Layout/Navigation, Notes (inline), Activity logs (inline), Settings, Users, and Auth screens.

Out of scope: Companies, Deals/Kanban, Import page.

---

## Issue List (Priority Order)

### CRITICAL

#### 1. Header navigation overflows on phones
- **File:** `src/components/atomic-crm/layout/Header.tsx`
- **Problem:** 5 nav tabs each with `px-6` padding require ~750px minimum width. iPhone SE is 375px — complete overflow.
- **Also verify:** The breakpoint at which the app switches from desktop layout (`Header` + sidebar) to mobile layout (`MobileNavigation`) — if it's above `md` (768px), tablet users see a broken desktop nav.
- **Fix:** Hide the desktop nav with `hidden md:flex` (or whatever the correct breakpoint is) and confirm `MobileNavigation` activates at the same breakpoint.

#### 2. Account and Account Contact side-by-side layouts don't stack on mobile
- **Files:**
  - `src/components/atomic-crm/accounts/AccountShow.tsx`
  - `src/components/atomic-crm/accounts/AccountEdit.tsx`
  - `src/components/atomic-crm/contacts/ContactShow.tsx` (used for Account Contacts)
  - `src/components/atomic-crm/contacts/ContactEdit.tsx`
- **Problem:** All use `flex gap-8` without a `flex-col` fallback. On small screens the sidebar squeezes against or overflows the main content area.
- **Fix:** Change to `flex flex-col gap-4 md:flex-row md:gap-8`.

#### 3. Account Show and Contact Show tab grids are cramped on mobile
- **Files:**
  - `src/components/atomic-crm/accounts/AccountShow.tsx` — `grid-cols-5 h-10`
  - `src/components/atomic-crm/contacts/ContactShow.tsx` — `grid-cols-3 h-10`
- **Problem:** Fixed column counts mean tab labels overflow or clip on phones.
- **Fix:** Either use `overflow-x-auto` with a `flex` tab row, or abbreviate/icon-only labels on small screens.

---

### HIGH

#### 4. Dashboard chart height is fixed
- **File:** `src/components/atomic-crm/dashboard/DealsChart.tsx`
- **Problem:** Hard-coded `h-[400px]` consumes most of a phone viewport.
- **Fix:** `h-[220px] md:h-[400px]`

#### 5. Contract detail dialog has no mid-range responsive sizing
- **File:** `src/components/atomic-crm/deals/DealShow.tsx` (used for contract detail)
- **Problem:** Only specifies `lg:max-w-4xl` — no `sm:` or `md:` sizing, so content can be awkward on tablets.
- **Fix:** Add `sm:max-w-full md:max-w-2xl lg:max-w-4xl`.

#### 6. Note attachments grid is 4 columns on all screen sizes
- **File:** `src/components/atomic-crm/notes/NoteAttachments.tsx`
- **Problem:** `grid grid-cols-4 gap-8` with `w-[200px]` images — completely broken on phones.
- **Fix:** `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` and drop the fixed `w-[200px]`.

---

### MEDIUM

#### 7. `gap-8` used unconditionally in form containers
- **Files:** Account, Account Contact, and Account Contract edit/create forms and `DashboardStepper.tsx`
- **Problem:** 32px gaps waste excessive vertical space on phones and feel chunky.
- **Fix:** `gap-2 sm:gap-4 md:gap-6` on form wrapper containers.

#### 8. Aside sidebars won't shrink on tablets
- **Files:**
  - `src/components/atomic-crm/accounts/AccountAside.tsx`
  - `src/components/atomic-crm/contacts/ContactAside.tsx`
- **Problem:** `min-w-64` (256px) prevents shrinking at tablet widths (~768px), squeezing the main content area.
- **Fix:** Use `min-w-52 lg:min-w-64` or remove `min-w` entirely and let the aside be content-sized.

#### 9. MobileNavigation buttons tight on iPhone SE
- **File:** `src/components/atomic-crm/layout/MobileNavigation.tsx`
- **Problem:** 5 buttons × `w-16` (64px) = 320px minimum; leaves only ~55px margin on a 375px screen.
- **Fix:** Use `w-14` (56px) per button or switch to `flex-1` so buttons fill the bar evenly.

#### 10. Task list — verify filter and row layout on mobile
- **File:** `src/components/atomic-crm/tasks/` (list view and filter)
- **Problem:** Filter panel should already use a Sheet on mobile (via `ResponsiveFilters`) — confirm this is wired up. Also confirm list row layouts don't overflow horizontally on phones.
- **Fix:** Audit and patch if the Sheet-based filter isn't connected or if row content overflows.

---

## What's Already Working Well

- `useIsMobile()` hook exists and is used in several places
- Mobile layout components (`MobileLayout`, `MobileHeader`, `MobileNavigation`) are present
- Sheets use `side="bottom"` — correct mobile pattern
- Filter panel switches to a Sheet drawer on mobile
- Activity log items use `md:max-w-150` — responsive
- Some dashboard grids properly use `grid-cols-1 md:grid-cols-12`

---

## Out of Scope

- Companies (not in active workflow)
- Deals / Kanban board (not in active workflow)
- Import data page
