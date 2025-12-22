import { useAuth } from '@/contexts/AuthProvider';

/**
 * Hook to get the current user ID
 * @param overrideUserId - Optional override user ID for testing or specific use cases
 * @returns The current user ID or null if not authenticated
 */
export function useCurrentUserId(overrideUserId?: string): string | null {
  const { user } = useAuth();
  
  // Return override if provided (useful for testing or specific components)
  if (overrideUserId) {
    return overrideUserId;
  }
  
  return user?.id || null;
}
