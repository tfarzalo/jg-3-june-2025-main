-- Fix job deletion without removing existing audit history.
-- The calendar schedule audit trigger must not insert a deleted job id into a
-- live foreign-key column after the parent jobs row is gone.

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
      v_job_id := NULL;
      v_scheduled_date := OLD.scheduled_date::date;
      v_previous_scheduled_date := OLD.scheduled_date::date;
      v_payload := jsonb_build_object(
        'deleted_job_id', OLD.id,
        'work_order_num', OLD.work_order_num
      );
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

CREATE OR REPLACE FUNCTION public.delete_job_safely(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file_paths text[] := ARRAY[]::text[];
  v_table text;
  v_deleted_count integer;
  v_counts jsonb := '{}'::jsonb;
  v_job_exists boolean;
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'Job id is required';
  END IF;

  IF NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Only internal users can delete jobs.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE id = p_job_id
  )
  INTO v_job_exists;

  IF NOT v_job_exists THEN
    RETURN jsonb_build_object(
      'success', true,
      'job_deleted', false,
      'file_paths', '[]'::jsonb,
      'deleted_counts', '{}'::jsonb,
      'message', 'Job not found'
    );
  END IF;

  IF to_regclass('public.files') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'files'
        AND column_name = 'job_id'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'files'
        AND column_name = 'path'
    )
  THEN
    SELECT COALESCE(array_agg(regexp_replace(path, '^/+', '')), ARRAY[]::text[])
      INTO v_file_paths
      FROM public.files
      WHERE job_id = p_job_id
        AND path IS NOT NULL
        AND path <> '';
  END IF;

  -- Delete known job-owned records first. Each table is guarded by schema
  -- introspection so older or partially migrated environments can still run it.
  FOREACH v_table IN ARRAY ARRAY[
    'approval_tokens',
    'assignment_decision_tokens',
    'job_quality_control_submissions',
    'job_painter_notes',
    'job_notes',
    'notifications',
    'email_logs',
    'job_snapshots',
    'files',
    'job_phase_changes',
    'work_orders',
    'calendar_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = v_table
          AND column_name = 'job_id'
      )
    THEN
      EXECUTE format('DELETE FROM public.%I WHERE job_id = $1', v_table)
        USING p_job_id;
      GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
      v_counts := v_counts || jsonb_build_object(v_table, v_deleted_count);
    END IF;
  END LOOP;

  DELETE FROM public.jobs
  WHERE id = p_job_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('jobs', v_deleted_count);

  RETURN jsonb_build_object(
    'success', true,
    'job_deleted', v_deleted_count > 0,
    'file_paths', COALESCE(to_jsonb(v_file_paths), '[]'::jsonb),
    'deleted_counts', v_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_job_safely(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_jobs_safely(p_job_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_result jsonb;
  v_results jsonb := '{}'::jsonb;
  v_file_paths text[] := ARRAY[]::text[];
BEGIN
  IF p_job_ids IS NULL OR cardinality(p_job_ids) = 0 THEN
    RAISE EXCEPTION 'At least one job id is required';
  END IF;

  IF NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Only internal users can delete jobs.';
  END IF;

  FOREACH v_job_id IN ARRAY p_job_ids
  LOOP
    v_result := public.delete_job_safely(v_job_id);
    v_results := v_results || jsonb_build_object(v_job_id::text, v_result);

    SELECT v_file_paths || COALESCE(array_agg(file_path.path), ARRAY[]::text[])
      INTO v_file_paths
      FROM jsonb_array_elements_text(COALESCE(v_result->'file_paths', '[]'::jsonb)) AS file_path(path);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'results', v_results,
    'file_paths', COALESCE(to_jsonb(v_file_paths), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_jobs_safely(uuid[]) TO authenticated;
