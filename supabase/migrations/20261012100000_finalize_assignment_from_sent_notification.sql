/*
  Compatibility safety net for assignment notification senders.

  The database remains the authority for subcontractor visibility even when an
  older deployed sender marks the notification row sent directly instead of
  calling finalize_job_assignment_notifications().
*/

CREATE OR REPLACE FUNCTION public.release_job_for_sent_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sent'
     AND NEW.sent_at IS NOT NULL
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.sent_at IS DISTINCT FROM NEW.sent_at) THEN
    UPDATE public.jobs j
    SET assignment_notification_sent_at = NEW.sent_at,
        assignment_deadline = public.calculate_assignment_deadline(NEW.sent_at)
    WHERE j.id = NEW.job_id
      AND j.assigned_to = NEW.subcontractor_id
      AND j.assigned_at = NEW.assignment_assigned_at
      AND j.assignment_status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS release_job_for_sent_assignment_notification_trigger
  ON public.job_assignment_notifications;

CREATE TRIGGER release_job_for_sent_assignment_notification_trigger
AFTER UPDATE OF status, sent_at ON public.job_assignment_notifications
FOR EACH ROW
EXECUTE FUNCTION public.release_job_for_sent_assignment_notification();

COMMENT ON FUNCTION public.release_job_for_sent_assignment_notification() IS
  'Releases only the exact current pending assignment revision when its notification is marked sent.';
