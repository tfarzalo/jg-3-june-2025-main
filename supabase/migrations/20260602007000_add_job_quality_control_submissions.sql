-- Store job-scoped Quality Control submissions and media references.

CREATE TABLE IF NOT EXISTS public.job_quality_control_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  form_id uuid REFERENCES public.lead_forms(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_total numeric(5,2) NOT NULL DEFAULT 0,
  media_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_quality_control_submissions_job_id_created_at
  ON public.job_quality_control_submissions(job_id, created_at DESC);

ALTER TABLE public.job_quality_control_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage job quality control submissions"
  ON public.job_quality_control_submissions;

CREATE POLICY "Super admins can manage job quality control submissions"
  ON public.job_quality_control_submissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'is_super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'is_super_admin'
    )
  );

DROP TRIGGER IF EXISTS set_job_quality_control_submissions_updated_at
  ON public.job_quality_control_submissions;

CREATE TRIGGER set_job_quality_control_submissions_updated_at
  BEFORE UPDATE ON public.job_quality_control_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_quality_control_submissions TO authenticated;
