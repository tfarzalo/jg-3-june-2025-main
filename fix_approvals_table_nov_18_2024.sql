-- Fix approvals table references - Remove old approvals table dependencies
-- Date: November 18, 2024
-- This fixes the error: "relation 'approvals' does not exist"

-- The system was refactored to use 'approval_tokens' table instead of 'approvals' table
-- This migration removes any lingering references to the old table

-- 1. Drop any policies that reference the old 'approvals' table (if they exist)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public can view approvals with valid token" ON approvals;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public can update approvals with valid token" ON approvals;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 2. Drop any indexes on the old approvals table (if they exist)
DO $$ 
BEGIN
    DROP INDEX IF EXISTS idx_approvals_token;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- 3. Drop the old approvals table if it exists
DROP TABLE IF EXISTS approvals CASCADE;

-- 4. Ensure approval_tokens table has proper structure
-- This should already exist from previous migrations, but let's verify key columns

DO $$ 
BEGIN
    -- Add any missing columns to approval_tokens if needed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'approval_tokens' AND column_name = 'used_at') THEN
        ALTER TABLE approval_tokens ADD COLUMN used_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'approval_tokens' AND column_name = 'expires_at') THEN
        ALTER TABLE approval_tokens ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NOT NULL;
    END IF;
END $$;

-- 5. Ensure RLS is enabled on approval_tokens
ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;

-- 6. Create/recreate proper policies for approval_tokens (anonymous access)
DROP POLICY IF EXISTS "Allow anonymous to read valid approval tokens" ON approval_tokens;
DROP POLICY IF EXISTS "Allow anonymous to update approval tokens" ON approval_tokens;

-- Allow anonymous users to SELECT approval tokens (for viewing approval page)
CREATE POLICY "Allow anonymous to read valid approval tokens"
ON approval_tokens
FOR SELECT
TO anon
USING (
    -- Token is not yet used
    used_at IS NULL
    -- Token is not expired
    AND expires_at > NOW()
);

-- Allow anonymous users to UPDATE approval tokens (for marking as approved)
CREATE POLICY "Allow anonymous to update approval tokens"
ON approval_tokens
FOR UPDATE
TO anon
USING (
    -- Token is not yet used
    used_at IS NULL
    -- Token is not expired
    AND expires_at > NOW()
)
WITH CHECK (
    -- Only allow updating used_at and approved_at columns
    used_at IS NOT NULL
);

-- 7. Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_approval_tokens_token 
ON approval_tokens (token) 
WHERE used_at IS NULL;

-- 8. Add helpful comment
COMMENT ON TABLE approval_tokens IS 'Stores one-time approval tokens for email approvals. Replaces the old "approvals" table.';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully removed approvals table references and configured approval_tokens table';
END $$;
