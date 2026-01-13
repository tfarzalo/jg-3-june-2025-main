-- Add archived field to conversations table
-- This migration adds an archived field to allow users to archive conversations

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add comment to explain the field
COMMENT ON COLUMN conversations.archived IS 'Whether the conversation has been archived by the user';

-- Create index for better performance when filtering archived conversations
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations (archived);

-- Update the RLS policy to include archived conversations
-- Users should be able to see their archived conversations
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
CREATE POLICY "Users can view conversations they participate in" ON conversations
  FOR SELECT USING (
    auth.uid() = ANY(participants)
  );
