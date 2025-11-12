-- Diagnose work order data to check if ceiling and accent wall fields are being saved properly
-- This will help identify why the job details page is not showing the selections

-- 1. Check the most recent work order to see what data was saved
SELECT 
  'Most recent work order data:' as info,
  id,
  job_id,
  painted_ceilings,
  ceiling_rooms_count,
  individual_ceiling_count,
  ceiling_display_label,
  ceiling_billing_detail_id,
  has_accent_wall,
  accent_wall_type,
  accent_wall_count,
  accent_wall_billing_detail_id,
  has_extra_charges,
  extra_charges_description,
  extra_hours,
  created_at
FROM work_orders 
ORDER BY created_at DESC 
LIMIT 1;

-- 2. Check if the billing detail IDs exist in the billing_details table
SELECT 
  'Ceiling billing detail check:' as info,
  bd.id,
  bd.bill_amount,
  bd.sub_pay_amount,
  bc.name as billing_category_name,
  us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bd.billing_category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bd.id IN (
  SELECT ceiling_billing_detail_id 
  FROM work_orders 
  WHERE ceiling_billing_detail_id IS NOT NULL
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 3. Check if the accent wall billing detail IDs exist
SELECT 
  'Accent wall billing detail check:' as info,
  bd.id,
  bd.bill_amount,
  bd.sub_pay_amount,
  bc.name as billing_category_name,
  us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bd.billing_category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bd.id IN (
  SELECT accent_wall_billing_detail_id 
  FROM work_orders 
  WHERE accent_wall_billing_detail_id IS NOT NULL
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 4. Test the get_job_details function with the most recent job
SELECT 
  'Testing get_job_details function:' as info,
  get_job_details(
    (SELECT job_id FROM work_orders ORDER BY created_at DESC LIMIT 1)
  ) as job_data;

-- 5. Check if there are any work orders with missing billing detail IDs
SELECT 
  'Work orders with missing billing details:' as info,
  COUNT(*) as count,
  'painted_ceilings=true but no ceiling_billing_detail_id' as issue
FROM work_orders 
WHERE painted_ceilings = true 
  AND ceiling_billing_detail_id IS NULL

UNION ALL

SELECT 
  'Work orders with missing billing details:' as info,
  COUNT(*) as count,
  'has_accent_wall=true but no accent_wall_billing_detail_id' as issue
FROM work_orders 
WHERE has_accent_wall = true 
  AND accent_wall_billing_detail_id IS NULL;
