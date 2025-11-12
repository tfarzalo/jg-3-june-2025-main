/*
  # Add Billing Functions

  1. Changes
    - Add function to get billing details
    - Add function to calculate billing amounts
    - Add proper error handling
    - Add input validation
    
  2. Security
    - Enable security definer
    - Set search path
    - Add parameter validation
*/

-- Create function to validate billing inputs
CREATE OR REPLACE FUNCTION validate_billing_inputs(
  p_property_id uuid,
  p_paint_type text,
  p_unit_size text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if property exists
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_property_id) THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  -- Check if paint type is valid
  IF NOT EXISTS (
    SELECT 1 FROM billing_categories 
    WHERE property_id = p_property_id AND name = p_paint_type
  ) THEN
    RAISE EXCEPTION 'Invalid paint type for property';
  END IF;

  -- Check if unit size is valid
  IF NOT EXISTS (SELECT 1 FROM unit_sizes WHERE unit_size_label = p_unit_size) THEN
    RAISE EXCEPTION 'Invalid unit size';
  END IF;

  RETURN true;
END;
$$;

-- Function to get billing details
CREATE OR REPLACE FUNCTION get_billing_details(
  p_property_id uuid,
  p_paint_type text,
  p_unit_size text
) RETURNS TABLE (
  bill_amount decimal(10,2),
  sub_pay_amount decimal(10,2),
  profit_amount decimal(10,2),
  is_hourly boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate inputs
  PERFORM validate_billing_inputs(p_property_id, p_paint_type, p_unit_size);

  RETURN QUERY
  SELECT 
    bd.bill_amount,
    bd.sub_pay_amount,
    bd.profit_amount,
    bd.is_hourly
  FROM billing_details bd
  JOIN billing_categories bc ON bd.category_id = bc.id
  JOIN unit_sizes us ON bd.unit_size_id = us.id
  WHERE bd.property_id = p_property_id
    AND bc.name = p_paint_type
    AND us.unit_size_label = p_unit_size;
END;
$$;

-- Function to calculate billing amounts
CREATE OR REPLACE FUNCTION calculate_billing(
  p_property_id uuid,
  p_paint_type text,
  p_unit_size text,
  p_extra_hours integer DEFAULT 0
) RETURNS TABLE (
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
  v_base_billing record;
BEGIN
  -- Get base billing details
  SELECT 
    bd.bill_amount,
    bd.sub_pay_amount,
    bd.profit_amount,
    bd.is_hourly
  INTO v_base_billing
  FROM get_billing_details(p_property_id, p_paint_type, p_unit_size) bd;

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
  IF v_base_billing.is_hourly THEN
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