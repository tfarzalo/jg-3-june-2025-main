-- Enhance messaging system with deletion functionality
-- This migration adds soft delete capabilities and improved conversation management

-- Add soft delete columns to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations (deleted_at);
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_by ON conversations (deleted_by);

-- Add comments to document the new columns
COMMENT ON COLUMN conversations.deleted_at IS 'Timestamp when conversation was soft deleted by a user';
COMMENT ON COLUMN conversations.deleted_by IS 'User who deleted the conversation';

-- Function to soft delete a conversation (user can delete their own conversations)
CREATE OR REPLACE FUNCTION delete_conversation(conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user is participant in the conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = conversation_id 
    AND current_user_id = ANY(participants)
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Soft delete the conversation
  UPDATE conversations 
  SET deleted_at = NOW(), deleted_by = current_user_id
  WHERE id = conversation_id;
  
  RETURN TRUE;
END;
$$;

-- Function to restore a soft-deleted conversation
CREATE OR REPLACE FUNCTION restore_conversation(conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user is participant in the conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = conversation_id 
    AND current_user_id = ANY(participants)
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Restore the conversation
  UPDATE conversations 
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = conversation_id;
  
  RETURN TRUE;
END;
$$;

-- Function to permanently delete a conversation (admin only)
CREATE OR REPLACE FUNCTION permanently_delete_conversation(conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  user_role TEXT;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user is admin
  SELECT role INTO user_role FROM profiles WHERE id = current_user_id;
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can permanently delete conversations';
  END IF;
  
  -- Permanently delete the conversation (CASCADE will handle messages)
  DELETE FROM conversations WHERE id = conversation_id;
  
  RETURN TRUE;
END;
$$;

-- Function to get conversations with proper filtering (excludes soft-deleted)
CREATE OR REPLACE FUNCTION get_user_conversations(user_id UUID, include_archived BOOLEAN DEFAULT FALSE)
RETURNS TABLE (
  id UUID,
  participants UUID[],
  type TEXT,
  subject TEXT,
  archived BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.participants,
    c.type,
    c.subject,
    c.archived,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    c.deleted_by
  FROM conversations c
  WHERE 
    user_id = ANY(c.participants)
    AND c.deleted_at IS NULL  -- Exclude soft-deleted conversations
    AND (include_archived = TRUE OR c.archived = FALSE);
END;
$$;

-- Function to get deleted conversations for a user
CREATE OR REPLACE FUNCTION get_deleted_conversations(user_id UUID)
RETURNS TABLE (
  id UUID,
  participants UUID[],
  type TEXT,
  subject TEXT,
  archived BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.participants,
    c.type,
    c.subject,
    c.archived,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    c.deleted_by
  FROM conversations c
  WHERE 
    user_id = ANY(c.participants)
    AND c.deleted_at IS NOT NULL;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION delete_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION permanently_delete_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deleted_conversations(UUID) TO authenticated;

-- Update RLS policies to handle soft-deleted conversations
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
CREATE POLICY "Users can view conversations they participate in" ON conversations
  FOR SELECT USING (
    auth.uid() = ANY(participants)
    AND deleted_at IS NULL  -- Only show non-deleted conversations by default
  );

-- Add policy for viewing deleted conversations (for restore functionality)
CREATE POLICY "Users can view their deleted conversations" ON conversations
  FOR SELECT USING (
    auth.uid() = ANY(participants)
    AND deleted_at IS NOT NULL
    AND deleted_by = auth.uid()  -- Only see conversations they deleted
  );
