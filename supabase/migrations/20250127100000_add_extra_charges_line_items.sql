/*
  # Phase 2: Add Extra Charges Line Items to Work Orders
  
  1. Changes
    - Add extra_charges_line_items JSONB column to work_orders table
    - Add index for querying work orders with extra charges
    - Create helper function for calculating extra charges totals
    - Add audit log entry for Phase 2 migration
    
  2. Data Structure
    The JSONB column stores an array of line items:
    [
      {
        "id": "temp-123",
        "categoryId": "uuid",
        "categoryName": "Door Frame Repair",
        "detailId": "uuid",
        "detailName": "1 Bedroom",
        "quantity": 2.5,
        "billRate": 40.00,
        "subRate": 20.00,
        "isHourly": true,
        "jobBillingCategory": "owner",
        "notes": "Fixed damaged frame",
        "calculatedBillAmount": 100.00,
        "calculatedSubAmount": 50.00
      }
    ]
    
  3. Security
    - No RLS changes needed - uses existing work_orders policies
    - Column is nullable - backward compatible with existing records
    
  4. Backward Compatibility
    - Existing work orders unaffected (NULL value)
    - Legacy has_extra_charges/extra_charges_description fields remain
    - Can coexist with old and new formats
*/

-- Step 1: Add JSONB column for structured extra charges line items
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS extra_charges_line_items JSONB DEFAULT NULL;

-- Step 2: Add column comment for documentation
COMMENT ON COLUMN work_orders.extra_charges_line_items IS 
'Phase 2: Structured extra charges data as array of line items. Each item contains:
- id: temporary ID for UI tracking
- categoryId: billing_categories.id (where is_extra_charge = true)
- categoryName: display name of category
- detailId: billing_details.id 
- detailName: display name of detail option
- quantity: number (hours for hourly, units for fixed)
- billRate: rate per unit from billing_details
- subRate: sub pay rate per unit
- isHourly: boolean from billing_details.cost_based
- jobBillingCategory: owner|warranty|tenant
- notes: optional description
- calculatedBillAmount: quantity * billRate
- calculatedSubAmount: quantity * subRate

Replaces legacy has_extra_charges/extra_charges_description for new work orders.
Both formats supported for backward compatibility.';

-- Step 3: Create index for efficiently querying work orders with extra charges
CREATE INDEX IF NOT EXISTS idx_work_orders_extra_charges_exists 
ON work_orders ((extra_charges_line_items IS NOT NULL))
WHERE extra_charges_line_items IS NOT NULL;

-- Step 4: Create helper function to calculate extra charges totals
CREATE OR REPLACE FUNCTION get_work_order_extra_charges_total(wo_id UUID)
RETURNS TABLE(
  total_bill_amount NUMERIC,
  total_sub_amount NUMERIC,
  item_count INTEGER
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_line_items JSONB;
BEGIN
  -- Get the line items for this work order
  SELECT extra_charges_line_items 
  INTO v_line_items
  FROM work_orders 
  WHERE id = wo_id;
  
  -- Return zeros if no line items
  IF v_line_items IS NULL OR jsonb_array_length(v_line_items) = 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::INTEGER;
    RETURN;
  END IF;
  
  -- Calculate totals from all line items
  RETURN QUERY
  SELECT 
    SUM((item->>'calculatedBillAmount')::NUMERIC)::NUMERIC as total_bill_amount,
    SUM((item->>'calculatedSubAmount')::NUMERIC)::NUMERIC as total_sub_amount,
    COUNT(*)::INTEGER as item_count
  FROM jsonb_array_elements(v_line_items) as item;
END;
$$;

COMMENT ON FUNCTION get_work_order_extra_charges_total IS 
'Phase 2: Calculate total bill amount, sub pay amount, and item count from extra_charges_line_items JSONB.
Returns (0, 0, 0) if no line items present.

Example usage:
SELECT * FROM get_work_order_extra_charges_total(''work-order-uuid'');

Returns:
- total_bill_amount: sum of all calculatedBillAmount values
- total_sub_amount: sum of all calculatedSubAmount values  
- item_count: number of line items';

-- Step 5: Create helper function to get extra charges summary for a work order
CREATE OR REPLACE FUNCTION get_extra_charges_summary(wo_id UUID)
RETURNS TABLE(
  category_name TEXT,
  detail_name TEXT,
  quantity NUMERIC,
  unit_type TEXT,
  bill_amount NUMERIC,
  sub_amount NUMERIC,
  notes TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (item->>'categoryName')::TEXT as category_name,
    (item->>'detailName')::TEXT as detail_name,
    (item->>'quantity')::NUMERIC as quantity,
    CASE 
      WHEN (item->>'isHourly')::BOOLEAN THEN 'hours'
      ELSE 'units'
    END as unit_type,
    (item->>'calculatedBillAmount')::NUMERIC as bill_amount,
    (item->>'calculatedSubAmount')::NUMERIC as sub_amount,
    (item->>'notes')::TEXT as notes
  FROM work_orders wo
  CROSS JOIN LATERAL jsonb_array_elements(wo.extra_charges_line_items) as item
  WHERE wo.id = wo_id
    AND wo.extra_charges_line_items IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION get_extra_charges_summary IS 
'Phase 2: Get a readable summary of all extra charges for a work order.
Returns one row per line item with human-readable fields.

Example usage:
SELECT * FROM get_extra_charges_summary(''work-order-uuid'');';

-- Step 6: Add to billing audit log (optional, for tracking)
-- Note: Using 'UPDATED' action since PHASE_2_MIGRATION is not in the constraint
DO $$
BEGIN
  -- Only insert if billing_audit_log table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'billing_audit_log'
  ) THEN
    INSERT INTO billing_audit_log (
      property_id,
      category_id,
      action,
      changes,
      performed_by,
      created_at
    )
    SELECT 
      p.id,
      NULL,
      'UPDATED', -- Using allowed action value
      jsonb_build_object(
        'migration', '20250127100000_add_extra_charges_line_items',
        'description', 'Added extra_charges_line_items JSONB column to work_orders table',
        'backward_compatible', true,
        'breaking_changes', false,
        'phase', 'Phase 2'
      ),
      NULL, -- System action
      NOW()
    FROM properties p
    LIMIT 1; -- Just one audit entry
  END IF;
END $$;
