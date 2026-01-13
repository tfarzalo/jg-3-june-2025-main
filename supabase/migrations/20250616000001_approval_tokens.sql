-- Create approval tokens table for one-click email approvals
CREATE TABLE IF NOT EXISTS approval_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  approval_type VARCHAR(50) NOT NULL DEFAULT 'extra_charges',
  extra_charges_data JSONB,
  approver_email VARCHAR(255) NOT NULL,
  approver_name VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_approval_tokens_token ON approval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_job_id ON approval_tokens(job_id);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_expires_at ON approval_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_used_at ON approval_tokens(used_at);

-- Enable RLS
ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for approval page validation)
CREATE POLICY "Anyone can read valid approval tokens"
  ON approval_tokens
  FOR SELECT
  USING (
    used_at IS NULL 
    AND expires_at > NOW()
  );

CREATE POLICY "Authenticated users can create approval tokens"
  ON approval_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update approval tokens to mark as used"
  ON approval_tokens
  FOR UPDATE
  USING (
    used_at IS NULL 
    AND expires_at > NOW()
  )
  WITH CHECK (
    used_at IS NOT NULL
  );

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_approval_tokens()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM approval_tokens 
  WHERE expires_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Create a scheduled job to cleanup expired tokens (optional)
-- This would need to be set up in your Supabase dashboard or via pg_cron extension
