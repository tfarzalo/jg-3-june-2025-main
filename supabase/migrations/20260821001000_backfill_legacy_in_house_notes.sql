-- Move legacy In-House Notes out of the callback display path.
--
-- Earlier UI versions stored In-House Notes in property_callbacks with a blank
-- unit_number. Now that callbacks require Unit # going forward, those legacy
-- blank-unit internal rows can be copied into the dedicated in-house notes table.
-- The original callback rows are retained, and source_callback_id lets the UI
-- exclude those linked legacy rows from the Callbacks section.

INSERT INTO public.property_in_house_notes (
  property_id,
  note_date,
  painter,
  note,
  created_by,
  source_callback_id,
  created_at,
  updated_at
)
SELECT
  pc.property_id,
  pc.callback_date,
  NULLIF(btrim(pc.painter), ''),
  btrim(pc.reason),
  pc.posted_by,
  pc.id,
  pc.created_at,
  COALESCE(pc.updated_at, pc.created_at)
FROM public.property_callbacks pc
JOIN public.profiles p ON p.id = pc.posted_by
WHERE COALESCE(btrim(pc.unit_number), '') = ''
  AND p.role <> 'subcontractor'
  AND length(btrim(pc.reason)) > 0
ON CONFLICT (source_callback_id) DO NOTHING;

-- Refresh PostgREST's schema cache after the new table/FK migrations.
NOTIFY pgrst, 'reload schema';
