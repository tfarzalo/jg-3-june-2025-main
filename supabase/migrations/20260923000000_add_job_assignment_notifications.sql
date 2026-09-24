-- Additive assignment-notification ledger. This migration does not update or
-- delete existing jobs, assignments, tokens, or email logs.

CREATE TABLE IF NOT EXISTS public.job_assignment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  subcontractor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignment_assigned_at timestamptz NOT NULL,
  recipient_email text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  scheduled_date_snapshot date,
  scheduled_end_date_snapshot date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_assignment_notifications_assignment_unique
    UNIQUE (job_id, subcontractor_id, assignment_assigned_at)
);

CREATE INDEX IF NOT EXISTS idx_job_assignment_notifications_actionable
  ON public.job_assignment_notifications (status, created_at DESC)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_job_assignment_notifications_job
  ON public.job_assignment_notifications (job_id, assignment_assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_assignment_notifications_subcontractor
  ON public.job_assignment_notifications (subcontractor_id, status);

ALTER TABLE public.job_assignment_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can read assignment notifications"
  ON public.job_assignment_notifications;
CREATE POLICY "Internal users can read assignment notifications"
  ON public.job_assignment_notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role <> 'subcontractor'
    )
  );

GRANT SELECT ON public.job_assignment_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_job_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.assigned_to IS NULL OR NEW.assigned_at IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT NULL THEN
      UPDATE public.job_assignment_notifications
      SET status = 'cancelled', updated_at = now()
      WHERE job_id = NEW.id
        AND status IN ('pending', 'failed', 'processing');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
    UPDATE public.job_assignment_notifications
    SET status = 'cancelled', updated_at = now()
    WHERE job_id = NEW.id
      AND status IN ('pending', 'failed', 'processing');

    SELECT email INTO v_email FROM public.profiles WHERE id = NEW.assigned_to;

    INSERT INTO public.job_assignment_notifications (
      job_id, subcontractor_id, assignment_assigned_at, recipient_email,
      requested_by, scheduled_date_snapshot, scheduled_end_date_snapshot
    ) VALUES (
      NEW.id, NEW.assigned_to, NEW.assigned_at, v_email,
      auth.uid(), NEW.scheduled_date::date, NEW.scheduled_end_date::date
    )
    ON CONFLICT (job_id, subcontractor_id, assignment_assigned_at) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_job_assignment_notification_trigger ON public.jobs;
CREATE TRIGGER queue_job_assignment_notification_trigger
AFTER INSERT OR UPDATE OF assigned_to, assigned_at ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.queue_job_assignment_notification();

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
  RETURNING n.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_job_assignment_notifications(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_job_assignment_notifications(uuid[]) TO authenticated;

COMMENT ON TABLE public.job_assignment_notifications IS
  'Additive delivery ledger for the current jobs.assigned_to assignment revision.';
