-- Update the Quality Control scorecard metadata and allow admin read access for leaderboard reporting.

DO $$
DECLARE
  v_form_id uuid;
BEGIN
  SELECT id
    INTO v_form_id
  FROM public.lead_forms
  WHERE name = 'JG Painting Pros Quality Control'
  LIMIT 1;

  IF v_form_id IS NOT NULL THEN
    UPDATE public.lead_form_fields
    SET validation_rules = '{
      "sections": [
        {
          "key": "prep",
          "label": "Prep",
          "max": 25,
          "items": [
            {"key":"prep_work_order_photos","label":"Submit work order/photos","max":5},
            {"key":"prep_holes_repaired","label":"Holes repaired","max":5},
            {"key":"prep_sanding_completed","label":"Sanding completed","max":5},
            {"key":"prep_cracks_caulked","label":"Cracks caulked","max":5},
            {"key":"prep_spot_prime_completed","label":"Spot prime completed","max":5}
          ]
        },
        {
          "key": "paint_quality",
          "label": "Paint Quality",
          "max": 25,
          "items": [
            {"key":"paint_full_coverage","label":"Full coverage","max":5},
            {"key":"paint_no_roller_lines","label":"No roller lines","max":5},
            {"key":"paint_trim_baseboards","label":"Trim/baseboards","max":5},
            {"key":"paint_doors_frames_completed","label":"Doors & frames completed","max":5},
            {"key":"paint_proper_sheen","label":"Proper sheen","max":5}
          ]
        },
        {
          "key": "details_finish",
          "label": "Details / Finish",
          "max": 25,
          "items": [
            {"key":"details_clean_switch_plates","label":"Clean switch plates","max":5},
            {"key":"details_no_runs_drips","label":"No runs/drips","max":5},
            {"key":"details_straight_cut_lines","label":"Straight cut lines","max":5},
            {"key":"details_floors_protected","label":"Floors protected","max":5},
            {"key":"details_hardware_protected","label":"Hardware protected","max":5}
          ]
        },
        {
          "key": "cleanup_closeout",
          "label": "Cleanup & Closeout",
          "max": 25,
          "items": [
            {"key":"cleanup_floors_cleaned","label":"Floors cleaned","max":5},
            {"key":"cleanup_trash_removed","label":"Trash removed","max":5},
            {"key":"cleanup_paint_returned_organized","label":"Paint returned/organized","max":5},
            {"key":"cleanup_reset_unit_items","label":"Reset unit items","max":5},
            {"key":"cleanup_lock_unit_return_keys","label":"Lock unit / return keys","max":5}
          ]
        }
      ],
      "likert": [0, 1, 2, 3, 4, 5],
      "total": 100
    }'::jsonb,
        updated_at = now()
    WHERE form_id = v_form_id
      AND field_name = 'quality_score'
      AND field_type = 'score_matrix';
  END IF;
END
$$;

DROP POLICY IF EXISTS "Admins can read job quality control submissions"
  ON public.job_quality_control_submissions;

CREATE POLICY "Admins can read job quality control submissions"
  ON public.job_quality_control_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'jg_management', 'is_super_admin')
    )
  );
