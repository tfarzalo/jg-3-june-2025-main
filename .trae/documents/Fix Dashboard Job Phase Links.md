I will fix the broken links in the main admin dashboard metrics grid.

**Proposed Changes:**
In `src/components/DashboardHome.tsx`:
1.  Update the link generation logic for the metrics grid (the blocks at the top of the dashboard).
    -   **Job Requests**: Change from `/dashboard/jobs/job-requests` to `/dashboard/jobs/requests`.
    -   **Pending Work Orders**: Change from `/dashboard/jobs/pending-work-orders` (auto-generated) to `/dashboard/jobs/work-orders` (since pending orders are displayed on the Work Orders page).
    -   **Other phases**: Ensure they point to their correct existing routes (`/dashboard/jobs/work-orders`, `/dashboard/jobs/invoicing`, `/dashboard/jobs/completed`).

The logic will be updated to explicitly map each label to its correct route, avoiding reliance on fragile string replacement logic.