-- ============================================
-- QUICK FIX FOR CONSTRAINT VIOLATION
-- Run this NOW to fix the immediate error
-- ============================================

-- This script is ONLY needed if columns already exist
-- If columns don't exist yet, skip this and go straight to main migration

-- Check if columns exist first
DO $$ 
BEGIN
  -- Only run if is_extra_charge column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing_categories' 
    AND column_name = 'is_extra_charge'
  ) THEN
    -- Fix the constraint violation
    UPDATE billing_categories
    SET include_in_work_order = false
    WHERE is_extra_charge = true 
      AND include_in_work_order = true;
      
    RAISE NOTICE 'Fixed % rows with constraint violations', 
      (SELECT COUNT(*) FROM billing_categories WHERE is_extra_charge = true);
  ELSE
    RAISE NOTICE 'Column is_extra_charge does not exist yet. Skip this script and run main migration.';
  END IF;
END $$;

-- Verify no violations remain (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing_categories' 
    AND column_name = 'is_extra_charge'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM billing_categories 
      WHERE is_extra_charge = true AND include_in_work_order = true
    ) THEN
      RAISE EXCEPTION 'Still have constraint violations!';
    ELSE
      RAISE NOTICE '✅ No constraint violations found';
    END IF;
  END IF;
END $$;
