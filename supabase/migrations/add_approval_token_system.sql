-- Migration: Add Approval Token System for Public Access
-- Date: November 17, 2025
-- Purpose: Enable non-authenticated users to approve/reject jobs via secure tokens

-- =====================================================
-- STEP 1: Add Token Columns to Approvals Table
-- =====================================================

-- Add approval token column (unique UUID for each approval request)
ALTER TABLE approvals 
ADD COLUMN IF NOT EXISTS approval_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL;

-- Add token expiration timestamp (default 30 days from creation)
ALTER TABLE approvals 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days');

-- Add token used flag (prevent reuse)
ALTER TABLE approvals 
ADD COLUMN IF NOT EXISTS token_used BOOLEAN DEFAULT FALSE;

-- Add IP address logging for security
ALTER TABLE approvals 
ADD COLUMN IF NOT EXISTS approval_ip_address TEXT;

-- Add user agent logging
ALTER TABLE approvals 
ADD COLUMN IF NOT EXISTS approval_user_agent TEXT;

-- =====================================================
-- STEP 2: Create Index for Fast Token Lookups
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_approvals_token 
ON approvals (approval_token) 
WHERE token_used = FALSE AND token_expires_at > NOW();

-- =====================================================
-- STEP 3: Update RLS Policies for Public Access
-- =====================================================

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Public can view approvals with valid token" ON approvals;
DROP POLICY IF EXISTS "Public can update approvals with valid token" ON approvals;
DROP POLICY IF EXISTS "Public can view jobs via approval token" ON jobs;
DROP POLICY IF EXISTS "Public can view job images via approval token" ON job_images;

-- Policy 1: Allow public to SELECT approvals with valid, unexpired, unused token
CREATE POLICY "Public can view approvals with valid token"
ON approvals
FOR SELECT
USING (
  approval_token IS NOT NULL 
  AND token_used = FALSE 
  AND token_expires_at > NOW()
);

-- Policy 2: Allow public to UPDATE approval status with valid token
CREATE POLICY "Public can update approvals with valid token"
ON approvals
FOR UPDATE
USING (
  approval_token IS NOT NULL 
  AND token_used = FALSE 
  AND token_expires_at > NOW()
)
WITH CHECK (
  -- Only allow updating these specific columns
  approval_token = approval_token -- Token can't be changed
  AND (
    status IN ('approved', 'rejected') -- Can only set to these statuses
  )
);

-- Policy 3: Allow public to view jobs associated with valid approval tokens
CREATE POLICY "Public can view jobs via approval token"
ON jobs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM approvals 
    WHERE approvals.job_id = jobs.id 
      AND approvals.approval_token IS NOT NULL
      AND approvals.token_used = FALSE 
      AND approvals.token_expires_at > NOW()
  )
);

-- Policy 4: Allow public to view job images via valid approval token
CREATE POLICY "Public can view job images via approval token"
ON job_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM approvals 
    WHERE approvals.job_id = job_images.job_id 
      AND approvals.approval_token IS NOT NULL
      AND approvals.token_used = FALSE 
      AND approvals.token_expires_at > NOW()
  )
);

-- =====================================================
-- STEP 4: Create Helper Function for Token Validation
-- =====================================================

