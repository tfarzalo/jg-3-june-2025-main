/*
  Finalize subcontractor assignments only after the assignment email succeeds.

  Saving an assignee creates a draft assignment. Subcontractors cannot read the
  job until the notification sender releases that exact assignment revision.
*/

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS assignment_notification_sent_at timestamptz;

COMMENT ON COLUMN public.jobs.assignment_notification_sent_at IS
  'When the assignment email for the current assigned_to + assigned_at revision was successfully sent. NULL means the assignment is not finalized or subcontractor-visible.';

CREATE INDEX IF NOT EXISTS idx_jobs_subcontractor_released_assignment
  ON public.jobs (assigned_to, assignment_notification_sent_at)
  WHERE assigned_to IS NOT NULL AND assignment_notification_sent_at IS NOT NULL;

-- Preserve already-delivered current revisions.
UPDATE public.jobs j
SET assignment_notification_sent_at = delivered.sent_at
FROM (
  SELECT job_id, subcontractor_id, assignment_assigned_at, max(sent_at) AS sent_at
  FROM public.job_assignment_notifications
  WHERE status = 'sent' AND sent_at IS NOT NULL
  GROUP BY job_id, subcontractor_id, assignment_assigned_at
) delivered
WHERE j.id = delivered.job_id
  AND j.assigned_to = delivered.subcontractor_id
  AND j.assigned_at = delivered.assignment_assigned_at
  AND j.assignment_notification_sent_at IS NULL;

-- Preserve completed historical workflows and assignments created before the
-- notification ledger existed. Current unsent pending revisions stay NULL.
UPDATE public.jobs
SET assignment_notification_sent_at = COALESCE(assignment_decision_at, assigned_at, updated_at, created_at)
WHERE assigned_to IS NOT NULL
  AND assignment_notification_sent_at IS NULL
  AND (
    assignment_status IN ('accepted', 'in_progress', 'completed')
    OR assigned_at < timestamptz '2026-09-23 00:00:00-07'
  );

CREATE OR REPLACE FUNCTION public.reset_job_assignment_release()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
    NEW.assignment_notification_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_job_assignment_release_trigger ON public.jobs;
CREATE TRIGGER reset_job_assignment_release_trigger
BEFORE UPDATE OF assigned_to, assigned_at ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.reset_job_assignment_release();

CREATE OR REPLACE FUNCTION public.finalize_job_assignment_notifications(
  p_ids uuid[],
  p_sent_at timestamptz,
  p_provider_message_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.job_assignment_notifications n
  SET status = 'sent',
      sent_at = p_sent_at,
      provider_message_id = p_provider_message_id,
      last_error = NULL,
      updated_at = p_sent_at
  WHERE n.id = ANY(p_ids)
    AND n.status = 'processing';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> cardinality(p_ids) THEN
    RAISE EXCEPTION 'One or more assignment notification revisions are no longer sendable';
  END IF;

  UPDATE public.jobs j
  SET assignment_notification_sent_at = p_sent_at,
      assignment_deadline = public.calculate_assignment_deadline(p_sent_at)
  FROM public.job_assignment_notifications n
  WHERE n.id = ANY(p_ids)
    AND n.status = 'sent'
    AND n.sent_at = p_sent_at
    AND j.id = n.job_id
    AND j.assigned_to = n.subcontractor_id
    AND j.assigned_at = n.assignment_assigned_at
    AND j.assignment_status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> cardinality(p_ids) THEN
    RAISE EXCEPTION 'One or more assignments changed before email finalization';
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_job_assignment_notifications(uuid[], timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_job_assignment_notifications(uuid[], timestamptz, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_job_assignment_notifications(uuid[], timestamptz, text) TO service_role;

-- Replace every existing SELECT policy. PostgreSQL permissive policies are
-- ORed together, so leaving one historical read-all policy would bypass the
-- finalized-assignment rule.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs', policy_row.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "jobs_select_finalized_assignment"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  public.is_internal_admin_user()
  OR (
    assigned_to = auth.uid()
    AND assignment_notification_sent_at IS NOT NULL
  )
);

-- The previous update policy was also read-all/write-all. Restrict it so a
-- subcontractor cannot release a hidden assignment by updating the marker (or
-- alter somebody else's job by ID). Existing released-job workflow remains
-- available for the assigned subcontractor.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs', policy_row.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "jobs_update_finalized_assignment"
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  public.is_internal_admin_user()
  OR (
    assigned_to = auth.uid()
    AND assignment_notification_sent_at IS NOT NULL
  )
)
WITH CHECK (
  public.is_internal_admin_user()
  OR (
    assigned_to = auth.uid()
    AND assignment_notification_sent_at IS NOT NULL
  )
);

-- Jobs are created by the office workflow. Keeping INSERT internal-only also
-- prevents a client from supplying its own release timestamp on a new row.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs', policy_row.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "jobs_insert_internal_only"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_admin_user());
