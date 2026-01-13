-- Test script to verify billing categories setup
-- This script checks if the required billing categories exist and can be used

-- 1. Check if billing categories exist
SELECT 
  id,
  name,
  description,
  sort_order,
  created_at
FROM billing_categories 
WHERE name IN ('Painted Ceilings', 'Accent Walls')
ORDER BY sort_order;

-- 2. Check if there are any billing details for these categories
SELECT 
  bc.name as category_name,
  bd.id as billing_detail_id,
  bd.property_id,
  bd.unit_size_id,
  bd.bill_amount,
  bd.sub_pay_amount,
  bd.profit_amount,
  bd.is_hourly
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
WHERE bc.name IN ('Painted Ceilings', 'Accent Walls')
ORDER BY bc.name, bd.bill_amount;

-- 3. Check properties that have these billing categories set up
SELECT DISTINCT
  p.id as property_id,
  p.property_name,
  bc.name as category_name,
  COUNT(bd.id) as billing_options_count
FROM properties p
JOIN billing_details bd ON bd.property_id = p.id
JOIN billing_categories bc ON bd.category_id = bc.id
WHERE bc.name IN ('Painted Ceilings', 'Accent Walls')
GROUP BY p.id, p.property_name, bc.name
ORDER BY p.property_name, bc.name;

-- 4. Sample query to get billing options for a specific property (replace :property_id)
-- SELECT 
--   bd.id, 
--   bd.unit_size_id, 
--   us.unit_size_label, 
--   bd.bill_amount, 
--   bd.sub_pay_amount
-- FROM billing_details bd
-- JOIN billing_categories bc ON bd.category_id = bc.id
-- JOIN unit_sizes us ON bd.unit_size_id = us.id
-- WHERE bd.property_id = :property_id
-- AND bc.name = 'Painted Ceilings'
-- ORDER BY bd.bill_amount;
