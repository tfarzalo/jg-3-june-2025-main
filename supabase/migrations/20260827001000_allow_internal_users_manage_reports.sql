-- Report templates and generated report history are operational admin-view
-- resources. Any authenticated non-subcontractor user should be able to see
-- and use templates/reports created by other admin-view users.

CREATE OR REPLACE FUNCTION public.is_internal_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IS NOT NULL
      AND role <> 'subcontractor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_internal_admin_user() TO authenticated;

DROP POLICY IF EXISTS "report_templates_owner_full_access" ON public.report_templates;
DROP POLICY IF EXISTS "report_templates_internal_users_manage" ON public.report_templates;

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_templates_internal_users_manage"
  ON public.report_templates
  FOR ALL
  TO authenticated
  USING (public.is_internal_admin_user())
  WITH CHECK (public.is_internal_admin_user());

DROP POLICY IF EXISTS "report_runs_owner_full_access" ON public.report_runs;
DROP POLICY IF EXISTS "report_runs_internal_users_manage" ON public.report_runs;

ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_runs_internal_users_manage"
  ON public.report_runs
  FOR ALL
  TO authenticated
  USING (public.is_internal_admin_user())
  WITH CHECK (public.is_internal_admin_user());
