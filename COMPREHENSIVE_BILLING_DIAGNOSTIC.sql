-- COMPREHENSIVE BILLING DIAGNOSTIC
-- This script checks all aspects of the billing system to identify why billing_details might be null

-- ============================================================================
-- PART 1: Check if properties have billing rates configured
-- ============================================================================
SELECT 
    'Property Billing Configuration' as check_name,
    p.id as property_id,
    p.property_name,
    COUNT(DISTINCT pb.id) as billing_rate_count,
    string_agg(DISTINCT c.name, ', ') as configured_categories
FROM properties p
LEFT JOIN property_billing pb ON p.id = pb.property_id
LEFT JOIN categories c ON pb.category_id = c.id
GROUP BY p.id, p.property_name
ORDER BY p.property_name;

-- ============================================================================
-- PART 2: Sample billing rates for properties
-- ============================================================================
SELECT 
    'Sample Billing Rates' as check_name,
    p.property_name,
    c.name as category_name,
    pb.bill_to_customer,
    pb.sub_pay
FROM properties p
JOIN property_billing pb ON p.id = pb.property_id
JOIN categories c ON pb.category_id = c.id
ORDER BY p.property_name, c.name
LIMIT 25;

-- ============================================================================
-- PART 3: Check recent jobs and their billing status
-- ============================================================================
SELECT 
    'Recent Jobs Billing Status' as check_name,
    j.id as job_id,
    j.phase,
    p.property_name,
    c.name as job_category,
    j.billing_details IS NOT NULL as has_billing_details,
    j.work_order_id IS NOT NULL as has_work_order,
    CASE 
        WHEN pb.id IS NOT NULL THEN 'Has matching billing rate'
        ELSE 'NO BILLING RATE FOUND'
    END as billing_rate_status
FROM jobs j
LEFT JOIN properties p ON j.property_id = p.id
LEFT JOIN categories c ON j.category_id = c.id
LEFT JOIN property_billing pb ON j.property_id = pb.property_id AND j.category_id = pb.category_id
WHERE j.created_at > NOW() - INTERVAL '30 days'
ORDER BY j.created_at DESC
LIMIT 20;

-- ============================================================================
-- PART 4: Check if get_job_details function is returning billing_details
-- ============================================================================
-- Pick a specific job that should have billing details
WITH sample_job AS (
    SELECT j.id
    FROM jobs j
    JOIN work_orders wo ON j.id = wo.job_id
    WHERE j.phase != 'Job Request'
    ORDER BY j.created_at DESC
    LIMIT 1
)
SELECT 
    'Function Output Test' as check_name,
    gjd.*
FROM sample_job sj
CROSS JOIN LATERAL get_job_details(sj.id::text) gjd;

-- ============================================================================
-- PART 5: Check for jobs with work orders but no billing_details
-- ============================================================================
SELECT 
    'Jobs Missing Billing Details' as check_name,
    j.id as job_id,
    j.phase,
    p.property_name,
    c.name as category_name,
    j.work_order_id,
    j.billing_details,
    EXISTS(
        SELECT 1 FROM property_billing pb 
        WHERE pb.property_id = j.property_id 
        AND pb.category_id = j.category_id
    ) as has_matching_billing_rate
FROM jobs j
LEFT JOIN properties p ON j.property_id = p.id
LEFT JOIN categories c ON j.category_id = c.id
WHERE j.work_order_id IS NOT NULL
    AND j.phase != 'Job Request'
    AND j.billing_details IS NULL
ORDER BY j.created_at DESC
LIMIT 10;

-- ============================================================================
-- PART 6: Verify the billing calculation logic directly
-- ============================================================================
-- Test billing calculation for a specific job
WITH sample_job AS (
    SELECT j.id, j.property_id, j.category_id
    FROM jobs j
    JOIN work_orders wo ON j.id = wo.job_id
    WHERE j.phase != 'Job Request'
    ORDER BY j.created_at DESC
    LIMIT 1
)
SELECT 
    'Direct Billing Calculation Test' as check_name,
    sj.id as job_id,
    pb.bill_to_customer as base_bill_to_customer,
    pb.sub_pay as base_sub_pay,
    COALESCE(SUM(addon_pb.bill_to_customer), 0) as addon_bill_total,
    COALESCE(SUM(addon_pb.sub_pay), 0) as addon_pay_total,
    pb.bill_to_customer + COALESCE(SUM(addon_pb.bill_to_customer), 0) as total_bill_to_customer,
    pb.sub_pay + COALESCE(SUM(addon_pb.sub_pay), 0) as total_sub_pay,
    (pb.bill_to_customer + COALESCE(SUM(addon_pb.bill_to_customer), 0)) - 
    (pb.sub_pay + COALESCE(SUM(addon_pb.sub_pay), 0)) as profit
FROM sample_job sj
LEFT JOIN property_billing pb ON sj.property_id = pb.property_id AND sj.category_id = pb.category_id
LEFT JOIN job_addons ja ON sj.id = ja.job_id
LEFT JOIN property_billing addon_pb ON sj.property_id = addon_pb.property_id AND ja.addon_id = addon_pb.category_id
GROUP BY sj.id, pb.bill_to_customer, pb.sub_pay;
