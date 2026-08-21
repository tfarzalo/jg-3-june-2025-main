-- Record a clear, subcontractor-specific audit event when a subcontractor
-- changes the job unit size during work order submission.

CREATE OR REPLACE FUNCTION public.update_job_unit_size(
  p_job_id UUID,
  p_unit_size_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_unit_size_id UUID;
  v_old_unit_size_label TEXT;
  v_new_unit_size_label TEXT;
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
BEGIN
  SELECT j.unit_size_id, old_size.unit_size_label, new_size.unit_size_label
  INTO v_old_unit_size_id, v_old_unit_size_label, v_new_unit_size_label
  FROM public.jobs j
  LEFT JOIN public.unit_sizes old_size ON old_size.id = j.unit_size_id
  LEFT JOIN public.unit_sizes new_size ON new_size.id = p_unit_size_id
  WHERE j.id = p_job_id;

  IF v_old_unit_size_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id) THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;

  IF v_old_unit_size_id IS NOT DISTINCT FROM p_unit_size_id THEN
    RETURN json_build_object('success', true, 'changed', false);
  END IF;

  UPDATE public.jobs
  SET
    unit_size_id = p_unit_size_id,
    updated_at = NOW()
  WHERE id = p_job_id;

  SELECT role
  INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id;

  IF v_actor_role = 'subcontractor' THEN
    INSERT INTO public.activity_log (entity_type, entity_id, action, description, changed_by, metadata)
    VALUES (
      'job',
      p_job_id,
      'updated',
      format(
        'Subcontractor changed unit size from %s to %s.',
        COALESCE(v_old_unit_size_label, 'Unassigned'),
        COALESCE(v_new_unit_size_label, 'Unassigned')
      ),
      v_actor_id,
      jsonb_build_object(
        'event_type', 'subcontractor_unit_size_changed',
        'title', 'Subcontractor changed unit size',
        'job_id', p_job_id,
        'old_unit_size_id', v_old_unit_size_id,
        'new_unit_size_id', p_unit_size_id,
        'old_unit_size_label', COALESCE(v_old_unit_size_label, 'Unassigned'),
        'new_unit_size_label', COALESCE(v_new_unit_size_label, 'Unassigned'),
        'changed_by_role', v_actor_role
      )
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'changed', true,
    'old_unit_size_label', COALESCE(v_old_unit_size_label, 'Unassigned'),
    'new_unit_size_label', COALESCE(v_new_unit_size_label, 'Unassigned')
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_job_unit_size(UUID, UUID) TO authenticated;
