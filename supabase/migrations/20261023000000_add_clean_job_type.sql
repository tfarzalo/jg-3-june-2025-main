-- Add Clean to the scheduling job types shown by the new job request form.
-- The case-insensitive existence check makes this safe to re-run and avoids
-- creating a duplicate if the option has already been added manually.
INSERT INTO public.job_types (job_type_label)
SELECT 'Clean'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.job_types
  WHERE lower(btrim(job_type_label)) = lower('Clean')
);
