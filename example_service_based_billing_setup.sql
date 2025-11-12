-- Example: Setting up service-based billing for Painted Ceilings and Accent Walls
-- This shows how to populate the billing_details table for service-based categories

-- Example 1: Painted Ceilings - Service Complexity Based
-- Replace :property_id with the actual property ID

-- Basic ceiling painting (standard height, smooth surface)
INSERT INTO billing_details (property_id, category_id, unit_size_id, bill_amount, sub_pay_amount, profit_amount, is_hourly)
SELECT 
  :property_id,
  bc.id,
  us.id, -- This unit_size_id is just for reference, not for filtering
  75.00, -- $75 per ceiling
  50.00, -- $50 to subcontractor
  25.00, -- $25 profit
  false
FROM billing_categories bc
CROSS JOIN unit_sizes us
WHERE bc.property_id = :property_id 
AND bc.name = 'Painted Ceilings'
AND us.unit_size_label = '1 Bedroom' -- Use any unit size as reference
LIMIT 1;

-- High ceiling painting (vaulted ceilings, requires scaffolding)
INSERT INTO billing_details (property_id, category_id, unit_size_id, bill_amount, sub_pay_amount, profit_amount, is_hourly)
SELECT 
  :property_id,
  bc.id,
  us.id,
  125.00, -- $125 per ceiling (higher due to complexity)
  85.00,  -- $85 to subcontractor
  40.00,  -- $40 profit
  false
FROM billing_categories bc
CROSS JOIN unit_sizes us
WHERE bc.property_id = :property_id 
AND bc.name = 'Painted Ceilings'
AND us.unit_size_label = '2 Bedroom'
LIMIT 1;

-- Example 2: Accent Walls - Service Complexity Based

-- Basic accent wall (simple color change)
INSERT INTO billing_details (property_id, category_id, unit_size_id, bill_amount, sub_pay_amount, profit_amount, is_hourly)
SELECT 
  :property_id,
  bc.id,
  us.id,
  60.00, -- $60 per wall
  40.00, -- $40 to subcontractor
  20.00, -- $20 profit
  false
FROM billing_categories bc
CROSS JOIN unit_sizes us
WHERE bc.property_id = :property_id 
AND bc.name = 'Accent Walls'
AND us.unit_size_label = '1 Bedroom'
LIMIT 1;

-- Custom accent wall (textured, patterned, or complex design)
INSERT INTO billing_details (property_id, category_id, unit_size_id, bill_amount, sub_pay_amount, profit_amount, is_hourly)
SELECT 
  :property_id,
  bc.id,
  us.id,
  120.00, -- $120 per wall (higher due to complexity)
  80.00,  -- $80 to subcontractor
  40.00,  -- $40 profit
  false
FROM billing_categories bc
CROSS JOIN unit_sizes us
WHERE bc.property_id = :property_id 
AND bc.name = 'Accent Walls'
AND us.unit_size_label = '2 Bedroom'
LIMIT 1;

-- Note: The unit_size_id in these examples is just for reference
-- The actual pricing is based on service complexity, not the unit size
-- Multiple options can exist for the same property, allowing users to choose
-- the appropriate service level for their specific needs
