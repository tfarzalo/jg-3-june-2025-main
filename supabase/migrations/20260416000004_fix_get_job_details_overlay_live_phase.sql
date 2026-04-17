-- Fix get_job_details: when returning snapshot data, overlay the current live
-- job_phase so the UI always shows the real current phase (e.g. Invoicing)
-- rather than the phase at which the snapshot was originally taken (Completed).

CREATE OR REPLACE FUNCTION public.get_job_details(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phase_label text;
  v_phase_id uuid;
  v_phase_color_light text;
  v_phase_color_dark text;
  v_snapshot_id uuid;
  v_snapshot_payload jsonb;
  v_snapshot_frozen_at timestamptz;
  v_live_payload jsonb;
BEGIN
  SELECT jp.job_phase_label, jp.id, jp.color_light_mode, jp.color_dark_mode,
         j.active_snapshot_id
    INTO v_phase_label, v_phase_id, v_phase_color_light, v_phase_color_dark,
         v_snapshot_id
  FROM public.jobs j
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF public.is_terminal_job_phase(v_phase_label) THEN
    IF v_snapshot_id IS NULL THEN
      v_snapshot_id := public.create_or_refresh_job_snapshot(
        p_job_id,
        'Automatic terminal job snapshot',
        auth.uid(),
        true
      );
    END IF;

    SELECT snapshot_payload, frozen_at
      INTO v_snapshot_payload, v_snapshot_frozen_at
    FROM public.job_snapshots
    WHERE id = v_snapshot_id;

    IF v_snapshot_payload IS NOT NULL THEN
      -- Overlay the CURRENT live job_phase so the UI always shows the real phase
      -- (e.g. Invoicing even though the snapshot was taken at Completed).
      RETURN v_snapshot_payload
        || jsonb_build_object(
          'job_phase', jsonb_build_object(
            'id',               v_phase_id,
            'label',            v_phase_label,
            'job_phase_label',  v_phase_label,
            'color_light_mode', v_phase_color_light,
            'color_dark_mode',  v_phase_color_dark
          ),
          'historical_data_mode', 'snapshot',
          'active_snapshot_id',   v_snapshot_id,
          'snapshot_frozen_at',   v_snapshot_frozen_at,
          'snapshot_phase_label', v_phase_label
        );
    END IF;
  END IF;

  v_live_payload := public.get_job_details_live(p_job_id);

  RETURN v_live_payload
    || jsonb_build_object(
      'historical_data_mode', 'live',
      'active_snapshot_id',   NULL,
      'snapshot_frozen_at',   NULL,
      'snapshot_phase_label', NULL
    );
END;
$function$;
