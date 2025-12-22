/*
  # Add Individual Ceiling Count Column to Work Orders

  1. Changes
    - Add individual_ceiling_count column to work_orders table
    - This column will store the actual number of individual ceilings when "Paint Individual Ceiling" is selected
    - The existing ceiling_rooms_count will continue to store the billing detail ID for service-based pricing

  2. Purpose
    - Enable work orders to record the actual number of individual ceilings when that option is selected
    - Maintain backward compatibility with existing ceiling_rooms_count field
    - Support both service-based pricing and individual ceiling counting
*/

-- Add individual ceiling count column to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS individual_ceiling_count INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN work_orders.individual_ceiling_count IS 'Number of individual ceilings when "Paint Individual Ceiling" option is selected. This is separate from ceiling_rooms_count which stores the billing detail ID.';

-- Add check constraint to ensure individual_ceiling_count is positive when provided
ALTER TABLE work_orders 
ADD CONSTRAINT IF NOT EXISTS check_individual_ceiling_count 
CHECK (individual_ceiling_count IS NULL OR individual_ceiling_count > 0);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_work_orders_individual_ceiling_count ON work_orders(individual_ceiling_count);
