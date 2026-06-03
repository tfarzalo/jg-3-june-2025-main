-- Allow every internal admin role to read, create, and manage Quality Control submissions.
-- The UI exposes QC to Admin, Super Admin, JG Management, and Assistant Manager;
-- this keeps the database policy aligned with that behavior.

CREATE OR REPLACE FUNCTION public.can_manage_quality_control()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('is_super_admin', 'admin', 'jg_management', 'assistant_manager')
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.user_roles ur ON ur.id = ura.role_id
      WHERE ura.user_id = auth.uid()
        AND ur.name IN ('Super Admin', 'Admin', 'JG Management', 'Assistant Manager')
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_quality_control() TO authenticated;

DROP POLICY IF EXISTS "Super admins can manage job quality control submissions"
  ON public.job_quality_control_submissions;

DROP POLICY IF EXISTS "Admins can read job quality control submissions"
  ON public.job_quality_control_submissions;

DROP POLICY IF EXISTS "Quality control internal admins manage submissions"
  ON public.job_quality_control_submissions;

CREATE POLICY "Quality control internal admins manage submissions"
  ON public.job_quality_control_submissions
  FOR ALL
  TO authenticated
  USING (public.can_manage_quality_control())
  WITH CHECK (public.can_manage_quality_control());
