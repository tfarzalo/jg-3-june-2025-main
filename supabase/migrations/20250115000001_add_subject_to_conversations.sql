-- Add subject field to conversations table
-- This migration adds a subject field to allow users to title their conversations

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN conversations.subject IS 'Optional subject/title for the conversation to distinguish between multiple chats with the same user';
