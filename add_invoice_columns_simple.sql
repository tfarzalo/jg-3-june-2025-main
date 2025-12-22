-- Add invoice status columns to jobs table
-- Simple script to add the necessary columns

-- Add invoice_sent column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'invoice_sent'
  ) THEN
    ALTER TABLE jobs ADD COLUMN invoice_sent boolean DEFAULT false;
  END IF;
END $$;

-- Add invoice_paid column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'invoice_paid'
  ) THEN
    ALTER TABLE jobs ADD COLUMN invoice_paid boolean DEFAULT false;
  END IF;
END $$;

-- Add invoice_sent_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'invoice_sent_date'
  ) THEN
    ALTER TABLE jobs ADD COLUMN invoice_sent_date timestamp with time zone;
  END IF;
END $$;

-- Add invoice_paid_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'invoice_paid_date'
  ) THEN
    ALTER TABLE jobs ADD COLUMN invoice_paid_date timestamp with time zone;
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_invoice_sent ON jobs(invoice_sent);
CREATE INDEX IF NOT EXISTS idx_jobs_invoice_paid ON jobs(invoice_paid);
