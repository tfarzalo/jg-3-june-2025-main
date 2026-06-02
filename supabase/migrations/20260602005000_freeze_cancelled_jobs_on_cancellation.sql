-- Ensure every job freezes immediately when it is moved into Cancelled.
-- Older installs may have created the terminal snapshot trigger before
-- Cancelled was included in is_terminal_job_phase, so redefine both here.

CREATE OR REPLACE FUNCTION public.is_terminal_job_phase(p_phase_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(trim(p_phase_label), '') IN ('Completed', 'Invoicing', 'Cancelled', 'Archived');
$$;

CREATE OR REPLACE FUNCTION public.job_terminal_snapshot_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase_label text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_phase_id IS NOT DISTINCT FROM OLD.current_phase_id THEN
    RETURN NEW;
  END IF;

  SELECT job_phase_label
    INTO v_phase_label
  FROM public.job_phases
  WHERE id = NEW.current_phase_id;

  IF public.is_terminal_job_phase(v_phase_label) THEN
    PERFORM public.create_or_refresh_job_snapshot(
      NEW.id,
      CASE
        WHEN v_phase_label = 'Cancelled' THEN 'Automatic snapshot on cancellation'
        ELSE 'Automatic terminal job snapshot on phase change'
      END,
      auth.uid(),
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_job_terminal_snapshot ON public.jobs;

CREATE TRIGGER trigger_job_terminal_snapshot
AFTER INSERT OR UPDATE OF current_phase_id
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.job_terminal_snapshot_trigger();

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT j.id
    FROM public.jobs j
    JOIN public.job_phases jp ON jp.id = j.current_phase_id
    WHERE jp.job_phase_label = 'Cancelled'
      AND j.active_snapshot_id IS NULL
  LOOP
    PERFORM public.create_or_refresh_job_snapshot(
      v_job.id,
      'Backfill snapshot for existing cancelled job',
      NULL,
      true
    );
  END LOOP;
END
$$;
