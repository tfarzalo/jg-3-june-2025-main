-- =====================================================
-- FIX: Add Missing Columns to approval_tokens Table
-- =====================================================
-- This migration adds the decline/approval tracking columns
-- Run this BEFORE running FIX_PROCESS_DECLINE_TOKEN_FUNCTION.sql
-- =====================================================

-- Step 1: Check current table structure
SELECT 
  'Current approval_tokens columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'approval_tokens'
ORDER BY ordinal_position;

-- Step 2: Add missing columns to approval_tokens table
ALTER TABLE approval_tokens
ADD COLUMN IF NOT EXISTS decision VARCHAR(20) CHECK (decision IN ('approved', 'declined')),
ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Step 3: Create index for decision queries (improves performance)
CREATE INDEX IF NOT EXISTS idx_approval_tokens_decision 
ON approval_tokens(decision) 
WHERE decision IS NOT NULL;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN approval_tokens.decision IS 'Tracks whether the token was used for approval or decline';
COMMENT ON COLUMN approval_tokens.decision_at IS 'Timestamp when the approval/decline decision was made';
COMMENT ON COLUMN approval_tokens.decline_reason IS 'Optional reason provided when declining extra charges';

-- Step 5: Verify columns were added
SELECT 
  'Verification - approval_tokens columns after migration:' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'approval_tokens'
ORDER BY ordinal_position;

-- Step 6: Check if we have any tokens that need backfilling
SELECT 
  'Token statistics:' as info,
  COUNT(*) as total_tokens,
  COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used_tokens_no_decision,
  COUNT(CASE WHEN used_at IS NULL AND expires_at > NOW() THEN 1 END) as active_tokens,
  COUNT(CASE WHEN expires_at < NOW() AND used_at IS NULL THEN 1 END) as expired_unused_tokens
FROM approval_tokens;

-- Step 7: Optionally backfill existing used tokens as 'approved'
-- (Only run this if you have existing tokens that were used before this migration)
-- Uncomment to backfill:
/*
UPDATE approval_tokens
SET decision = 'approved',
    decision_at = used_at
WHERE used_at IS NOT NULL
  AND decision IS NULL;

-- Show how many were backfilled
SELECT 
  'Backfilled tokens:' as info,
  COUNT(*) as backfilled_count
FROM approval_tokens
WHERE decision = 'approved' AND decision_at IS NOT NULL;
*/

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 
  '✅ SUCCESS: approval_tokens table updated!' as status,
  'Columns added: decision, decision_at, decline_reason' as changes,
  'NEXT STEP: Run FIX_PROCESS_DECLINE_TOKEN_FUNCTION.sql' as next_action;
