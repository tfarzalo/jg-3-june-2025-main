/*
  # Check Individual Ceiling Billing Details
  
  This script checks which properties have "Paint Individual Ceiling" billing details
  and shows the current state. It does NOT create billing details automatically.
  
  The Individual Ceiling option should only appear in work order forms if the property
  already has a billing detail with unit_size_label = "Paint Individual Ceiling".
*/

-- ========================================
-- STEP 1: Check for "Paint Individual Ceiling" unit size
-- ========================================

-- Check if "Paint Individual Ceiling" unit size exists
SELECT 
  'Unit Size Check' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM unit_sizes WHERE unit_size_label = 'Paint Individual Ceiling') 
    THEN 'EXISTS' 
    ELSE 'NOT FOUND' 
  END as status,
  'Paint Individual Ceiling' as unit_size_label;

-- ========================================
-- STEP 2: Check which properties have Individual Ceiling billing details
-- ========================================

-- Show properties that have "Paint Individual Ceiling" billing details
SELECT 
  'Properties with Individual Ceiling billing' as check_type,
  p.property_name,
  bc.name as category_name,
  us.unit_size_label,
  bd.bill_amount,
  bd.sub_pay_amount,
  bd.profit_amount
FROM properties p
JOIN billing_categories bc ON bc.property_id = p.id
JOIN billing_details bd ON bd.property_id = p.id AND bd.category_id = bc.id
JOIN unit_sizes us ON us.id = bd.unit_size_id
WHERE us.unit_size_label = 'Paint Individual Ceiling'
ORDER BY p.property_name;

-- ========================================
-- VERIFICATION
-- ========================================

-- Show all properties with their Painted Ceilings billing details
SELECT 
  p.property_name,
  bc.name as category_name,
  us.unit_size_label,
  bd.bill_amount,
  bd.sub_pay_amount,
  bd.profit_amount
FROM properties p
LEFT JOIN billing_categories bc ON bc.property_id = p.id AND bc.name = 'Painted Ceilings'
LEFT JOIN billing_details bd ON bd.property_id = p.id AND bd.category_id = bc.id
LEFT JOIN unit_sizes us ON us.id = bd.unit_size_id AND us.unit_size_label = 'Per Ceiling'
ORDER BY p.property_name;
