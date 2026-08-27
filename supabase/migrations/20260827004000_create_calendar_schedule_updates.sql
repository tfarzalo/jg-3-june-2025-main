-- Create a durable schedule-change stream for the active calendar.
-- This is additive: it does not rewrite existing job, work order, or calendar event data.

CREATE TABLE IF NOT EXISTS public.calendar_schedule_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_event text NOT NULL,
  job_id uuid NULL REFERENCES public.jobs(id) ON DELETE SET NULL,
  scheduled_date date NULL,
  previous_scheduled_date date NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_calendar_schedule_updates_changed_at
  ON public.calendar_schedule_updates(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_schedule_updates_job_id
  ON public.calendar_schedule_updates(job_id);

ALTER TABLE public.calendar_schedule_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read calendar schedule updates"
  ON public.calendar_schedule_updates;

CREATE POLICY "Authenticated users can read calendar schedule updates"
  ON public.calendar_schedule_updates
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.calendar_schedule_updates TO authenticated;

CREATE OR REPLACE FUNCTION public.log_calendar_schedule_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_scheduled_date date;
  v_previous_scheduled_date date;
  v_payload jsonb := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'jobs' THEN
    IF TG_OP = 'UPDATE' AND NOT (
      NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date OR
      NEW.current_phase_id IS DISTINCT FROM OLD.current_phase_id OR
      NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR
      NEW.property_id IS DISTINCT FROM OLD.property_id OR
      NEW.unit_number IS DISTINCT FROM OLD.unit_number OR
      NEW.job_type_id IS DISTINCT FROM OLD.job_type_id OR
      NEW.job_category_id IS DISTINCT FROM OLD.job_category_id OR
      NEW.purchase_order IS DISTINCT FROM OLD.purchase_order
    ) THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
      v_job_id := OLD.id;
      v_scheduled_date := OLD.scheduled_date::date;
      v_previous_scheduled_date := OLD.scheduled_date::date;
      v_payload := jsonb_build_object('work_order_num', OLD.work_order_num);
    ELSE
      v_job_id := NEW.id;
      v_scheduled_date := NEW.scheduled_date::date;
      v_previous_scheduled_date := CASE WHEN TG_OP = 'UPDATE' THEN OLD.scheduled_date::date ELSE NULL END;
      v_payload := jsonb_build_object('work_order_num', NEW.work_order_num);
    END IF;
  ELSIF TG_TABLE_NAME = 'work_orders' THEN
    IF TG_OP = 'DELETE' THEN
      v_job_id := OLD.job_id;
      v_payload := jsonb_build_object('work_order_id', OLD.id);
    ELSE
      v_job_id := NEW.job_id;
      v_payload := jsonb_build_object('work_order_id', NEW.id);
    END IF;

    SELECT jobs.scheduled_date::date
      INTO v_scheduled_date
      FROM public.jobs
      WHERE jobs.id = v_job_id;
  ELSIF TG_TABLE_NAME = 'calendar_events' THEN
    IF TG_OP = 'DELETE' THEN
      v_scheduled_date := OLD.start_at::date;
      v_previous_scheduled_date := OLD.start_at::date;
      v_payload := jsonb_build_object('calendar_event_id', OLD.id);
    ELSE
      v_scheduled_date := NEW.start_at::date;
      v_previous_scheduled_date := CASE WHEN TG_OP = 'UPDATE' THEN OLD.start_at::date ELSE NULL END;
      v_payload := jsonb_build_object('calendar_event_id', NEW.id);
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.calendar_schedule_updates (
    source_table,
    source_event,
    job_id,
    scheduled_date,
    previous_scheduled_date,
    changed_by,
    payload
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_job_id,
    v_scheduled_date,
    v_previous_scheduled_date,
    auth.uid(),
    v_payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_calendar_schedule_jobs_update ON public.jobs;
CREATE TRIGGER log_calendar_schedule_jobs_update
  AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_calendar_schedule_update();

DROP TRIGGER IF EXISTS log_calendar_schedule_work_orders_update ON public.work_orders;
CREATE TRIGGER log_calendar_schedule_work_orders_update
  AFTER INSERT OR UPDATE OR DELETE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_calendar_schedule_update();

DROP TRIGGER IF EXISTS log_calendar_schedule_calendar_events_update ON public.calendar_events;
CREATE TRIGGER log_calendar_schedule_calendar_events_update
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.log_calendar_schedule_update();

DO $$
DECLARE
  v_table regclass := to_regclass('public.calendar_schedule_updates');
BEGIN
  IF v_table IS NULL THEN
    RAISE NOTICE 'Table public.calendar_schedule_updates does not exist; skipping realtime setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'Publication supabase_realtime does not exist; skipping calendar schedule update realtime setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = v_table
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', v_table);
    RAISE NOTICE 'Added % to supabase_realtime publication.', v_table;
  ELSE
    RAISE NOTICE '% is already in supabase_realtime publication.', v_table;
  END IF;
END $$;
