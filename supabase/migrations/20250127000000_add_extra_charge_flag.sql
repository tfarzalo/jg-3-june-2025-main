/*
  # Add Extra Charge Flag to Billing Categories - Phase 1
  
  1. Changes
    - Add is_extra_charge boolean column to billing_categories
    - Add archived_at timestamp for preserving original Extra Charges category
    - Create index for filtering extra charge categories
    - Preserve existing data (no deletions)
    
  2. Data Migration
    - Mark existing "Extra Charges" category as archived for reference
    - Set is_extra_charge = true for archived Extra Charges category
    
  3. Security
    - No RLS changes needed - uses existing policies
*/

-- Step 1: Add new columns to billing_categories table
ALTER TABLE billing_categories
ADD COLUMN IF NOT EXISTS is_extra_charge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Step 2: Add column comments for documentation
COMMENT ON COLUMN billing_categories.is_extra_charge IS 
  'When true, category items appear in Extra Charges dropdown on work orders. Mutually exclusive with include_in_work_order.';

COMMENT ON COLUMN billing_categories.archived_at IS 
  'Timestamp when category was archived. Archived categories are preserved for reference but not actively used.';

-- Step 3: Create index for efficient filtering of extra charge categories
CREATE INDEX IF NOT EXISTS idx_billing_categories_extra_charge 
  ON billing_categories(property_id, is_extra_charge, archived_at)
  WHERE archived_at IS NULL;

-- Step 4: Archive existing "Extra Charges" categories (preserve for reference)
-- This runs for each property that has an Extra Charges category
-- IMPORTANT: Set include_in_work_order = false to avoid constraint violation
UPDATE billing_categories
SET 
  archived_at = NOW(),
  is_extra_charge = true,
  include_in_work_order = false,  -- Ensure mutual exclusivity
  sort_order = 9999  -- Push to bottom for display
WHERE 
  name = 'Extra Charges'
  AND archived_at IS NULL;

-- Create audit log table for tracking billing changes (if not exists)
CREATE TABLE IF NOT EXISTS billing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_id UUID REFERENCES billing_categories(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'DELETED', 'ARCHIVED')),
  changes JSONB,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on audit log for property queries
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_property 
  ON billing_audit_log(property_id, created_at DESC);

-- Enable RLS on audit log table
ALTER TABLE billing_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log (read-only for authenticated users)
CREATE POLICY "Enable read access for authenticated users"
  ON billing_audit_log
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Log the archive action for existing Extra Charges categories
INSERT INTO billing_audit_log (property_id, category_id, action, changes, performed_by)
SELECT 
  bc.property_id,
  bc.id,
  'ARCHIVED',
  jsonb_build_object(
    'reason', 'Phase 1 Migration - Preserved for reference',
    'archived_at', bc.archived_at,
    'original_name', bc.name
  ),
  NULL  -- System action, no user
FROM billing_categories bc
WHERE 
  bc.name = 'Extra Charges'
  AND bc.archived_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_audit_log bal 
    WHERE bal.category_id = bc.id AND bal.action = 'ARCHIVED'
  );

-- DATA CLEANUP: Fix any existing rows that would violate the constraint
-- Set include_in_work_order = false for any categories that have is_extra_charge = true
UPDATE billing_categories
SET include_in_work_order = false
WHERE is_extra_charge = true 
  AND include_in_work_order = true;

-- Add constraint to prevent both flags being true simultaneously
-- This ensures data integrity going forward
ALTER TABLE billing_categories
ADD CONSTRAINT check_extra_charge_exclusivity
CHECK (
  NOT (is_extra_charge = true AND include_in_work_order = true)
);

-- Create helper function to get display name for billing category
CREATE OR REPLACE FUNCTION get_billing_category_display_name(
  category_name TEXT,
  is_extra_charge BOOLEAN,
  archived_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF archived_at IS NOT NULL THEN
    RETURN category_name || ' (Archived)';
  ELSIF is_extra_charge = true THEN
    RETURN 'Extra Charges - ' || category_name;
  ELSE
    RETURN category_name;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_billing_category_display_name IS 
  'Returns the display name for a billing category based on its flags. Extra charge categories get "Extra Charges - " prefix, archived categories get " (Archived)" suffix.';