CREATE OR REPLACE FUNCTION validate_approval_token(token UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  approval_id UUID,
  job_id UUID,
  approval_type TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (
      a.approval_token IS NOT NULL 
      AND a.token_used = FALSE 
      AND a.token_expires_at > NOW()
      AND a.status = 'pending'
    ) as is_valid,
    a.id as approval_id,
    a.job_id,
    a.approval_type,
    a.status,
    a.token_expires_at as expires_at
  FROM approvals a
  WHERE a.approval_token = token;
END;
$$;

-- =====================================================
-- STEP 5: Create Function to Process Public Approval
-- =====================================================

CREATE OR REPLACE FUNCTION process_public_approval(
  token UUID,
  new_status TEXT,
  ip_addr TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approval_id UUID;
  v_job_id UUID;
  v_is_valid BOOLEAN;
  v_result JSON;
BEGIN
  -- Validate token
  SELECT 
    (approval_token IS NOT NULL 
     AND token_used = FALSE 
     AND token_expires_at > NOW()
     AND status = 'pending'),
    id,
    job_id
  INTO v_is_valid, v_approval_id, v_job_id
  FROM approvals
  WHERE approval_token = token;

  -- Check if token is valid
  IF NOT v_is_valid OR v_approval_id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Invalid, expired, or already used token'
    );
  END IF;

  -- Check if status is valid
  IF new_status NOT IN ('approved', 'rejected') THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Invalid status. Must be approved or rejected'
    );
  END IF;

  -- Update the approval
  UPDATE approvals
  SET 
    status = new_status,
    token_used = TRUE,
    approved_at = CASE WHEN new_status = 'approved' THEN NOW() ELSE NULL END,
    rejected_at = CASE WHEN new_status = 'rejected' THEN NOW() ELSE NULL END,
    approval_ip_address = ip_addr,
    approval_user_agent = user_agent
  WHERE id = v_approval_id;

  -- Return success
  v_result := json_build_object(
    'success', TRUE,
    'approval_id', v_approval_id,
    'job_id', v_job_id,
    'status', new_status
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- STEP 6: Update Existing Approvals with Tokens
-- =====================================================

-- Generate tokens for existing approvals that don't have them
UPDATE approvals 
SET 
  approval_token = gen_random_uuid(),
  token_expires_at = COALESCE(token_expires_at, NOW() + INTERVAL '30 days')
WHERE approval_token IS NULL;

-- =====================================================
-- STEP 7: Add Trigger to Auto-Generate Tokens
-- =====================================================

CREATE OR REPLACE FUNCTION generate_approval_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approval_token IS NULL THEN
    NEW.approval_token := gen_random_uuid();
  END IF;
  
  IF NEW.token_expires_at IS NULL THEN
    NEW.token_expires_at := NOW() + INTERVAL '30 days';
  END IF;
  
  IF NEW.token_used IS NULL THEN
    NEW.token_used := FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_approval_token ON approvals;

CREATE TRIGGER trg_generate_approval_token
BEFORE INSERT ON approvals
FOR EACH ROW
EXECUTE FUNCTION generate_approval_token();

-- =====================================================
-- STEP 8: Grant Public Access to Required Tables
-- =====================================================

-- Allow anonymous users to read from these tables via RLS policies
GRANT SELECT ON approvals TO anon;
GRANT UPDATE ON approvals TO anon;
GRANT SELECT ON jobs TO anon;
GRANT SELECT ON job_images TO anon;
GRANT SELECT ON properties TO anon;
GRANT SELECT ON profiles TO anon;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION validate_approval_token TO anon;
GRANT EXECUTE ON FUNCTION process_public_approval TO anon;

-- =====================================================
-- VERIFICATION QUERIES (commented out - for testing)
-- =====================================================

-- To test token generation:
-- SELECT approval_token, token_expires_at, token_used FROM approvals LIMIT 5;

-- To test token validation:
-- SELECT * FROM validate_approval_token('your-token-here');

-- To test public approval:
-- SELECT * FROM process_public_approval('your-token-here', 'approved', '127.0.0.1', 'Test User Agent');

COMMENT ON COLUMN approvals.approval_token IS 'Unique token for public approval access without authentication';
COMMENT ON COLUMN approvals.token_expires_at IS 'Expiration timestamp for the approval token (default 30 days)';
COMMENT ON COLUMN approvals.token_used IS 'Flag to prevent token reuse after approval/rejection';
COMMENT ON FUNCTION validate_approval_token IS 'Validates an approval token and returns approval details';
COMMENT ON FUNCTION process_public_approval IS 'Processes approval/rejection via public token without authentication';
