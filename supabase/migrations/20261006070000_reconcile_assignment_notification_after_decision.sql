/*
  Stop obsolete assignment-request notifications after a subcontractor decides.

  This is intentionally additive and does not rewrite existing notification or
  assignment history. Future decisions cancel only the unsent notification for
  the exact current assignment revision. Sent rows remain unchanged.
*/

CREATE OR REPLACE FUNCTION public.cancel_obsolete_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignment_status IN ('accepted', 'declined')
     AND NEW.assignment_status IS DISTINCT FROM OLD.assignment_status
     AND NEW.assigned_at IS NOT NULL THEN
    UPDATE public.job_assignment_notifications
    SET status = 'cancelled',
        updated_at = now(),
        last_error = NULL
    WHERE job_id = NEW.id
      AND assignment_assigned_at = NEW.assigned_at
      AND status IN ('pending', 'failed', 'processing');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cancel_obsolete_assignment_notification_trigger ON public.jobs;
CREATE TRIGGER cancel_obsolete_assignment_notification_trigger
AFTER UPDATE OF assignment_status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.cancel_obsolete_assignment_notification();

CREATE OR REPLACE FUNCTION public.claim_job_assignment_notifications(p_ids uuid[])
RETURNS SETOF public.job_assignment_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role <> 'subcontractor'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  UPDATE public.job_assignment_notifications n
  SET status = 'processing',
      attempt_count = n.attempt_count + 1,
      last_error = NULL,
      updated_at = now()
  FROM public.jobs j
  WHERE n.id = ANY(p_ids)
    AND n.job_id = j.id
    AND n.status IN ('pending', 'failed')
    AND j.assigned_to = n.subcontractor_id
    AND j.assigned_at = n.assignment_assigned_at
    AND j.assignment_status = 'pending'
  RETURNING n.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_job_assignment_notifications(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_job_assignment_notifications(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.cancel_obsolete_assignment_notification() IS
  'Preserves sent history and cancels only unsent notification rows for an assignment once accepted or declined.';
