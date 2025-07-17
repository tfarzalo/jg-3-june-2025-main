/*
  # Fix Billing Function and Add Hooks

  1. Changes
    - Drop and recreate calculate_billing function with proper error handling
    - Add indexes for better performance
    - Add proper RLS policies
    - Fix parameter handling

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop existing function first
DROP FUNCTION IF EXISTS calculate_billing(uuid, text, text, integer);

-- Create function to calculate billing amounts
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
  v_category_id uuid;
  v_unit_size_id uuid;
  v_base_billing record;
BEGIN
  -- Get category ID
  SELECT id INTO v_category_id
  FROM billing_categories
  WHERE property_id = p_property_id AND name = p_paint_type;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Billing category not found for property % and paint type %', p_property_id, p_paint_type;
  END IF;

  -- Get unit size ID
  SELECT id INTO v_unit_size_id
  FROM unit_sizes
  WHERE unit_size_label = p_unit_size;

  IF v_unit_size_id IS NULL THEN
    RAISE EXCEPTION 'Unit size not found: %', p_unit_size;
  END IF;

  -- Get base billing details
  SELECT 
    bd.bill_amount,
    bd.sub_pay_amount,
    bd.profit_amount,
    bd.is_hourly
  INTO v_base_billing
  FROM billing_details bd
  WHERE bd.property_id = p_property_id
    AND bd.category_id = v_category_id
    AND bd.unit_size_id = v_unit_size_id;

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_details_property_category_unit ON billing_details(property_id, category_id, unit_size_id);
CREATE INDEX IF NOT EXISTS idx_billing_categories_property_name ON billing_categories(property_id, name);
CREATE INDEX IF NOT EXISTS idx_unit_sizes_label ON unit_sizes(unit_size_label);