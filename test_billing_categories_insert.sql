-- Test script to manually insert billing categories
-- This can be run manually if the migration fails

-- First, check what properties exist
SELECT id, property_name FROM properties LIMIT 5;

-- Then, manually insert the categories for a specific property (replace :property_id)
-- INSERT INTO billing_categories (property_id, name, description, sort_order)
-- VALUES 
--   (:property_id, 'Painted Ceilings', 'Ceiling painting services with different pricing based on number of ceilings', 3),
--   (:property_id, 'Accent Walls', 'Accent wall painting services with different pricing based on wall type', 4);

-- Or insert for all properties (safer approach)
INSERT INTO billing_categories (property_id, name, description, sort_order)
SELECT 
  p.id as property_id,
  'Painted Ceilings' as name,
  'Ceiling painting services with different pricing based on number of ceilings' as description,
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
  'Accent wall painting services with different pricing based on wall type' as description,
  4 as sort_order
FROM properties p
WHERE NOT EXISTS (
  SELECT 1 FROM billing_categories bc 
  WHERE bc.property_id = p.id AND bc.name = 'Accent Walls'
);

-- Verify the insertions
SELECT 
  bc.property_id,
  p.property_name,
  bc.name,
  bc.description,
  bc.sort_order
FROM billing_categories bc
JOIN properties p ON bc.property_id = p.id
WHERE bc.name IN ('Painted Ceilings', 'Accent Walls')
ORDER BY p.property_name, bc.sort_order;
