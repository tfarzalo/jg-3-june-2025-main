-- =====================================================
-- BILLING DATABASE DEBUGGING QUERIES
-- =====================================================
-- This file contains queries to debug the billing system
-- and understand why the work order forms aren't finding billing options

-- =====================================================
-- 1. EXAMINE PROPERTY BILLING CATEGORIES
-- =====================================================

-- Check what billing categories exist for the specific property
SELECT 
    bc.id as category_id,
    bc.name as category_name,
    bc.property_id,
    bc.created_at,
    bc.updated_at
FROM billing_categories bc
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY bc.name;

-- =====================================================
-- 2. EXAMINE BILLING DETAILS FOR EACH CATEGORY
-- =====================================================

-- Check billing details for Ceiling Paint category
SELECT 
    bd.id,
    bd.property_id,
    bd.category_id,
    bd.unit_size_id,
    bd.bill_amount,
    bd.is_hourly,
    bd.created_at,
    bc.name as category_name,
    us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
  AND bc.name ILIKE '%ceiling%'
ORDER BY us.unit_size_label, bd.bill_amount;

-- Check billing details for Accent Wall category
SELECT 
    bd.id,
    bd.property_id,
    bd.category_id,
    bd.unit_size_id,
    bd.bill_amount,
    bd.is_hourly,
    bd.created_at,
    bc.name as category_name,
    us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
  AND bc.name ILIKE '%accent%'
ORDER BY us.unit_size_label, bd.bill_amount;

-- =====================================================
-- 3. EXAMINE ALL BILLING DETAILS FOR THE PROPERTY
-- =====================================================

-- Get all billing details for the property with full context
SELECT 
    bd.id,
    bd.property_id,
    bd.category_id,
    bd.unit_size_id,
    bd.bill_amount,
    bd.is_hourly,
    bd.created_at,
    bc.name as category_name,
    us.unit_size_label,
    us.id as unit_size_id
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY bc.name, us.unit_size_label;

-- =====================================================
-- 4. EXAMINE THE SPECIFIC JOB'S UNIT SIZE
-- =====================================================

-- Check what unit size the current job has
SELECT 
    j.id as job_id,
    j.unit_number,
    j.unit_size_id,
    us.unit_size_label,
    us.id as unit_size_id
FROM jobs j
LEFT JOIN unit_sizes us ON j.unit_size_id = us.id
WHERE j.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY j.created_at DESC
LIMIT 5;

-- =====================================================
-- 5. CROSS-REFERENCE: WHAT SHOULD THE QUERY FIND?
-- =====================================================

-- Simulate the exact query the frontend is running
-- Replace 'UNIT_SIZE_ID_HERE' with the actual unit_size_id from step 4

-- For Ceiling Paint (run after getting unit_size_id from query 4):
-- SELECT 
--     bd.id,
--     bd.bill_amount,
--     bc.name as category_name
-- FROM billing_details bd
-- JOIN billing_categories bc ON bd.category_id = bc.id
-- WHERE bd.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
--   AND bd.unit_size_id = 'PASTE_UNIT_SIZE_ID_HERE'  -- Copy from query 4 results
--   AND bc.name ILIKE '%ceiling%'
--   AND bd.is_hourly = false;

-- For Accent Wall (run after getting unit_size_id from query 4):
-- SELECT 
--     bd.id,
--     bd.bill_amount,
--     bc.name as category_name
-- FROM billing_details bd
-- JOIN billing_categories bc ON bd.category_id = bc.id
-- WHERE bd.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
--   AND bd.unit_size_id = 'PASTE_UNIT_SIZE_ID_HERE'  -- Copy from query 4 results
--   AND bc.name ILIKE '%accent%'
--   AND bd.is_hourly = false;

-- =====================================================
-- 6. CHECK FOR DATA INCONSISTENCIES
-- =====================================================

-- Check if there are billing categories without billing details
SELECT 
    bc.id as category_id,
    bc.name as category_name,
    COUNT(bd.id) as billing_details_count
FROM billing_categories bc
LEFT JOIN billing_details bd ON bc.id = bd.category_id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
GROUP BY bc.id, bc.name
ORDER BY bc.name;

-- Check if there are billing details without matching unit sizes
SELECT 
    bd.id,
    bd.unit_size_id,
    bc.name as category_name
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
LEFT JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
  AND us.id IS NULL;

-- =====================================================
-- 7. SUMMARY QUERY
-- =====================================================

-- Get a complete overview of the property's billing setup
SELECT 
    p.property_name,
    p.address,
    bc.name as billing_category,
    COUNT(bd.id) as billing_options_count,
    STRING_AGG(DISTINCT us.unit_size_label, ', ') as unit_sizes_with_options
FROM properties p
JOIN billing_categories bc ON p.id = bc.property_id
LEFT JOIN billing_details bd ON bc.id = bd.category_id
LEFT JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE p.id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
GROUP BY p.id, p.property_name, p.address, bc.id, bc.name
ORDER BY bc.name;

-- =====================================================
-- USAGE INSTRUCTIONS:
-- =====================================================
-- 1. Run queries 1-4 first to understand the data structure
-- 2. Note the unit_size_id from query 4
-- 3. Replace 'UNIT_SIZE_ID_HERE' in queries 5 with the actual ID
-- 4. Run queries 5 to see what the frontend should find
-- 5. Run queries 6-7 to check for data inconsistencies
-- =====================================================
