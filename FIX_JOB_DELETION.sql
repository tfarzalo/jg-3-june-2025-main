-- FIX_JOB_DELETION.sql
-- Run this script in the Supabase SQL Editor to fix the job deletion error.

-- 1. Fix email_logs (The error you are seeing)
DO $$
BEGIN
  -- Drop the existing constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_logs_job_id_fkey'
  ) THEN
    ALTER TABLE email_logs DROP CONSTRAINT email_logs_job_id_fkey;
  END IF;

  -- Add it back with ON DELETE CASCADE
  ALTER TABLE email_logs
    ADD CONSTRAINT email_logs_job_id_fkey
    FOREIGN KEY (job_id)
    REFERENCES jobs(id)
    ON DELETE CASCADE;
END $$;

-- 2. Fix work_orders (Likely blocking deletion too)
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE conrelid = 'work_orders'::regclass
  AND confrelid = 'jobs'::regclass
  AND contype = 'f';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE work_orders DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_job_id_fkey
      FOREIGN KEY (job_id)
      REFERENCES jobs(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Fix files (Attachments linked to jobs)
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE conrelid = 'files'::regclass
  AND confrelid = 'jobs'::regclass
  AND contype = 'f';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE files DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    
    ALTER TABLE files
      ADD CONSTRAINT files_job_id_fkey
      FOREIGN KEY (job_id)
      REFERENCES jobs(id)
      ON DELETE CASCADE;
  END IF;
END $$;
