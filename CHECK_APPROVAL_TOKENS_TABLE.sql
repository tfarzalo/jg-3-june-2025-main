-- =====================================================
-- CHECK: Approval Tokens Table Schema
-- =====================================================
-- Verify the approval_tokens table has all required columns
-- =====================================================

-- 1. Check if table exists and view its structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'approval_tokens'
ORDER BY ordinal_position;

-- Expected columns:
-- - id (uuid)
-- - token (varchar/text)
-- - job_id (uuid)
-- - expires_at (timestamptz)
-- - created_at (timestamptz)
-- - used_at (timestamptz) - nullable
-- - decision (varchar/text) - NEW COLUMN, nullable
-- - decision_at (timestamptz) - NEW COLUMN, nullable
-- - decline_reason (text) - NEW COLUMN, nullable

-- 2. Check if the new columns exist (decision, decision_at, decline_reason)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'approval_tokens' AND column_name = 'decision'
    ) THEN '✅ decision column exists'
    ELSE '❌ decision column MISSING'
  END as decision_check,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'approval_tokens' AND column_name = 'decision_at'
    ) THEN '✅ decision_at column exists'
    ELSE '❌ decision_at column MISSING'
  END as decision_at_check,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'approval_tokens' AND column_name = 'decline_reason'
    ) THEN '✅ decline_reason column exists'
    ELSE '❌ decline_reason column MISSING'
  END as decline_reason_check;

-- 3. If columns are missing, add them:
-- Uncomment and run if any columns are missing:
/*
ALTER TABLE approval_tokens
ADD COLUMN IF NOT EXISTS decision VARCHAR(20) CHECK (decision IN ('approved', 'declined')),
ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Create index for decision queries
CREATE INDEX IF NOT EXISTS idx_approval_tokens_decision 
ON approval_tokens(decision) WHERE decision IS NOT NULL;
*/

-- 4. Check sample data
SELECT 
  COUNT(*) as total_tokens,
  COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used_tokens,
  COUNT(CASE WHEN decision = 'approved' THEN 1 END) as approved_tokens,
  COUNT(CASE WHEN decision = 'declined' THEN 1 END) as declined_tokens,
  COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_tokens
FROM approval_tokens;

-- 5. Show recent tokens
SELECT 
  token,
  job_id,
  created_at,
  expires_at,
  used_at,
  decision,
  decision_at,
  CASE 
    WHEN expires_at < NOW() THEN 'expired'
    WHEN used_at IS NOT NULL THEN 'used'
    ELSE 'active'
  END as status
FROM approval_tokens
ORDER BY created_at DESC
LIMIT 10;
