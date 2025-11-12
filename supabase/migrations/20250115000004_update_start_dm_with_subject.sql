-- Update start_dm function to support subject parameter
-- This migration updates the start_dm function to accept an optional subject parameter

-- Drop the existing function
DROP FUNCTION IF EXISTS start_dm(UUID);

-- Create updated function with subject support
CREATE OR REPLACE FUNCTION start_dm(other_user UUID, conversation_subject TEXT DEFAULT NULL)
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
    RAISE EXCEPTION 'Subcontractors cannot chat with other subcontractors';
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
  
  -- Create new conversation with optional subject
  INSERT INTO conversations (participants, type, subject)
  VALUES (ARRAY[current_user_id, other_user], 'dm', conversation_subject)
  RETURNING id INTO conversation_id;
  
  RETURN conversation_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION start_dm(UUID, TEXT) TO authenticated;
