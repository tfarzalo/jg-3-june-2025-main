-- Allow subcontractors to view Job Request media attached to jobs assigned to them.
-- This is intentionally additive and does not remove or narrow existing policies.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'files'
      AND policyname = 'Subcontractors can view assigned job request media'
  ) THEN
    CREATE POLICY "Subcontractors can view assigned job request media"
    ON public.files
    FOR SELECT
    TO authenticated
    USING (
      category = 'job_files'
      AND job_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.jobs j
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE j.id = files.job_id
          AND j.assigned_to = auth.uid()
          AND p.role = 'subcontractor'
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Subcontractors can read assigned job request media objects'
  ) THEN
    CREATE POLICY "Subcontractors can read assigned job request media objects"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'files'
      AND EXISTS (
        SELECT 1
        FROM public.files f
        JOIN public.jobs j ON j.id = f.job_id
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE COALESCE(f.storage_path, f.path) = storage.objects.name
          AND f.category = 'job_files'
          AND j.assigned_to = auth.uid()
          AND p.role = 'subcontractor'
      )
    );
  END IF;
END $$;
