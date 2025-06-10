/*
  # Add extra_charges_unit_size to work_orders table

  1. Changes
    - Add extra_charges_unit_size column to work_orders table
    - Make column nullable
    - Add column description

  2. Security
    - Maintain existing RLS policies
*/

-- Add extra_charges_unit_size column
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS extra_charges_unit_size text;