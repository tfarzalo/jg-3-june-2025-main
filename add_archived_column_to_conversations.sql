-- Add archived column to conversations table
-- This enables the archive functionality for conversations

-- Add the archived column with default value false
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Create an index for better performance when filtering by archived status
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations (archived);

-- Update any existing conversations to have archived = false (they should already be false by default)
UPDATE conversations SET archived = FALSE WHERE archived IS NULL;

-- Grant necessary permissions
GRANT UPDATE ON conversations TO authenticated;

-- Add comment to document the column
COMMENT ON COLUMN conversations.archived IS 'Indicates whether the conversation has been archived by the user';
