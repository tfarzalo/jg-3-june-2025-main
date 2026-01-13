-- Complete Chat Functions Fix
-- This script ensures all chat functionality is properly set up

-- First, ensure the conversations table has the subject column
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS subject TEXT;

-- Create or replace the can_chat_with function
CREATE OR REPLACE FUNCTION can_chat_with(other_user UUID)
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
  WHERE id = other_user;
  
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
  
  -- Default: allow chat
  RETURN TRUE;
END;
$$;

-- Drop existing start_dm function if it exists
DROP FUNCTION IF EXISTS start_dm(UUID);
DROP FUNCTION IF EXISTS start_dm(UUID, TEXT);

-- Create the start_dm function with subject support
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

-- Create or replace the post_message function
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION start_dm(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION post_message(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION can_chat_with(UUID) TO authenticated;

-- Ensure conversations table has proper structure
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL,
  type TEXT DEFAULT 'dm',
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure messages table has proper structure
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure message_reads table has proper structure
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, message_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversations
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
CREATE POLICY "Users can view conversations they participate in" ON conversations
  FOR SELECT USING (
    auth.uid() = ANY(participants)
  );

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = ANY(participants)
  );

DROP POLICY IF EXISTS "Users can update conversations they participate in" ON conversations;
CREATE POLICY "Users can update conversations they participate in" ON conversations
  FOR UPDATE USING (
    auth.uid() = ANY(participants)
  );

-- Create RLS policies for messages
DROP POLICY IF EXISTS "Users can view messages in conversations they participate in" ON messages;
CREATE POLICY "Users can view messages in conversations they participate in" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id 
      AND auth.uid() = ANY(participants)
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in conversations they participate in" ON messages;
CREATE POLICY "Users can insert messages in conversations they participate in" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id 
      AND auth.uid() = ANY(participants)
    )
  );

-- Create RLS policies for message_reads
DROP POLICY IF EXISTS "Users can view their own read receipts" ON message_reads;
CREATE POLICY "Users can view their own read receipts" ON message_reads
  FOR SELECT USING (
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own read receipts" ON message_reads;
CREATE POLICY "Users can insert their own read receipts" ON message_reads
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
CREATE INDEX IF NOT EXISTS idx_message_reads_conversation_user ON message_reads (conversation_id, user_id);

-- Create function to update conversation updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update conversation timestamp when messages are inserted
DROP TRIGGER IF EXISTS update_conversation_timestamp_trigger ON messages;
CREATE TRIGGER update_conversation_timestamp_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Grant necessary permissions
GRANT ALL ON conversations TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON message_reads TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Enable Realtime for the tables (only if not already added)
DO $$
BEGIN
    -- Add conversations table to realtime publication if not already there
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    END IF;
    
    -- Add messages table to realtime publication if not already there
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
    
    -- Add message_reads table to realtime publication if not already there
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'message_reads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
    END IF;
END $$;
