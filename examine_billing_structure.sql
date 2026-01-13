-- =====================================================
-- EXAMINE BILLING SYSTEM STRUCTURE AND DATA
-- =====================================================
-- This file examines the actual database implementation
-- to understand how billing categories, details, and items work together

-- =====================================================
-- 1. EXAMINE TABLE STRUCTURES
-- =====================================================

-- Check billing_categories table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'billing_categories'
ORDER BY ordinal_position;

-- Check billing_details table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'billing_details'
ORDER BY ordinal_position;

-- Check billing_items table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'billing_items'
ORDER BY ordinal_position;

-- =====================================================
-- 2. EXAMINE ACTUAL DATA RELATIONSHIPS
-- =====================================================

-- Check what billing categories exist for the property
SELECT 
    bc.id as category_id,
    bc.name as category_name,
    bc.property_id,
    bc.description,
    bc.sort_order
FROM billing_categories bc
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY bc.sort_order, bc.name;

-- Check what billing details exist for each category
SELECT 
    bd.id,
    bd.property_id,
    bd.category_id,
    bd.unit_size_id,
    bd.bill_amount,
    bd.sub_pay_amount,
    bd.profit_amount,
    bd.is_hourly,
    bc.name as category_name,
    us.unit_size_label,
    us.id as unit_size_id
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY bc.name, us.unit_size_label;

-- Check what billing items exist for each category
SELECT 
    bi.id,
    bi.category_id,
    bi.name as item_name,
    bi.description,
    bi.is_hourly,
    bc.name as category_name
FROM billing_items bi
JOIN billing_categories bc ON bi.category_id = bc.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY bc.name, bi.name;

-- =====================================================
-- 3. EXAMINE THE SPECIFIC JOB'S CONTEXT
-- =====================================================

-- Check what unit size the current job has
SELECT 
    j.id as job_id,
    j.unit_number,
    j.unit_size_id,
    us.unit_size_label,
    us.id as unit_size_id,
    j.property_id
FROM jobs j
LEFT JOIN unit_sizes us ON j.unit_size_id = us.id
WHERE j.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY j.created_at DESC
LIMIT 5;

-- =====================================================
-- 4. CROSS-REFERENCE: WHAT SHOULD THE FRONTEND FIND?
-- =====================================================

-- Simulate the exact query the frontend is running for Ceiling Paint
SELECT 
    bd.id,
    bd.bill_amount,
    bc.name as category_name,
    us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bd.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
  AND bc.name ILIKE '%ceiling%'
  AND bd.is_hourly = false
ORDER BY us.unit_size_label, bd.bill_amount;

-- Simulate the exact query the frontend is running for Accent Wall
SELECT 
    bd.id,
    bd.bill_amount,
    bc.name as category_name,
    us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bd.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
  AND bc.name ILIKE '%accent%'
  AND bd.is_hourly = false
ORDER BY us.unit_size_label, bd.bill_amount;

-- =====================================================
-- 5. CHECK FOR DATA INCONSISTENCIES
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
-- 6. SUMMARY AND ANALYSIS
-- =====================================================

-- Get a complete overview of the property's billing setup
SELECT 
    p.property_name,
    p.address,
    bc.name as billing_category,
    COUNT(bd.id) as billing_options_count,
    STRING_AGG(DISTINCT us.unit_size_label, ', ') as unit_sizes_with_options,
    COUNT(bi.id) as billing_items_count
FROM properties p
JOIN billing_categories bc ON p.id = bc.property_id
LEFT JOIN billing_details bd ON bc.id = bd.category_id
LEFT JOIN unit_sizes us ON bd.unit_size_id = us.id
LEFT JOIN billing_items bi ON bc.id = bi.category_id
WHERE p.id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
GROUP BY p.id, p.property_name, p.address, bc.id, bc.name
ORDER BY bc.name;

-- =====================================================
-- 7. CHECK FOR MISSING DATA PATTERNS
-- =====================================================

-- Check if the issue is that billing_details table is empty
SELECT 
    'billing_categories' as table_name,
    COUNT(*) as record_count
FROM billing_categories
WHERE property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'

UNION ALL

SELECT 
    'billing_details' as table_name,
    COUNT(*) as record_count
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'

UNION ALL

SELECT 
    'billing_items' as table_name,
    COUNT(*) as record_count
FROM billing_items bi
JOIN billing_categories bc ON bi.category_id = bc.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d';

-- =====================================================
-- USAGE INSTRUCTIONS:
-- =====================================================
-- 1. Run queries 1-3 to understand the data structure
-- 2. Run queries 4-5 to see what the frontend should find
-- 3. Run queries 6-7 to identify data inconsistencies
-- 4. Look for patterns: empty tables, missing relationships, etc.
-- =====================================================
