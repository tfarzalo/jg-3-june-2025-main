/*
  # Remove repair notes fields from work_orders table

  1. Changes
    - Remove cabinet_removal_repair column
    - Remove ceiling_lights_repair column

  2. Security
    - Maintain existing RLS policies
*/

-- Remove the columns
ALTER TABLE work_orders
DROP COLUMN IF EXISTS cabinet_removal_repair,
DROP COLUMN IF EXISTS ceiling_lights_repair;