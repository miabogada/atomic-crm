---
name: Targeted operations only
description: When fixing a known subset of records, scope operations to just those records — don't re-run bulk scripts against all data
type: feedback
---

When fixing a known set of records (e.g. 31 unlinked payments), only operate on those specific records. Do NOT re-run bulk scripts (like `link_payment_schedule.py`) against the entire dataset.

**Why:** Re-running bulk operations against already-processed data is wasteful, can cause conflicts if prod has diverged, and shows lack of understanding of the problem scope.

**How to apply:** After identifying the specific records to fix, query just those records to determine what additional work is needed (e.g. which ones need schedule linking). Then apply targeted UPDATEs only for the affected rows.
