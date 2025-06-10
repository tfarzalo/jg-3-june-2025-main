/*
  # Add ceiling lights repair column to work orders

  1. Changes
    - Add ceiling_lights_repair column to work_orders table
    - Make column nullable to maintain backward compatibility
    - Add column description

  2. Security
    - Maintain existing RLS policies
*/

-- Add ceiling_lights_repair column
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS ceiling_lights_repair text;