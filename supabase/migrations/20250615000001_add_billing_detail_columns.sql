/*
  # Add Billing Detail ID Columns to Work Orders

  1. Changes
    - Add ceiling_billing_detail_id column to work_orders table
    - Add accent_wall_billing_detail_id column to work_orders table
    - These columns will store references to billing_details for service-based pricing

  2. Purpose
    - Enable work orders to reference specific billing details for Painted Ceilings and Accent Walls
    - Support service-based pricing model where pricing is not unit-size dependent
*/

-- Add billing detail ID columns to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS ceiling_billing_detail_id UUID REFERENCES billing_details(id),
ADD COLUMN IF NOT EXISTS accent_wall_billing_detail_id UUID REFERENCES billing_details(id);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_work_orders_ceiling_billing_detail_id ON work_orders(ceiling_billing_detail_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_accent_wall_billing_detail_id ON work_orders(accent_wall_billing_detail_id);

-- Add comments for documentation
COMMENT ON COLUMN work_orders.ceiling_billing_detail_id IS 'Reference to billing_details for Painted Ceilings service pricing';
COMMENT ON COLUMN work_orders.accent_wall_billing_detail_id IS 'Reference to billing_details for Accent Walls service pricing';
