-- Diagnostic script to debug Extra Charges billing calculation
-- Run this in your Supabase SQL editor to see what's happening

-- 1. Check if the get_job_details function exists and what it looks like
SELECT 
    proname,
    prosrc
FROM pg_proc 
WHERE proname = 'get_job_details' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Check if there are any "Extra Charges" billing categories
SELECT 
    bc.id,
    bc.name,
    bc.property_id,
    p.property_name,
    bc.created_at
FROM billing_categories bc
LEFT JOIN properties p ON p.id = bc.property_id
WHERE bc.name = 'Extra Charges'
ORDER BY bc.created_at DESC;

-- 3. Check if there are billing details for "Extra Charges" categories
SELECT 
    bd.id,
    bd.property_id,
    bd.category_id,
    bd.unit_size_id,
    bd.bill_amount,
    bd.sub_pay_amount,
    bd.is_hourly,
    bc.name as category_name,
    us.unit_size_label,
    p.property_name
FROM billing_details bd
LEFT JOIN billing_categories bc ON bc.id = bd.category_id
LEFT JOIN unit_sizes us ON us.id = bd.unit_size_id
LEFT JOIN properties p ON p.id = bd.property_id
WHERE bc.name = 'Extra Charges'
ORDER BY bd.created_at DESC;

-- 4. Check what unit sizes exist
SELECT 
    id,
    unit_size_label,
    created_at
FROM unit_sizes
ORDER BY created_at DESC;

-- 5. Check what properties exist
SELECT 
    id,
    property_name,
    created_at
FROM properties
ORDER BY created_at DESC;

-- 6. Test the get_job_details function with a specific job ID
-- Replace 'YOUR_JOB_ID_HERE' with an actual job ID from your system
-- SELECT get_job_details('YOUR_JOB_ID_HERE'::uuid);

-- 7. Check if there are any work orders with extra charges
SELECT 
    wo.id,
    wo.job_id,
    wo.has_extra_charges,
    wo.extra_hours,
    wo.extra_charges_description,
    wo.is_active,
    j.unit_number,
    p.property_name
FROM work_orders wo
LEFT JOIN jobs j ON j.id = wo.job_id
LEFT JOIN properties p ON p.id = j.property_id
WHERE wo.has_extra_charges = true
AND wo.extra_hours > 0
ORDER BY wo.created_at DESC;
