-- Add invoice tracking fields to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS invoice_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invoice_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invoice_sent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invoice_paid_date TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_invoice_sent ON jobs(invoice_sent);
CREATE INDEX IF NOT EXISTS idx_jobs_invoice_paid ON jobs(invoice_paid);

-- Add comments for documentation
COMMENT ON COLUMN jobs.invoice_sent IS 'Whether the invoice has been sent to the customer';
COMMENT ON COLUMN jobs.invoice_paid IS 'Whether the invoice has been paid by the customer';
COMMENT ON COLUMN jobs.invoice_sent_date IS 'Date when the invoice was sent';
COMMENT ON COLUMN jobs.invoice_paid_date IS 'Date when the invoice was paid';
