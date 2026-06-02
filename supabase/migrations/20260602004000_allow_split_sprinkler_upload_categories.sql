-- Allow subcontractors and other authenticated users to save split sprinkler uploads.
-- The UI now stores these as canonical file categories after storage upload.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'files_category_check') THEN
    ALTER TABLE public.files DROP CONSTRAINT files_category_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_category') THEN
    ALTER TABLE public.files DROP CONSTRAINT valid_category;
  END IF;
END $$;

ALTER TABLE public.files
  ADD CONSTRAINT files_category_check
  CHECK (
    category IS NULL OR category IN (
      'property_files',
      'job_files',
      'before',
      'sprinkler',
      'other',
      'before_images',
      'after_images',
      'sprinkler_images',
      'sprinkler_with_cover_images',
      'sprinkler_without_cover_images',
      'other_files'
    )
  );

CREATE INDEX IF NOT EXISTS idx_files_split_sprinkler_uploads
  ON public.files(job_id, work_order_id, category)
  WHERE category IN ('sprinkler_with_cover_images', 'sprinkler_without_cover_images');
