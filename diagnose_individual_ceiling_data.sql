/*
  # Diagnose Individual Ceiling Data
  
  This script checks if Individual Ceiling data is being saved correctly
  in the work_orders table and displays properly in job details.
*/

-- ========================================
-- STEP 1: Check work_orders with Individual Ceiling data
-- ========================================

SELECT 
  'Work Orders with Individual Ceiling data' as check_type,
  wo.id as work_order_id,
  wo.painted_ceilings,
  wo.ceiling_rooms_count,
  wo.individual_ceiling_count,
  wo.ceiling_display_label,
  wo.ceiling_billing_detail_id,
  wo.created_at,
  p.property_name
FROM work_orders wo
LEFT JOIN jobs j ON j.work_order_num::text = wo.id::text
LEFT JOIN properties p ON p.id = j.property_id
WHERE wo.ceiling_display_label = 'Paint Individual Ceiling'
   OR wo.individual_ceiling_count IS NOT NULL
ORDER BY wo.created_at DESC
LIMIT 10;

-- ========================================
-- STEP 2: Check recent work orders for ceiling data
-- ========================================

SELECT 
  'Recent Work Orders - Ceiling Data' as check_type,
  wo.id as work_order_id,
  wo.painted_ceilings,
  wo.ceiling_rooms_count,
  wo.individual_ceiling_count,
  wo.ceiling_display_label,
  wo.ceiling_billing_detail_id,
  wo.created_at,
  p.property_name
FROM work_orders wo
LEFT JOIN jobs j ON j.work_order_num::text = wo.id::text
LEFT JOIN properties p ON p.id = j.property_id
WHERE wo.painted_ceilings = true
ORDER BY wo.created_at DESC
LIMIT 10;

-- ========================================
-- STEP 3: Check if billing details are being found correctly
-- ========================================

SELECT 
  'Billing Details for Paint Individual Ceiling' as check_type,
  p.property_name,
  bc.name as category_name,
  us.unit_size_label,
  bd.id as billing_detail_id,
  bd.bill_amount,
  bd.sub_pay_amount,
  bd.profit_amount
FROM properties p
JOIN billing_categories bc ON bc.property_id = p.id AND bc.name = 'Painted Ceilings'
JOIN billing_details bd ON bd.property_id = p.id AND bd.category_id = bc.id
JOIN unit_sizes us ON us.id = bd.unit_size_id
WHERE us.unit_size_label = 'Paint Individual Ceiling'
ORDER BY p.property_name;

-- ========================================
-- STEP 4: Check work_orders table schema
-- ========================================

SELECT 
  'Work Orders Table Schema' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'work_orders' 
  AND column_name IN ('individual_ceiling_count', 'ceiling_display_label', 'painted_ceilings', 'ceiling_rooms_count')
ORDER BY column_name;
