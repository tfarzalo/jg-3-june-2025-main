/*
  # Fix Job Phase Changes Function

  1. Changes
    - Drop existing function before recreating
    - Add proper RLS policies
    - Create function with correct return type
    - Use profiles table for user info

  2. Security
    - Enable RLS
    - Use proper security policies
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable phase change creation" ON public.job_phase_changes;
  DROP POLICY IF EXISTS "Enable phase change viewing" ON public.job_phase_changes;
  DROP POLICY IF EXISTS "Enable phase change updates" ON public.job_phase_changes;
  DROP POLICY IF EXISTS "Enable phase change deletion" ON public.job_phase_changes;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE public.job_phase_changes ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Enable phase change creation"
  ON public.job_phase_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable phase change viewing"
  ON public.job_phase_changes
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable phase change updates"
  ON public.job_phase_changes
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable phase change deletion"
  ON public.job_phase_changes
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_job_phase_changes(uuid);

-- Create function to get job phase changes with profile info
CREATE FUNCTION public.get_job_phase_changes(p_job_id uuid)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  changed_by uuid,
  changed_by_name text,
  changed_by_email text,
  from_phase_id uuid,
  to_phase_id uuid,
  change_reason text,
  changed_at timestamptz,
  from_phase_label text,
  from_phase_color text,
  to_phase_label text,
  to_phase_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jpc.id,
    jpc.job_id,
    jpc.changed_by,
    p.full_name,
    p.email,
    jpc.from_phase_id,
    jpc.to_phase_id,
    jpc.change_reason,
    jpc.changed_at,
    fp.job_phase_label,
    fp.color_dark_mode,
    tp.job_phase_label,
    tp.color_dark_mode
  FROM public.job_phase_changes jpc
  LEFT JOIN public.profiles p ON jpc.changed_by = p.id
  LEFT JOIN public.job_phases fp ON jpc.from_phase_id = fp.id
  JOIN public.job_phases tp ON jpc.to_phase_id = tp.id
  WHERE jpc.job_id = p_job_id
  ORDER BY jpc.changed_at DESC;
END;
$$;