/*
  # Add Hourly Rate Support to Billing Details

  1. Changes
    - Add is_hourly column to billing_details table
    - Update existing records to set is_hourly to false
    - Add check constraint to ensure profit_amount is null when is_hourly is true

  2. Security
    - Maintain existing RLS policies
*/

-- Add is_hourly column to billing_details
ALTER TABLE billing_details 
ADD COLUMN is_hourly boolean NOT NULL DEFAULT false;

-- Make profit_amount nullable
ALTER TABLE billing_details 
ALTER COLUMN profit_amount DROP NOT NULL;

-- Add check constraint to ensure profit_amount is null when is_hourly is true
ALTER TABLE billing_details
ADD CONSTRAINT check_hourly_profit 
CHECK (
  (is_hourly = false AND profit_amount IS NOT NULL) OR 
  (is_hourly = true AND profit_amount IS NULL)
);