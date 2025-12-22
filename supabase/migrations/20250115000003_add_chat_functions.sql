-- Add chat functions for messaging functionality
-- This migration adds the necessary RPC functions for starting DMs and posting messages

-- Function to start a direct message conversation
CREATE OR REPLACE FUNCTION start_dm(other_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  conversation_id UUID;
  existing_conv_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if other user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user) THEN
    RAISE EXCEPTION 'Other user does not exist';
  END IF;
  
  -- Check if conversation already exists between these two users
  SELECT id INTO existing_conv_id
  FROM conversations
  WHERE participants @> ARRAY[current_user_id, other_user]
    AND array_length(participants, 1) = 2
  LIMIT 1;
  
  -- If conversation exists, return it
  IF existing_conv_id IS NOT NULL THEN
    RETURN existing_conv_id;
  END IF;
  
  -- Create new conversation
  INSERT INTO conversations (participants, type)
  VALUES (ARRAY[current_user_id, other_user], 'dm')
  RETURNING id INTO conversation_id;
  
  RETURN conversation_id;
END;
$$;

-- Function to post a message
CREATE OR REPLACE FUNCTION post_message(
  p_conversation UUID,
  p_body TEXT,
  p_attachments JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  message_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user is participant in conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = p_conversation 
    AND current_user_id = ANY(participants)
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Insert message
  INSERT INTO messages (conversation_id, sender_id, body, attachments)
  VALUES (p_conversation, current_user_id, p_body, p_attachments)
  RETURNING id INTO message_id;
  
  -- Update conversation's updated_at timestamp
  UPDATE conversations 
  SET updated_at = NOW()
  WHERE id = p_conversation;
  
  RETURN message_id;
END;
$$;

-- Function to check if user can chat with another user (role restrictions)
DROP FUNCTION IF EXISTS can_chat_with(UUID);
CREATE OR REPLACE FUNCTION can_chat_with(other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  current_user_role TEXT;
  other_user_role TEXT;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM profiles
  WHERE id = current_user_id;
  
  -- Get other user's role
  SELECT role INTO other_user_role
  FROM profiles
  WHERE id = other_user_id;
  
  -- If either role is null, deny
  IF current_user_role IS NULL OR other_user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Subcontractors can only chat with admin and jg_management
  IF current_user_role = 'subcontractor' THEN
    RETURN other_user_role IN ('admin', 'jg_management');
  END IF;
  
  -- Admin and jg_management can chat with anyone
  IF current_user_role IN ('admin', 'jg_management') THEN
    RETURN TRUE;
  END IF;
  
  -- If the other user is a subcontractor, the current user must be an admin or jg_management
  IF other_user_role = 'subcontractor' THEN
    RETURN current_user_role IN ('admin', 'jg_management');
  END IF;

  -- Default: allow chat
  RETURN TRUE;
END;
$$;

-- Update start_dm function to include role restrictions
CREATE OR REPLACE FUNCTION start_dm(other_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  conversation_id UUID;
  existing_conv_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if other user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user) THEN
    RAISE EXCEPTION 'Other user does not exist';
  END IF;
  
  -- Check if current user can chat with other user
  IF NOT can_chat_with(other_user) THEN
    RAISE EXCEPTION 'You do not have permission to chat with this user.';
  END IF;
  
  -- Check if conversation already exists between these two users
  SELECT id INTO existing_conv_id
  FROM conversations
  WHERE participants @> ARRAY[current_user_id, other_user]
    AND array_length(participants, 1) = 2
  LIMIT 1;
  
  -- If conversation exists, return it
  IF existing_conv_id IS NOT NULL THEN
    RETURN existing_conv_id;
  END IF;
  
  -- Create new conversation
  INSERT INTO conversations (participants, type)
  VALUES (ARRAY[current_user_id, other_user], 'dm')
  RETURNING id INTO conversation_id;
  
  RETURN conversation_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION start_dm(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION post_message(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION can_chat_with(UUID) TO authenticated;
