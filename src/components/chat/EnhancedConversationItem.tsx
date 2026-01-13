import React, { useState } from 'react';
import { Archive, ArchiveRestore, Trash2, MoreVertical, Clock } from 'lucide-react';
import { getAvatarProps } from '../../utils/avatarUtils';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url?: string | null;
  last_seen?: string;
  is_online?: boolean;
}

interface Conversation {
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

interface EnhancedConversationItemProps {
  conversation: Conversation;
  conversationUser: User | null;
  currentUserId: string;
  isSelected?: boolean;
  onSelect: (conversation: Conversation) => void;
  onArchive: (conversationId: string) => void;
  onUnarchive: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
  onRestore?: (conversationId: string) => void;
  isDeleted?: boolean;
  lastMessage?: string;
  unreadCount?: number;
}

export function EnhancedConversationItem({
  conversation,
  conversationUser,
  currentUserId,
  isSelected = false,
  onSelect,
  onArchive,
  onUnarchive,
  onDelete,
  onRestore,
  isDeleted = false,
  lastMessage,
  unreadCount = 0
}: EnhancedConversationItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getUserDisplayName = (user: User | null) => {
    if (!user) return 'Unknown User';
    return user.full_name || user.email;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'jg_management':
        return 'JG Management';
      case 'subcontractor':
        return 'Subcontractor';
      default:
        return role;
    }
  };

  const avatarProps = conversationUser ? getAvatarProps(conversationUser) : {
    avatarUrl: null,
    initials: 'U'
  };

  return (
    <div
      className={`group relative flex items-center space-x-3 p-4 rounded-xl cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
      } ${isDeleted ? 'opacity-60' : ''}`}
      onClick={() => !showActions && onSelect(conversation)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar with status indicator */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
          {avatarProps.avatarUrl ? (
            <img
              src={avatarProps.avatarUrl}
              alt={getUserDisplayName(conversationUser)}
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `<span class="text-lg font-semibold text-gray-600 dark:text-gray-300">${avatarProps.initials}</span>`;
                }
              }}
            />
          ) : (
            <span className="text-lg font-semibold text-gray-600 dark:text-gray-300">
              {avatarProps.initials}
            </span>
          )}
        </div>
        
        {/* Online status indicator */}
        {conversationUser?.is_online && !isDeleted && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
        )}
        
        {/* Unread count indicator */}
        {unreadCount > 0 && !isDeleted && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </div>

      {/* Conversation details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold text-sm truncate ${
              isSelected 
                ? 'text-blue-900 dark:text-blue-100' 
                : 'text-gray-900 dark:text-white'
            }`}>
              {getUserDisplayName(conversationUser)}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {getRoleLabel(conversationUser?.role || '')}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatTime(conversation.updated_at)}
            </span>
            {isDeleted && (
              <Clock className="w-3 h-3 text-gray-400" />
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
            {conversation.subject || 'No subject'}
          </p>
          {conversation.archived && !isDeleted && (
            <Archive className="w-3 h-3 text-orange-500" />
          )}
        </div>
        
        {lastMessage && (
          <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">
            {lastMessage}
          </p>
        )}
      </div>

      {/* Action buttons - show on hover or when selected */}
      {(isHovered || isSelected) && !showActions && (
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(true);
            }}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Expanded action menu */}
      {showActions && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-10">
          <div className="flex flex-col space-y-1">
            {isDeleted ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore?.(conversation.id);
                    setShowActions(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                >
                  <ArchiveRestore className="w-4 h-4" />
                  <span>Restore</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conversation.id);
                    setShowActions(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Forever</span>
                </button>
              </>
            ) : conversation.archived ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnarchive(conversation.id);
                    setShowActions(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                >
                  <ArchiveRestore className="w-4 h-4" />
                  <span>Unarchive</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conversation.id);
                    setShowActions(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(conversation.id);
                    setShowActions(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archive</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conversation.id);
                    setShowActions(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close actions */}
      {showActions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActions(false)}
        />
      )}
    </div>
  );
}
