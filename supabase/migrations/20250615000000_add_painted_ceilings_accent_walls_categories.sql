-- Migration: Add Painted Ceilings and Accent Walls to both job_categories and billing_categories
-- This ensures the foreign key constraints are satisfied

-- Step 1: Add the new categories to job_categories (master list) if they don't exist
INSERT INTO job_categories (name, description, sort_order)
SELECT 'Painted Ceilings', 'Ceiling painting services with different pricing based on service complexity', 3
WHERE NOT EXISTS (
  SELECT 1 FROM job_categories WHERE name = 'Painted Ceilings'
);

INSERT INTO job_categories (name, description, sort_order)
SELECT 'Accent Walls', 'Accent wall painting services with different pricing based on service complexity', 4
WHERE NOT EXISTS (
  SELECT 1 FROM job_categories WHERE name = 'Accent Walls'
);

-- Step 2: Insert the new billing categories for all existing properties
INSERT INTO billing_categories (property_id, name, description, sort_order)
SELECT 
  p.id as property_id,
  'Painted Ceilings' as name,
  'Ceiling painting services with different pricing based on service complexity (not unit size)' as description,
  3 as sort_order
FROM properties p
WHERE NOT EXISTS (
  SELECT 1 FROM billing_categories bc 
  WHERE bc.property_id = p.id AND bc.name = 'Painted Ceilings'
);

INSERT INTO billing_categories (property_id, name, description, sort_order)
SELECT 
  p.id as property_id,
  'Accent Walls' as name,
  'Accent wall painting services with different pricing based on service complexity (not unit size)' as description,
  4 as sort_order
FROM properties p
WHERE NOT EXISTS (
  SELECT 1 FROM billing_categories bc 
  WHERE bc.property_id = p.id AND bc.name = 'Accent Walls'
);

-- Step 3: Add sample billing details for each property with PROPER unit size references
-- This ensures the frontend has real options to display

-- For Painted Ceilings: Add 3 service complexity levels
INSERT INTO billing_details (property_id, category_id, unit_size_id, bill_amount, sub_pay_amount, profit_amount, is_hourly)
SELECT 
  p.id as property_id,
  bc.id as category_id,
  us.id as unit_size_id,
  CASE 
    WHEN us.unit_size_label LIKE '%1%' THEN 150.00  -- Simple ceilings
    WHEN us.unit_size_label LIKE '%2%' THEN 200.00  -- Medium complexity
    ELSE 250.00  -- Complex ceilings
  END as bill_amount,
  CASE 
    WHEN us.unit_size_label LIKE '%1%' THEN 100.00
    WHEN us.unit_size_label LIKE '%2%' THEN 130.00
    ELSE 160.00
  END as sub_pay_amount,
  CASE 
    WHEN us.unit_size_label LIKE '%1%' THEN 50.00   -- Profit for simple
    WHEN us.unit_size_label LIKE '%2%' THEN 70.00   -- Profit for medium
    ELSE 90.00  -- Profit for complex
  END as profit_amount,
  false as is_hourly
FROM properties p
CROSS JOIN (
  SELECT id, name FROM billing_categories 
  WHERE name = 'Painted Ceilings'
) bc
CROSS JOIN (
  SELECT id, unit_size_label FROM unit_sizes 
  WHERE unit_size_label IN ('1 Bedroom', '2 Bedroom', '3+ Bedroom')
  LIMIT 3
) us
WHERE NOT EXISTS (
  SELECT 1 FROM billing_details bd 
  WHERE bd.property_id = p.id 
  AND bd.category_id = bc.id
  AND bd.unit_size_id = us.id
);

-- For Accent Walls: Add 2 service complexity levels
INSERT INTO billing_details (property_id, category_id, unit_size_id, bill_amount, sub_pay_amount, profit_amount, is_hourly)
SELECT 
  p.id as property_id,
  bc.id as category_id,
  us.id as unit_size_id,
  CASE 
    WHEN us.unit_size_label LIKE '%1%' THEN 75.00   -- Basic accent wall
    ELSE 120.00  -- Custom accent wall
  END as bill_amount,
  CASE 
    WHEN us.unit_size_label LIKE '%1%' THEN 50.00
    ELSE 80.00
  END as sub_pay_amount,
  CASE 
    WHEN us.unit_size_label LIKE '%1%' THEN 25.00   -- Profit for basic
    ELSE 40.00  -- Profit for custom
  END as profit_amount,
  false as is_hourly
FROM properties p
CROSS JOIN (
  SELECT id, name FROM billing_categories 
  WHERE name = 'Accent Walls'
) bc
CROSS JOIN (
  SELECT id, unit_size_label FROM unit_sizes 
  WHERE unit_size_label IN ('1 Bedroom', '2+ Bedroom')
  LIMIT 2
) us
WHERE NOT EXISTS (
  SELECT 1 FROM billing_details bd 
  WHERE bd.property_id = p.id 
  AND bd.category_id = bc.id
  AND bd.unit_size_id = us.id
);

-- Step 4: Verify the setup with detailed debugging queries
-- This will help identify any data issues

-- Check what unit sizes exist
SELECT 'Available unit sizes:' as info;
SELECT id, unit_size_label FROM unit_sizes ORDER BY unit_size_label;

-- Check what billing categories were created
SELECT 'Billing categories created:' as info;
SELECT bc.id, bc.name, bc.property_id, bc.description, bc.sort_order
FROM billing_categories bc 
WHERE bc.name IN ('Painted Ceilings', 'Accent Walls')
ORDER BY bc.name, bc.property_id;

-- Check what billing details were created with their unit size info
SELECT 'Billing details with unit sizes:' as info;
SELECT 
  bd.id,
  bd.property_id,
  bc.name as category_name,
  us.unit_size_label,
  bd.bill_amount,
  bd.sub_pay_amount,
  bd.profit_amount
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.name IN ('Painted Ceilings', 'Accent Walls')
ORDER BY bc.name, bd.property_id, us.unit_size_label;

-- Test the exact query the frontend uses
SELECT 'Frontend query test (Painted Ceilings):' as info;
SELECT 
  bd.id, 
  bd.unit_size_id, 
  bd.bill_amount, 
  bd.sub_pay_amount,
  us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.name = 'Painted Ceilings'
AND bc.property_id = (SELECT id FROM properties LIMIT 1)
AND bd.is_hourly = false
ORDER BY bd.bill_amount;
