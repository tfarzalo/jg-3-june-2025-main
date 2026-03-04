-- Diagnostic script to check billing calculations
-- Run this in your Supabase SQL Editor to see what's happening

-- 1. Check if billing_details table has data
SELECT 
    'billing_details records' as check_name,
    COUNT(*) as count
FROM billing_details;

-- 2. Check billing categories for your properties
SELECT 
    'billing_categories' as check_name,
    bc.id,
    bc.name as category_name,
    p.property_name,
    COUNT(bd.id) as billing_detail_count
FROM billing_categories bc
LEFT JOIN properties p ON p.id = bc.property_id
LEFT JOIN billing_details bd ON bd.category_id = bc.id
GROUP BY bc.id, bc.name, p.property_name
ORDER BY p.property_name, bc.name
LIMIT 20;

-- 3. Sample billing_details with rates
SELECT 
    'Sample billing rates' as check_name,
    bc.name as category_name,
    p.property_name,
    us.unit_size_label,
    bd.is_hourly,
    bd.bill_amount,
    bd.sub_pay_amount,
    (bd.bill_amount - bd.sub_pay_amount) as profit
FROM billing_details bd
JOIN billing_categories bc ON bc.id = bd.category_id
JOIN properties p ON p.id = bc.property_id
JOIN unit_sizes us ON us.id = bd.unit_size_id
ORDER BY p.property_name, bc.name, us.unit_size_label
LIMIT 10;

-- 4. Check a specific job (replace with your job ID)
-- Replace 'YOUR_JOB_ID_HERE' with an actual job UUID
/*
SELECT 
    j.id,
    j.work_order_num,
    p.property_name,
    us.unit_size_label,
    jc.name as job_category,
    jp.job_phase_label as current_phase
FROM jobs j
LEFT JOIN properties p ON p.id = j.property_id
LEFT JOIN unit_sizes us ON us.id = j.unit_size_id
LEFT JOIN job_categories jc ON jc.id = j.job_category_id
LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
WHERE j.id = 'YOUR_JOB_ID_HERE';
*/

-- 5. Test the get_job_details function (replace with your job ID)
/*
SELECT get_job_details('YOUR_JOB_ID_HERE'::uuid);
*/

-- 6. Check for jobs that should have billing
SELECT 
    'Jobs with work orders' as check_name,
    j.id,
    j.work_order_num,
    p.property_name,
    us.unit_size_label,
    jc.name as job_category,
    jp.job_phase_label,
    CASE WHEN wo.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_work_order
FROM jobs j
LEFT JOIN properties p ON p.id = j.property_id  
LEFT JOIN unit_sizes us ON us.id = j.unit_size_id
LEFT JOIN job_categories jc ON jc.id = j.job_category_id
LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
LEFT JOIN work_orders wo ON wo.job_id = j.id AND wo.is_active = true
WHERE jp.job_phase_label != 'Job Request'
ORDER BY j.work_order_num DESC
LIMIT 10;

-- 7. Check if there's a mismatch between job category and billing category names
SELECT DISTINCT
    'Category name comparison' as check_name,
    jc.name as job_category_name,
    bc.name as billing_category_name,
    CASE WHEN jc.name = bc.name THEN 'MATCH' ELSE 'MISMATCH' END as match_status
FROM job_categories jc
CROSS JOIN billing_categories bc
ORDER BY match_status, jc.name;
