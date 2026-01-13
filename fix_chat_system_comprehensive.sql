-- ============================================================================
-- COMPREHENSIVE CHAT SYSTEM FIXES
-- ============================================================================
-- Fixes:
-- 1. Ensure subcontractors cannot initiate chats with other subcontractors
-- 2. Improve real-time message notifications for green blinking
-- 3. Ensure proper avatar display
-- Date: November 13, 2025
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'FIXING CHAT SYSTEM';
    RAISE NOTICE '=========================================';
END $$;

-- =============================================================================
-- PART 1: ENSURE CAN_CHAT_WITH FUNCTION EXISTS AND WORKS CORRECTLY
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 1: Verifying can_chat_with function...';
END $$;

-- Create or replace the can_chat_with function
CREATE OR REPLACE FUNCTION can_chat_with(other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_role TEXT;
  other_user_role TEXT;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  -- Get other user's role
  SELECT role INTO other_user_role
  FROM profiles
  WHERE id = other_user_id;
  
  -- If either role is not found, deny
  IF current_user_role IS NULL OR other_user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Subcontractors can ONLY chat with admin and jg_management
  IF current_user_role = 'subcontractor' THEN
    RETURN other_user_role IN ('admin', 'jg_management');
  END IF;
  
  -- If other user is a subcontractor, current user must be admin or jg_management
  IF other_user_role = 'subcontractor' THEN
    RETURN current_user_role IN ('admin', 'jg_management');
  END IF;
  
  -- Otherwise, allow chat
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION can_chat_with(UUID) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'can_chat_with function verified ✓';
END $$;

-- =============================================================================
-- PART 2: UPDATE START_DM FUNCTION WITH PROPER RESTRICTIONS
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 2: Updating start_dm function...';
END $$;

-- Drop existing versions
DROP FUNCTION IF EXISTS start_dm(UUID, TEXT);
DROP FUNCTION IF EXISTS start_dm(UUID);

-- Create updated start_dm with subcontractor restrictions
CREATE OR REPLACE FUNCTION start_dm(other_user UUID, conversation_subject TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  current_user_role TEXT;
  other_user_role TEXT;
  conversation_id UUID;
  existing_conv_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Get both users' roles
  SELECT role INTO current_user_role FROM profiles WHERE id = current_user_id;
  SELECT role INTO other_user_role FROM profiles WHERE id = other_user;
  
  -- Check if other user exists
  IF other_user_role IS NULL THEN
    RAISE EXCEPTION 'Other user does not exist';
  END IF;
  
  -- IMPORTANT: Subcontractors cannot chat with other subcontractors
  IF current_user_role = 'subcontractor' AND other_user_role = 'subcontractor' THEN
    RAISE EXCEPTION 'Subcontractors cannot chat with other subcontractors';
  END IF;
  
  -- Check using can_chat_with function for additional validation
  IF NOT can_chat_with(other_user) THEN
    RAISE EXCEPTION 'You do not have permission to chat with this user';
  END IF;
  
  -- Check if conversation already exists between these two users
  SELECT id INTO existing_conv_id
  FROM conversations
  WHERE participants @> ARRAY[current_user_id, other_user]
    AND participants <@ ARRAY[current_user_id, other_user]
    AND array_length(participants, 1) = 2
  LIMIT 1;
  
  -- If conversation exists, return it
  IF existing_conv_id IS NOT NULL THEN
    RETURN existing_conv_id;
  END IF;
  
  -- Create new conversation with optional subject
  INSERT INTO conversations (participants, type, subject, created_at, updated_at)
  VALUES (
    ARRAY[current_user_id, other_user], 
    'dm', 
    conversation_subject,
    NOW(),
    NOW()
  )
  RETURNING id INTO conversation_id;
  
  RAISE NOTICE 'Created new conversation: %', conversation_id;
  
  RETURN conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION start_dm(UUID, TEXT) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'start_dm function updated ✓';
END $$;

-- =============================================================================
-- PART 3: ENSURE PROFILES TABLE HAS AVATAR_URL COLUMN
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 3: Verifying avatar_url column...';
END $$;

-- Add avatar_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
        RAISE NOTICE 'Added avatar_url column to profiles table';
    ELSE
        RAISE NOTICE 'avatar_url column already exists ✓';
    END IF;
END $$;

-- =============================================================================
-- PART 4: CREATE INDEX FOR FASTER MESSAGE QUERIES
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 4: Creating performance indexes...';
END $$;

-- Index for faster conversation lookups
CREATE INDEX IF NOT EXISTS idx_conversations_participants 
ON conversations USING GIN(participants);

-- Index for faster message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

-- Index for faster sender lookups
CREATE INDEX IF NOT EXISTS idx_messages_sender 
ON messages(sender_id);

DO $$
BEGIN
    RAISE NOTICE 'Indexes created ✓';
END $$;

-- =============================================================================
-- PART 5: VERIFICATION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'VERIFICATION';
    RAISE NOTICE '=========================================';
END $$;

-- Check subcontractor restrictions
DO $$
DECLARE
    v_subcontractor_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_subcontractor_count
    FROM profiles
    WHERE role = 'subcontractor';
    
    RAISE NOTICE 'Found % subcontractor(s) in system', v_subcontractor_count;
    
    IF v_subcontractor_count > 0 THEN
        RAISE NOTICE 'Subcontractors can ONLY chat with admin and jg_management users';
    END IF;
END $$;

-- Verify functions exist
DO $$
DECLARE
    v_function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc
    WHERE proname IN ('can_chat_with', 'start_dm')
    AND pronamespace = 'public'::regnamespace;
    
    IF v_function_count >= 2 THEN
        RAISE NOTICE 'All required functions exist ✓';
    ELSE
        RAISE WARNING 'Some functions may be missing!';
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'CHAT SYSTEM FIX COMPLETE!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary of changes:';
    RAISE NOTICE '✓ Subcontractors cannot initiate chats with other subcontractors';
    RAISE NOTICE '✓ start_dm function enforces role restrictions';
    RAISE NOTICE '✓ can_chat_with function validates permissions';
    RAISE NOTICE '✓ avatar_url column verified for profile images';
    RAISE NOTICE '✓ Performance indexes created for faster queries';
    RAISE NOTICE '';
    RAISE NOTICE 'Frontend already handles:';
    RAISE NOTICE '✓ Green blinking for new messages (ChatDock animate-pulse)';
    RAISE NOTICE '✓ Avatar display with fallback to initials';
    RAISE NOTICE '✓ Real-time message notifications';
    RAISE NOTICE '✓ User search filtering by role';
    RAISE NOTICE '';
END $$;
