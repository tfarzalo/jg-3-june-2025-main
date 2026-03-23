CREATE OR REPLACE FUNCTION public.is_internal_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'is_super_admin')
  );
$$;

CREATE TABLE IF NOT EXISTS public.job_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  topic text NOT NULL,
  note_content text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_notes_topic_not_blank CHECK (length(btrim(topic)) > 0),
  CONSTRAINT job_notes_content_not_blank CHECK (length(btrim(note_content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_job_notes_job_id_created_at
  ON public.job_notes (job_id, created_at DESC);

ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job notes admin select" ON public.job_notes;
CREATE POLICY "Job notes admin select"
  ON public.job_notes
  FOR SELECT
  TO authenticated
  USING (public.is_internal_admin_user());

DROP POLICY IF EXISTS "Job notes admin insert" ON public.job_notes;
CREATE POLICY "Job notes admin insert"
  ON public.job_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_admin_user()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Job notes admin update" ON public.job_notes;
CREATE POLICY "Job notes admin update"
  ON public.job_notes
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_admin_user())
  WITH CHECK (public.is_internal_admin_user());

DROP POLICY IF EXISTS "Job notes admin delete" ON public.job_notes;
CREATE POLICY "Job notes admin delete"
  ON public.job_notes
  FOR DELETE
  TO authenticated
  USING (public.is_internal_admin_user());

DROP TRIGGER IF EXISTS set_job_notes_updated_at ON public.job_notes;
CREATE TRIGGER set_job_notes_updated_at
  BEFORE UPDATE ON public.job_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_notes TO authenticated;
