-- Allow admin/settings roles to rename unit size labels with the same guardrails
-- used by job category renames.

DROP FUNCTION IF EXISTS public.rename_unit_size(uuid, text);

CREATE OR REPLACE FUNCTION public.rename_unit_size(
  p_unit_size_id uuid,
  p_new_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trimmed_label text := btrim(p_new_label);
BEGIN
  IF NOT public.can_manage_admin_settings() THEN
    RAISE EXCEPTION 'You do not have permission to rename unit sizes'
      USING ERRCODE = '42501';
  END IF;

  IF v_trimmed_label = '' THEN
    RAISE EXCEPTION 'Unit size label cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.unit_sizes
    WHERE id = p_unit_size_id
  ) THEN
    RAISE EXCEPTION 'Unit size not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.unit_sizes
    WHERE id <> p_unit_size_id
      AND lower(unit_size_label) = lower(v_trimmed_label)
  ) THEN
    RAISE EXCEPTION 'A unit size with that label already exists'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.unit_sizes
  SET unit_size_label = v_trimmed_label
  WHERE id = p_unit_size_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_unit_size(uuid, text) TO authenticated;
