/*
  # Add missing unit sizes

  1. New Data
    - Add missing unit sizes to the unit_sizes table
      - "3 Bedroom"
      - Other common unit sizes for completeness

  2. Changes
    - Insert new unit sizes if they don't exist
*/

DO $$
BEGIN
  -- Insert unit sizes if they don't exist
  IF NOT EXISTS (SELECT 1 FROM unit_sizes WHERE unit_size_label = '3 Bedroom') THEN
    INSERT INTO unit_sizes (unit_size_label) VALUES ('3 Bedroom');
  END IF;

  -- Add other common unit sizes for completeness
  IF NOT EXISTS (SELECT 1 FROM unit_sizes WHERE unit_size_label = 'Studio') THEN
    INSERT INTO unit_sizes (unit_size_label) VALUES ('Studio');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM unit_sizes WHERE unit_size_label = '1 Bedroom') THEN
    INSERT INTO unit_sizes (unit_size_label) VALUES ('1 Bedroom');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM unit_sizes WHERE unit_size_label = '2 Bedroom') THEN
    INSERT INTO unit_sizes (unit_size_label) VALUES ('2 Bedroom');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM unit_sizes WHERE unit_size_label = '4 Bedroom') THEN
    INSERT INTO unit_sizes (unit_size_label) VALUES ('4 Bedroom');
  END IF;
END $$;