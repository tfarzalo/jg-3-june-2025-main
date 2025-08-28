-- =====================================================
-- QUICK BILLING DEBUG - RUN THESE FIRST
-- =====================================================

-- 1. Check what billing categories exist for the property
SELECT 
    bc.id as category_id,
    bc.name as category_name,
    bc.property_id
FROM billing_categories bc
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY bc.name;

-- 2. Check what billing details exist for each category
SELECT 
    bd.id,
    bd.bill_amount,
    bc.name as category_name,
    us.unit_size_label,
    us.id as unit_size_id
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY bc.name, us.unit_size_label;

-- 3. Check what unit size the current job has
SELECT 
    j.id as job_id,
    j.unit_number,
    j.unit_size_id,
    us.unit_size_label
FROM jobs j
LEFT JOIN unit_sizes us ON j.unit_size_id = us.id
WHERE j.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
ORDER BY j.created_at DESC
LIMIT 3;

-- 4. Check if there are any billing details at all for this property
SELECT 
    COUNT(*) as total_billing_details,
    COUNT(DISTINCT bc.name) as unique_categories,
    COUNT(DISTINCT bd.unit_size_id) as unique_unit_sizes
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d';

-- 5. Check for any billing details without unit size restrictions
SELECT 
    bd.id,
    bd.bill_amount,
    bc.name as category_name,
    bd.unit_size_id,
    us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
LEFT JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.property_id = '436bee92-fc07-42a5-bdfb-ef18c1c4955d'
  AND (bc.name ILIKE '%ceiling%' OR bc.name ILIKE '%accent%')
ORDER BY bc.name, bd.bill_amount;
