/*
  # Assignment decision tokens

  One-time tokens for subcontractor assignment accept/decline flows.
  - job_id + subcontractor_id scoped
  - token unique, expires in 7 days (default)
  - used_at/decision tracked for auditing
*/

CREATE TABLE IF NOT EXISTS assignment_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  sent_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  decision TEXT,
  decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_assignment_tokens_token ON assignment_tokens(token);
CREATE INDEX IF NOT EXISTS idx_assignment_tokens_job_sub ON assignment_tokens(job_id, subcontractor_id);

-- Allowed decision values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assignment_tokens_decision_valid'
      AND conrelid = 'assignment_tokens'::regclass
  ) THEN
    ALTER TABLE assignment_tokens
      ADD CONSTRAINT assignment_tokens_decision_valid
      CHECK (decision IS NULL OR decision IN ('accepted', 'declined'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE assignment_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone with a valid token to read it (for public decision page)
CREATE POLICY "assignment_tokens_select_valid"
  ON assignment_tokens
  FOR SELECT
  USING (
    used_at IS NULL
    AND expires_at > NOW()
  );

-- Allow authenticated users (admin/staff) to create tokens
CREATE POLICY "assignment_tokens_insert_auth"
  ON assignment_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow updating token to mark decision once (public page or authenticated)
CREATE POLICY "assignment_tokens_update_valid"
  ON assignment_tokens
  FOR UPDATE
  USING (
    used_at IS NULL
    AND expires_at > NOW()
  )
  WITH CHECK (
    used_at IS NOT NULL
    OR decision IS NOT NULL
  );

COMMENT ON TABLE assignment_tokens IS 'One-time tokens for subcontractor assignment accept/decline decisions.';
COMMENT ON COLUMN assignment_tokens.token IS 'Opaque token included in assignment email CTA.';
COMMENT ON COLUMN assignment_tokens.expires_at IS 'Defaults to 7 days after creation.';
COMMENT ON COLUMN assignment_tokens.decision IS 'Decision captured when token is used: accepted or declined.';
