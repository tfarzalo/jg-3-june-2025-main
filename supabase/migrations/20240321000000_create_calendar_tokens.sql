-- Create calendar_tokens table
CREATE TABLE IF NOT EXISTS calendar_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own tokens
CREATE POLICY "Users can read their own calendar tokens"
  ON calendar_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own tokens
CREATE POLICY "Users can insert their own calendar tokens"
  ON calendar_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own tokens
CREATE POLICY "Users can update their own calendar tokens"
  ON calendar_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_token ON calendar_tokens(token); 