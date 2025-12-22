import React from 'react';
import { ConversationSummary, getParticipantProfiles, User } from '../../services/roster';
import { UserRow } from './UserRow';
import { useConversationList } from '../../hooks/useConversationList';
import { useState, useEffect } from 'react';

interface ConversationListProps {
  currentUserId: string;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationList({ currentUserId, onSelectConversation }: ConversationListProps) {
  const { conversations, loading } = useConversationList(currentUserId);
  const [userProfiles, setUserProfiles] = useState<Record<string, User>>({});

  useEffect(() => {
    const loadUserProfiles = async () => {
      if (conversations.length === 0) return;

      try {
        const userIds = conversations.map(conv => conv.other_id);
        const profiles = await getParticipantProfiles(userIds);
        
        const profileMap: Record<string, User> = {};
        profiles.forEach(profile => {
          profileMap[profile.id] = profile;
        });
        
        setUserProfiles(profileMap);
      } catch (error) {
        console.error('Error loading user profiles:', error);
      }
    };

    loadUserProfiles();
  }, [conversations]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Start chatting with someone to see them here</p>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 px-3">
        Recent Conversations
      </h3>
      <div className="space-y-1">
        {conversations.map((conversation) => {
          const user = userProfiles[conversation.other_id];
          if (!user) return null;

          return (
            <UserRow
              key={conversation.conversation_id}
              user={user}
              unread={conversation.unread}
              lastMessage={conversation.last_message}
              onClick={() => onSelectConversation(conversation.conversation_id)}
            />
          );
        })}
      </div>
    </div>
  );
}
