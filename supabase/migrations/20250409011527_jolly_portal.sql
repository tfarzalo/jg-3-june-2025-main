/*
  # Add missing unit sizes

  1. New Data
    - Add missing unit sizes including "1 Bedroom"
    
  2. Changes
    - Insert new unit sizes if they don't exist
    - Maintain existing unit sizes
*/

DO $$
BEGIN
  -- Insert unit sizes if they don't exist
  INSERT INTO unit_sizes (unit_size_label)
  VALUES 
    ('1 Bedroom'),
    ('2 Bedroom'),
    ('3 Bedroom'),
    ('Studio')
  ON CONFLICT (unit_size_label) DO NOTHING;
END $$;