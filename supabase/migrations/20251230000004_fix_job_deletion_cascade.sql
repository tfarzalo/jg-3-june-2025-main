-- Fix foreign key constraints to allow job deletion by adding ON DELETE CASCADE
-- This handles email_logs, work_orders, and files tables

-- 1. Fix email_logs (The error reported by user)
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_logs_job_id_fkey'
  ) THEN
    ALTER TABLE email_logs DROP CONSTRAINT email_logs_job_id_fkey;
  END IF;

  -- Add the new constraint with ON DELETE CASCADE
  ALTER TABLE email_logs
    ADD CONSTRAINT email_logs_job_id_fkey
    FOREIGN KEY (job_id)
    REFERENCES jobs(id)
    ON DELETE CASCADE;
END $$;

-- 2. Fix work_orders
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Find the constraint name dynamically for work_orders
  SELECT conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE conrelid = 'work_orders'::regclass
  AND confrelid = 'jobs'::regclass
  AND contype = 'f';

  -- If found, replace it with CASCADE
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE work_orders DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_job_id_fkey
      FOREIGN KEY (job_id)
      REFERENCES jobs(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Fix files
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Find the constraint name dynamically for files
  SELECT conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE conrelid = 'files'::regclass
  AND confrelid = 'jobs'::regclass
  AND contype = 'f';

  -- If found, replace it with CASCADE
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE files DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    
    ALTER TABLE files
      ADD CONSTRAINT files_job_id_fkey
      FOREIGN KEY (job_id)
      REFERENCES jobs(id)
      ON DELETE CASCADE;
  END IF;
END $$;
