BEGIN;

DO $$
DECLARE 
  r RECORD;
BEGIN
  -- Drop all non-internal triggers on jobs and recreate a single canonical trigger
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE NOT tgisinternal 
      AND tgrelid = 'public.jobs'::regclass
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.jobs;', r.tgname);
  END LOOP;

  CREATE TRIGGER create_job_folder_trigger
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_job_folder();

  -- Drop all non-internal triggers on properties and recreate a single canonical trigger
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE NOT tgisinternal 
      AND tgrelid = 'public.properties'::regclass
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.properties;', r.tgname);
  END LOOP;

  CREATE TRIGGER create_property_folder_trigger
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.create_property_folder();
END $$;

COMMIT;
