/*
  # Fix Billing Details Query

  1. Changes
    - Update billing_details query to use category_id instead of paint_type
    - Add property_id to billing_categories table if not exists
    - Create function to get billing details by paint type name

  2. Security
    - Maintain existing RLS policies
*/

-- First check if property_id column exists in billing_categories
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing_categories' AND column_name = 'property_id'
  ) THEN
    -- Add property_id to billing_categories if it doesn't exist
    ALTER TABLE billing_categories
    ADD COLUMN property_id uuid REFERENCES properties(id) ON DELETE CASCADE;
    
    -- Update the existing unique constraint to include property_id
    ALTER TABLE billing_categories
    DROP CONSTRAINT IF EXISTS billing_categories_name_key;
    
    -- Add new unique constraint
    ALTER TABLE billing_categories
    ADD CONSTRAINT billing_categories_property_id_name_key UNIQUE (property_id, name);
    
    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_billing_categories_property_name 
    ON billing_categories(property_id, name);
  END IF;
END $$;

-- Create or replace function to get billing details by paint type name
CREATE OR REPLACE FUNCTION get_billing_by_paint_type(
  p_property_id uuid,
  p_paint_type text,
  p_unit_size_id uuid
)
RETURNS TABLE (
  bill_amount decimal(10,2),
  sub_pay_amount decimal(10,2),
  profit_amount decimal(10,2),
  is_hourly boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id uuid;
BEGIN
  -- Get category ID for the paint type
  SELECT id INTO v_category_id
  FROM billing_categories
  WHERE property_id = p_property_id AND name = p_paint_type;
  
  -- If category not found, return empty result
  IF v_category_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Return billing details for the category and unit size
  RETURN QUERY
  SELECT 
    bd.bill_amount,
    bd.sub_pay_amount,
    bd.profit_amount,
    bd.is_hourly
  FROM billing_details bd
  WHERE bd.property_id = p_property_id
    AND bd.category_id = v_category_id
    AND bd.unit_size_id = p_unit_size_id;
END;
$$;

-- Update calculate_billing function to use the new get_billing_by_paint_type function
CREATE OR REPLACE FUNCTION calculate_billing(
  p_property_id uuid,
  p_paint_type text,
  p_unit_size text,
  p_extra_hours integer DEFAULT 0
)
RETURNS TABLE (
  bill_amount decimal(10,2),
  sub_pay_amount decimal(10,2),
  profit_amount decimal(10,2),
  is_hourly boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_size_id uuid;
  v_base_billing record;
BEGIN
  -- Input validation
  IF p_property_id IS NULL THEN
    RAISE EXCEPTION 'Property ID is required';
  END IF;

  IF p_paint_type IS NULL OR p_paint_type = '' THEN
    RAISE EXCEPTION 'Paint type is required';
  END IF;

  IF p_unit_size IS NULL OR p_unit_size = '' THEN
    RAISE EXCEPTION 'Unit size is required';
  END IF;

  -- Get unit size ID
  SELECT id INTO v_unit_size_id
  FROM unit_sizes
  WHERE unit_size_label = p_unit_size;

  IF v_unit_size_id IS NULL THEN
    -- Return null values if unit size not found
    RETURN QUERY
    SELECT 
      NULL::decimal(10,2),
      NULL::decimal(10,2),
      NULL::decimal(10,2),
      false;
    RETURN;
  END IF;

  -- Get base billing details using the new function
  SELECT 
    bd.bill_amount,
    bd.sub_pay_amount,
    bd.profit_amount,
    bd.is_hourly
  INTO v_base_billing
  FROM get_billing_by_paint_type(p_property_id, p_paint_type, v_unit_size_id) bd;

  -- If no billing details found, return null values
  IF v_base_billing IS NULL THEN
    RETURN QUERY
    SELECT 
      NULL::decimal(10,2),
      NULL::decimal(10,2),
      NULL::decimal(10,2),
      false;
    RETURN;
  END IF;

  -- Calculate amounts based on rate type
  IF v_base_billing.is_hourly AND p_extra_hours > 0 THEN
    -- For hourly rates, multiply by hours
    RETURN QUERY
    SELECT
      v_base_billing.bill_amount * p_extra_hours,
      v_base_billing.sub_pay_amount * p_extra_hours,
      NULL::decimal(10,2),
      true;
  ELSE
    -- For fixed rates, return base amounts
    RETURN QUERY
    SELECT
      v_base_billing.bill_amount,
      v_base_billing.sub_pay_amount,
      v_base_billing.profit_amount,
      false;
  END IF;
END;
$$;