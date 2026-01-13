-- Test script to check invoice data in the database
-- This will help us verify that the invoice columns exist and have data

-- Check if invoice columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('invoice_sent', 'invoice_paid', 'invoice_sent_date', 'invoice_paid_date')
ORDER BY column_name;

-- Check for jobs in invoicing phase
SELECT 
    j.id,
    j.work_order_num,
    j.invoice_sent,
    j.invoice_paid,
    j.invoice_sent_date,
    j.invoice_paid_date,
    p.job_phase_label
FROM jobs j
JOIN job_phases p ON j.current_phase_id = p.id
WHERE p.job_phase_label = 'Invoicing'
LIMIT 5;

-- Check all job phases to see what phases exist
SELECT id, job_phase_label, color_dark_mode
FROM job_phases
ORDER BY job_phase_label;
