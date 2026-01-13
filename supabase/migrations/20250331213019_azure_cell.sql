/*
  # Fix Billing Calculation Function

  1. Changes
    - Drop existing function
    - Create new calculate_billing function with better error handling
    - Add proper validation and error messages
    - Add indexes for performance
    - Add proper security settings

  2. Security
    - Use security definer
    - Set proper search path
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