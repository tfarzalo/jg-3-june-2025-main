import { supabase } from '../utils/supabase';

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  participants: string[];
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export async function startDM(otherUserId: string, subject?: string) {
  const { data, error } = await supabase.rpc('start_dm', { 
    other_user: otherUserId,
    conversation_subject: subject || null
  });
  if (error) throw new Error(`start_dm failed: ${error.message}`);
  if (!data) throw new Error('start_dm returned no conversation id');
  return data as string; // conversation_id
}

export async function postMessage(conversationId: string, body: string, attachments: any = {}) {
  const { data, error } = await supabase.rpc('post_message', {
    p_conversation: conversationId,
    p_body: body,
    p_attachments: attachments
  });
  if (error) throw new Error(`post_message failed: ${error.message}`);
  return data as string; // message_id
}

export async function markRead(conversationId: string, messageId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { error } = await supabase
    .from('message_reads')
    .upsert(
      { conversation_id: conversationId, message_id: messageId, user_id: user.id },
      { onConflict: 'message_id,user_id', ignoreDuplicates: true }
    );

  if (error) throw new Error(`mark_read failed: ${error.message}`);
}

/**
 * Get conversation messages
 */
export async function getConversationMessages(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return messages || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw new Error('Failed to fetch conversation messages');
  }
}

/**
 * Load older messages for infinite scroll
 */
export async function loadOlderMessages(
  conversationId: string,
  oldestLoadedAt: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldestLoadedAt)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch older messages: ${error.message}`);
    }

    return (messages || []).reverse(); // Reverse to maintain chronological order
  } catch (error) {
    console.error('Error loading older messages:', error);
    throw new Error('Failed to load older messages');
  }
}

/**
 * Get conversation participants using the compat view
 */
export async function getParticipants(conversationId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('conversations_compat')
    .select('participants')
    .eq('id', conversationId)
    .single();
  if (error) throw new Error(`fetch participants failed: ${error.message}`);
  return (data?.participants ?? []) as string[];
}

/**
 * Get conversation details
 */
export async function getConversation(
  conversationId: string
): Promise<Conversation | null> {
  try {
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch conversation: ${error.message}`);

    }

    return conversation as Conversation;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw new Error('Failed to fetch conversation details');
  }
}

