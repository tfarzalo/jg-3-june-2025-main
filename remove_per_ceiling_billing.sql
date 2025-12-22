/*
  # Remove Incorrectly Created "Per Ceiling" Billing Details
  
  This script removes the "Per Ceiling" billing details that were incorrectly
  created for all properties. These should not have been created automatically.
  
  Only properties that already had "Paint Individual Ceiling" billing details
  should have the Individual Ceiling option available.
*/

-- ========================================
-- STEP 1: Remove billing details that reference "Per Ceiling" FIRST
-- ========================================

-- Delete billing details that use the "Per Ceiling" unit size
DELETE FROM billing_details 
WHERE unit_size_id IN (
  SELECT id FROM unit_sizes WHERE unit_size_label = 'Per Ceiling'
);

-- ========================================
-- STEP 2: Remove "Per Ceiling" unit size AFTER billing details are deleted
-- ========================================

-- Delete the "Per Ceiling" unit size that was incorrectly created
DELETE FROM unit_sizes 
WHERE unit_size_label = 'Per Ceiling';

-- ========================================
-- STEP 3: Verification - Show remaining billing details
-- ========================================

-- Show what billing details remain for Painted Ceilings
SELECT 
  'Remaining Painted Ceilings billing details' as check_type,
  p.property_name,
  bc.name as category_name,
  us.unit_size_label,
  bd.bill_amount,
  bd.sub_pay_amount,
  bd.profit_amount
FROM properties p
JOIN billing_categories bc ON bc.property_id = p.id AND bc.name = 'Painted Ceilings'
JOIN billing_details bd ON bd.property_id = p.id AND bd.category_id = bc.id
JOIN unit_sizes us ON us.id = bd.unit_size_id
ORDER BY p.property_name, us.unit_size_label;

-- ========================================
-- STEP 4: Check for "Paint Individual Ceiling" billing details
-- ========================================

-- Show properties that have "Paint Individual Ceiling" billing details (these should remain)
SELECT 
  'Properties with Paint Individual Ceiling billing' as check_type,
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
