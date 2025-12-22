/*
  # Add Billing Fields and Fix Unit Size Validation

  1. Changes
    - Add billing fields to work_orders table
    - Create function to validate unit size
    - Add check constraints for billing amounts
    - Fix unit size validation without subquery

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

-- Add billing fields to work_orders table
ALTER TABLE work_orders
ADD COLUMN bill_amount decimal(10,2),
ADD COLUMN sub_pay_amount decimal(10,2),
ADD COLUMN profit_amount decimal(10,2),
ADD COLUMN is_hourly boolean DEFAULT false;

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

-- Drop existing unit_size constraint
ALTER TABLE work_orders
DROP CONSTRAINT IF EXISTS valid_unit_size;

-- Add new unit_size validation using the function
ALTER TABLE work_orders
ADD CONSTRAINT valid_unit_size
CHECK (is_valid_unit_size(unit_size));