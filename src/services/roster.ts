import { supabase } from '@/utils/supabase';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  avatar_url?: string;
}

export interface ConversationSummary {
  conversation_id: string;
  other_id: string;
  updated_at: string;
  last_message?: string;
  unread: number;
}

/**
 * List users based on current user's role
 */
export async function listUsersForRole(
  currentUserId: string, 
  role: 'admin' | 'jg_management' | 'subcontractor' | string
): Promise<User[]> {
  try {
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .neq('id', currentUserId);

    // Apply role restrictions for subcontractors
    if (role === 'subcontractor') {
      query = query.in('role', ['admin', 'jg_management']);
    }
    // No extra filter for other roles - they can see everyone

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch users: ${error.message}`);
    
    return data || [];
  } catch (error) {
    console.error('Error listing users for role:', error);
    throw new Error('Failed to list users');
  }
}

/**
 * List current user's DMs with conversation details
 */
export async function listMyDMs(currentUserId: string): Promise<ConversationSummary[]> {
  try {
    // 1. Get conversation IDs where current user is a participant
    const { data: participantRows, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUserId);

    if (participantError) throw new Error(`Failed to fetch conversations: ${participantError.message}`);
    if (!participantRows || participantRows.length === 0) return [];

    const conversationIds = participantRows.map(row => row.conversation_id);

    // 2. Get conversation details from conversations_compat
    const { data: conversations, error: convError } = await supabase
      .from('conversations_compat')
      .select('id, participants, updated_at')
      .in('id', conversationIds);

    if (convError) throw new Error(`Failed to fetch conversation details: ${convError.message}`);

    // 3. Build conversation summaries
    const summaries: ConversationSummary[] = [];
    
    for (const conv of conversations || []) {
      // Find the "other" participant (not current user)
      const otherId = conv.participants.find(id => id !== currentUserId);
      if (!otherId) continue;

      // 4. Get last message
      const { data: lastMessage, error: msgError } = await supabase
        .from('messages')
        .select('body, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // 5. Get unread count (simplified - count messages not in message_reads)
      const { count: unreadCount, error: unreadError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .not('id', 'in', `(
          select message_id from message_reads 
          where conversation_id = '${conv.id}' and user_id = '${currentUserId}'
        )`);

      const unread = unreadError ? 0 : (unreadCount || 0);

      summaries.push({
        conversation_id: conv.id,
        other_id: otherId,
        updated_at: conv.updated_at,
        last_message: lastMessage?.body || '',
        unread
      });
    }

    // Sort by updated_at desc (most recent first)
    return summaries.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } catch (error) {
    console.error('Error listing DMs:', error);
    throw new Error('Failed to list conversations');
  }
}

/**
 * Get conversation title for display
 */
export async function getConversationTitle(
  conversationId: string, 
  currentUserId: string
): Promise<string> {
  try {
    // Get participants from conversations_compat
    const { data: convData, error: convError } = await supabase
      .from('conversations_compat')
      .select('participants')
      .eq('id', conversationId)
      .single();

    if (convError) throw new Error(`Failed to fetch conversation: ${convError.message}`);
    if (!convData?.participants) return 'Unknown Conversation';

    // Find the "other" participant
    const otherId = convData.participants.find(id => id !== currentUserId);
    if (!otherId) return 'Unknown Conversation';

    // Get profile for the other participant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', otherId)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);

    // Return display name: full_name || email || short uuid
    return profile?.full_name || profile?.email || otherId.slice(0, 8);
  } catch (error) {
    console.error('Error getting conversation title:', error);
    return 'Unknown Conversation';
  }
}

/**
 * Get participant profiles by IDs
 */
export async function getParticipantProfiles(participantIds: string[]): Promise<User[]> {
  if (participantIds.length === 0) return [];
  
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .in('id', participantIds);

    if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
    return profiles || [];
  } catch (error) {
    console.error('Error fetching participant profiles:', error);
    throw new Error('Failed to fetch participant profiles');
  }
}
