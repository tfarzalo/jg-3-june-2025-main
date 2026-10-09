-- Make the explicit admin "Delete Job" action remove the complete job record,
-- including the immutable original subcontractor submission. This does not
-- affect cancel, archive, or phase-change behavior.

CREATE OR REPLACE FUNCTION public.reject_original_submission_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Original submissions remain immutable during normal application use. The
  -- transaction-local flag is set only by the authorized SECURITY DEFINER job
  -- deletion RPC so a complete job deletion can remove its own history.
  IF TG_OP = 'DELETE'
     AND current_setting('app.deleting_job', true) = 'on'
     AND public.is_internal_admin_user()
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Original subcontractor submissions are immutable';
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
    SELECT 1 FROM public.jobs WHERE id = p_job_id
  ) INTO v_job_exists;

  IF NOT v_job_exists THEN
    RETURN jsonb_build_object(
      'success', true,
      'job_deleted', false,
      'file_paths', '[]'::jsonb,
      'deleted_counts', '{}'::jsonb,
      'message', 'Job not found'
    );
  END IF;

  -- Capture both current and originally submitted object paths before their
  -- database records are removed. The client deletes these objects only after
  -- this transaction succeeds.
  SELECT COALESCE(array_agg(DISTINCT paths.path), ARRAY[]::text[])
    INTO v_file_paths
  FROM (
    SELECT regexp_replace(COALESCE(NULLIF(f.storage_path, ''), f.path), '^/+', '') AS path
    FROM public.files f
    WHERE f.job_id = p_job_id

    UNION

    SELECT regexp_replace(sf.storage_path, '^/+', '') AS path
    FROM public.work_order_original_submission_files sf
    JOIN public.work_order_original_submissions os
      ON os.id = sf.original_submission_id
    WHERE os.job_id = p_job_id
  ) paths
  WHERE paths.path IS NOT NULL AND paths.path <> '';

  -- The flag is local to this database transaction. It does not weaken the
  -- immutable-history protection for edits or standalone delete statements.
  PERFORM set_config('app.deleting_job', 'on', true);

  DELETE FROM public.work_order_original_submission_files sf
  USING public.work_order_original_submissions os
  WHERE sf.original_submission_id = os.id
    AND os.job_id = p_job_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object(
    'work_order_original_submission_files', v_deleted_count
  );

  DELETE FROM public.work_order_original_submissions
  WHERE job_id = p_job_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object(
    'work_order_original_submissions', v_deleted_count
  );

  -- Delete job-owned records that either retain their job reference on parent
  -- deletion or do not have a foreign key to jobs.
  IF to_regclass('public.activity_log') IS NOT NULL THEN
    DELETE FROM public.activity_log
    WHERE (entity_type = 'job' AND entity_id = p_job_id)
       OR metadata ->> 'job_id' = p_job_id::text;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('activity_log', v_deleted_count);
  END IF;

  IF to_regclass('public.sms_notification_queue') IS NOT NULL THEN
    DELETE FROM public.sms_notification_queue
    WHERE job_id = p_job_id
       OR metadata ->> 'job_id' = p_job_id::text;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('sms_notification_queue', v_deleted_count);
  END IF;

  IF to_regclass('public.sms_notification_logs') IS NOT NULL THEN
    DELETE FROM public.sms_notification_logs
    WHERE metadata ->> 'job_id' = p_job_id::text;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('sms_notification_logs', v_deleted_count);
  END IF;

  -- Every table in this list is guarded so the migration remains compatible
  -- with environments where an optional feature table is not present.
  FOREACH v_table IN ARRAY ARRAY[
    'approval_tokens',
    'assignment_decision_tokens',
    'job_quality_control_submissions',
    'job_painter_notes',
    'job_notes',
    'notifications',
    'email_logs',
    'job_snapshots',
    'job_assignment_notifications',
    'calendar_schedule_updates',
    'outbound_email_sends',
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

  DELETE FROM public.jobs WHERE id = p_job_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('jobs', v_deleted_count);

  IF v_deleted_count <> 1 THEN
    RAISE EXCEPTION 'Job deletion did not remove the requested job';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'job_deleted', true,
    'file_paths', COALESCE(to_jsonb(v_file_paths), '[]'::jsonb),
    'deleted_counts', v_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_job_safely(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_job_safely(uuid) TO authenticated;
