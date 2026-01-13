/*
  # Add Work Order Billing and Validation

  1. Changes
    - Add function to validate unit sizes
    - Add billing fields to work_orders table
    - Add check constraints for billing amounts
    - Add unit size validation

  2. Security
    - Maintain existing RLS policies
*/

-- Create function to validate unit size
CREATE OR REPLACE FUNCTION is_valid_unit_size(size text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM unit_sizes WHERE unit_size_label = size
  );
END;
$$;

-- Add billing fields to work_orders table if they don't exist
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS bill_amount decimal(10,2),
ADD COLUMN IF NOT EXISTS sub_pay_amount decimal(10,2),
ADD COLUMN IF NOT EXISTS profit_amount decimal(10,2),
ADD COLUMN IF NOT EXISTS is_hourly boolean DEFAULT false;

-- Drop existing constraints to avoid conflicts
ALTER TABLE work_orders 
DROP CONSTRAINT IF EXISTS check_billing_amounts,
DROP CONSTRAINT IF EXISTS valid_unit_size;

-- Add check constraint for billing amounts
ALTER TABLE work_orders
ADD CONSTRAINT check_billing_amounts
CHECK (
  (bill_amount IS NULL AND sub_pay_amount IS NULL AND profit_amount IS NULL) OR
  (
    bill_amount IS NOT NULL AND 
    sub_pay_amount IS NOT NULL AND
    (
      (is_hourly = true AND profit_amount IS NULL) OR
      (is_hourly = false AND profit_amount = bill_amount - sub_pay_amount)
    )
  )
);

-- Add new unit_size validation using the function
ALTER TABLE work_orders
ADD CONSTRAINT valid_unit_size
CHECK (is_valid_unit_size(unit_size));