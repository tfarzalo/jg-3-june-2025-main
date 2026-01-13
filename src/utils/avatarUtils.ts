/**
 * Avatar utility functions for handling user avatars
 * Ensures proper avatar display with fallbacks
 */

import { supabase } from './supabase';

/**
 * Get the full avatar URL for a user
 * @param avatarUrl - The avatar URL from the database (can be relative or full URL)
 * @returns Full avatar URL or null if no avatar
 */
export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  
  // If it's already a full URL, return as is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  
  // If it's a relative path, construct the full URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/avatars/${avatarUrl}`;
  }
  
  return null;
}

/**
 * Get user initials for avatar fallback
 * @param user - User object with full_name or email
 * @returns User initials (max 2 characters)
 */
export function getUserInitials(user: { full_name?: string | null; email?: string }): string {
  const name = user.full_name || user.email || 'U';
  const words = name.trim().split(' ');
  
  if (words.length >= 2) {
    // Use first letter of first and last name
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  } else {
    // Use first two letters of the name/email
    return name.substring(0, 2).toUpperCase();
  }
}

/**
 * Get avatar display props for a user
 * @param user - User object with avatar_url, full_name, and email
 * @returns Object with avatarUrl and initials for display
 */
export function getAvatarProps(user: { 
  avatar_url?: string | null; 
  full_name?: string | null; 
  email?: string; 
}) {
  const avatarUrl = getAvatarUrl(user.avatar_url);
  const initials = getUserInitials(user);
  
  return {
    avatarUrl,
    initials,
    hasAvatar: !!avatarUrl
  };
}

/**
 * Upload avatar for current user
 * @param file - File to upload
 * @param userId - User ID (defaults to current user)
 * @returns Promise with upload result
 */
export async function uploadAvatar(file: File, userId?: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = userId || user?.id;
    
    if (!currentUserId) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Create file path: userId/filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUserId}/avatar.${fileExt}`;
    
    // Upload file to storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: fileName })
      .eq('id', currentUserId);
    
    if (updateError) {
      return { success: false, error: updateError.message };
    }
    
    return { 
      success: true, 
      url: getAvatarUrl(fileName) 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

/**
 * Delete avatar for current user
 * @param userId - User ID (defaults to current user)
 * @returns Promise with deletion result
 */
export async function deleteAvatar(userId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = userId || user?.id;
    
    if (!currentUserId) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get current avatar URL
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', currentUserId)
      .single();
    
    if (fetchError || !profile?.avatar_url) {
      return { success: false, error: 'No avatar to delete' };
    }
    
    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove([profile.avatar_url]);
    
    if (deleteError) {
      return { success: false, error: deleteError.message };
    }
    
    // Update profile to remove avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', currentUserId);
    
    if (updateError) {
      return { success: false, error: updateError.message };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Deletion failed' 
    };
  }
}
