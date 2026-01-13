# Subcontractor Job Assignment Flow (Current State)

## Data model
- `jobs.assigned_to` (uuid → `profiles.id`): the only link between a job and a subcontractor. Null = unassigned. No acceptance/decline status fields today.
- `jobs.current_phase_id` (→ `job_phases.id`): drives overall job state; the subcontractor views rely on phase labels (e.g., “Job Request”, “Work Order”).
- `profiles.role = 'subcontractor'`: defines subcontractor users; `profiles.working_days`/`work_schedule` are used for scheduler availability.
- RLS: `jobs` policies (e.g., `supabase/migrations/20250610000001_fix_jobs_rls_policies.sql`) allow subcontractors to select/update jobs only when `assigned_to = auth.uid()`.
- Logging/notifications infra exists (`activity_log`, `notifications`, `email_logs`), but assignment events are not currently written into activity logs or notifications.

### Assignment state fields (added)
- `jobs.assignment_status`: `pending | accepted | declined | in_progress | completed` (nullable for unassigned). New assignments should start as `pending`; existing assigned jobs mapped to `accepted` in migration `20251211000009_assignment_status_model.sql`.
- `jobs.assignment_decision_at`: timestamp when the sub accepts/declines.
- `jobs.declined_reason_code`: `schedule_conflict | too_far | scope_mismatch | rate_issue | other` (nullable).
- `jobs.declined_reason_text`: free-text when `declined_reason_code = other`.
- `assignment_tokens` table (migration `20251211000010_assignment_decision_tokens.sql`): one-time tokens for assignment decision links (job_id, subcontractor_id, token, expires_at default 7 days, decision/used_at captured later).
- Functions (migration `20251211000011_process_assignment_token.sql`):
  - `get_assignment_token_details(token)`: returns job/property/sub info for public decision UI, bypassing RLS safely.
  - `process_assignment_token(token, decision, decline_reason_code?, decline_reason_text?)`: validates token, updates `jobs.assignment_status`/decision fields, clears `assigned_to` on decline, marks token used, logs activity.
- Authenticated accept/decline (migration `20251211000012_process_assignment_decision_authenticated.sql`):
  - `process_assignment_decision_authenticated(job_id, decision, decline_reason_code?, decline_reason_text?)`: allows the currently assigned subcontractor to accept/decline without a token; updates status/decision, clears assignment on decline, logs activity.

## UI behavior (current state after changes)
- Subcontractor Dashboard: two tabs (default “Pending”) showing pending assignments with CTA buttons for Accept/Decline (decline requires reason); accepted tab shows active jobs. Pending cards are highlighted.
- Sub Scheduler: pending assignments in lanes have a yellow label; unassigned pool marks “Previously declined” with reason when applicable.
- Job Details: shows an alert when assignment is pending or was declined (with reason and timestamp if available).

## Where assignments are created/updated
- Sub Scheduler UI: `src/components/SubScheduler.tsx`
  - Drag/drop sets in-memory `assignments`; “Confirm Schedule” upserts `jobs.assigned_to` (batch upsert, unassign sets `assigned_to` to null).
  - After save, optional email notifications are built per subcontractor/job bundle.
- Job Details page: `src/components/JobDetails.tsx` (`handleAssignSubcontractor`)
  - Modal lets admin/management pick a subcontractor and runs `supabase.from('jobs').update({ assigned_to })` for that job.
- Subcontractor Job History (admin view): `src/components/users/SubcontractorJobHistory.tsx` reads jobs filtered by `assigned_to`, but does not change assignments.

## Subcontractor Dashboard UI
- Component: `src/components/SubcontractorDashboard.tsx`
  - Fetches jobs where `assigned_to = current user` (or preview user) **and** `current_phase` = “Job Request”.
  - Filters by selected date (defaults to today/tomorrow) using `scheduled_date` range in ET; shows property/unit details and expands to fetch property billing/paint info.
  - No notion of pending vs accepted; any job assigned and still in the Job Request phase is shown together.

## Sub Scheduler UI
- Component: `src/components/SubScheduler.tsx`
  - Loads jobs in phases “Job Request”, “Work Order”, “Pending Work Order”; splits UI into Unassigned vs per-subcontractor columns with drag/drop.
  - Availability uses `profiles.working_days` (`availabilityUtils.isAvailableOnDate`); unavailable subs are listed separately and semi-disabled.
  - Saving uses `jobs` upsert (no dedicated assignment table or status). Unassigning adds the job back to the Unassigned list by nulling `assigned_to`.

## Email/notification behavior for new assignments
- Email sending lives inside Sub Scheduler (`generateEmailContent` → `handleSendNotifications`).
  - Uses Supabase Edge Function `send-email` (Zoho SMTP) via `supabase.functions.invoke('send-email')`.
  - Template: greeting + list of jobs with scheduled date/address; CTA link to `https://portal.jgpaintingprosinc.com/dashboard/subcontractor`. No accept/decline handling.
  - Logs to `email_logs` with `notification_type: 'sub_assignment'`; no activity_log or in-app notification produced.
- No other assignment-specific emails or tokens exist; Job Details assignment does not send an email.

## Existing assignment status semantics
- Only implicit states:
  - `assigned_to` null ⇒ unassigned.
  - `assigned_to` set ⇒ treated as assigned/active; subcontractor views filter further by job phase (primarily “Job Request”).
- There are **no** fields for pending/accepted/declined, no decision timestamps, and no decline reasons in the current schema.
