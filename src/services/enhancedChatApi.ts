import { supabase } from '../utils/supabase';

export interface Conversation {
  id: string;
  participants: string[];
  type: string;
  subject?: string;
  archived?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface DeletedConversation extends Conversation {
  deleted_at: string;
  deleted_by: string;
}

/**
 * Enhanced Chat API with deletion and improved functionality
 */
export class EnhancedChatApi {
  /**
   * Get user conversations with optional archived filter
   */
  static async getUserConversations(userId: string, includeArchived: boolean = false): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_conversations', {
        user_id: userId,
        include_archived: includeArchived
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      throw error;
    }
  }

  /**
   * Get deleted conversations for a user
   */
  static async getDeletedConversations(userId: string): Promise<DeletedConversation[]> {
    try {
      const { data, error } = await supabase.rpc('get_deleted_conversations', {
        user_id: userId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching deleted conversations:', error);
      throw error;
    }
  }

  /**
   * Soft delete a conversation
   */
  static async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('delete_conversation', {
        conversation_id: conversationId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted conversation
   */
  static async restoreConversation(conversationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('restore_conversation', {
        conversation_id: conversationId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error restoring conversation:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a conversation (admin only)
   */
  static async permanentlyDeleteConversation(conversationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('permanently_delete_conversation', {
        conversation_id: conversationId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error permanently deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Archive a conversation
   */
  static async archiveConversation(conversationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          archived: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error archiving conversation:', error);
      throw error;
    }
  }

  /**
   * Unarchive a conversation
   */
  static async unarchiveConversation(conversationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          archived: false, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
      throw error;
    }
  }

  /**
   * Bulk archive multiple conversations
   */
  static async bulkArchiveConversations(conversationIds: string[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          archived: true, 
          updated_at: new Date().toISOString() 
        })
        .in('id', conversationIds);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error bulk archiving conversations:', error);
      throw error;
    }
  }

  /**
   * Bulk delete multiple conversations
   */
  static async bulkDeleteConversations(conversationIds: string[]): Promise<boolean> {
    try {
      // Use a transaction-like approach by calling delete for each conversation
      const promises = conversationIds.map(id => this.deleteConversation(id));
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Error bulk deleting conversations:', error);
      throw error;
    }
  }

  /**
   * Search conversations by subject or participant name
   */
  static async searchConversations(userId: string, query: string): Promise<Conversation[]> {
    try {
      // Get all conversations for the user
      const conversations = await this.getUserConversations(userId, true);
      
      // Filter by search query
      const filtered = conversations.filter(conv => {
        const subjectMatch = conv.subject?.toLowerCase().includes(query.toLowerCase());
        // Note: In a real implementation, you'd want to join with profiles to search by name
        return subjectMatch;
      });

      return filtered;
    } catch (error) {
      console.error('Error searching conversations:', error);
      throw error;
    }
  }
}
