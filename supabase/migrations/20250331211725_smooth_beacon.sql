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

-- Create new policies that don't rely on users table
CREATE POLICY "Enable phase change creation"
  ON public.job_phase_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE id = job_id AND (
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Enable phase change viewing"
  ON public.job_phase_changes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE id = job_id AND (
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Enable phase change updates"
  ON public.job_phase_changes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE id = job_id AND (
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE id = job_id AND (
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Enable phase change deletion"
  ON public.job_phase_changes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE id = job_id AND (
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

-- Create function to get job phase changes
CREATE OR REPLACE FUNCTION public.get_job_phase_changes(p_job_id uuid)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  changed_by uuid,
  from_phase_id uuid,
  to_phase_id uuid,
  change_reason text,
  changed_at timestamptz,
  from_phase jsonb,
  to_phase jsonb,
  changed_by_profile jsonb
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
    jpc.from_phase_id,
    jpc.to_phase_id,
    jpc.change_reason,
    jpc.changed_at,
    CASE 
      WHEN jpc.from_phase_id IS NOT NULL THEN
        jsonb_build_object(
          'id', fp.id,
          'label', fp.job_phase_label,
          'color_light_mode', fp.color_light_mode,
          'color_dark_mode', fp.color_dark_mode
        )
      ELSE NULL
    END AS from_phase,
    jsonb_build_object(
      'id', tp.id,
      'label', tp.job_phase_label,
      'color_light_mode', tp.color_light_mode,
      'color_dark_mode', tp.color_dark_mode
    ) AS to_phase,
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email
    ) AS changed_by_profile
  FROM public.job_phase_changes jpc
  LEFT JOIN public.job_phases fp ON jpc.from_phase_id = fp.id
  JOIN public.job_phases tp ON jpc.to_phase_id = tp.id
  LEFT JOIN public.profiles p ON jpc.changed_by = p.id
  WHERE jpc.job_id = p_job_id
  ORDER BY jpc.changed_at DESC;
END;
$$;