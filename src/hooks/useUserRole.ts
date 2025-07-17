import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UseUserRoleResult {
  role: string | null;
  permissions: { resource: string; action: string }[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isJGManagement: boolean;
  isSubcontractor: boolean;
}

/**
 * Hook to get and check user roles and permissions
 */
export function useUserRole(): UseUserRoleResult {
  const { initialized: authInitialized } = useAuth();
  const [state, setState] = useState({
    role: null as string | null,
    permissions: [] as {resource: string, action: string}[],
    loading: true,
    error: null as string | null
  });

  const fetchUserRole = useCallback(async () => {
    try {
      // First check if we have a session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error in fetchUserRole:', sessionError);
        setState(prev => ({
          ...prev,
          role: null,
          permissions: [],
          error: null,
          loading: false
        }));
        return;
      }
      
      if (!session) {
        console.log('No session found in fetchUserRole');
        setState(prev => ({
          ...prev,
          role: null,
          permissions: [],
          error: null,
          loading: false
        }));
        return;
      }

      // Check if session is expired
      const expiresAt = new Date(session.expires_at! * 1000);
      const now = new Date();
      
      if (expiresAt <= now) {
        console.log('Session expired in fetchUserRole, not making API call');
        setState(prev => ({
          ...prev,
          role: null,
          permissions: [],
          error: 'Session expired',
          loading: false
        }));
        return;
      }

      console.log('Fetching user role for user:', session.user.id);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }

      setState(prev => ({
        ...prev,
        role: profile?.role || null,
        permissions: [],
        error: null,
        loading: false
      }));
    } catch (error) {
      console.error('Error fetching role:', error);
      setState(prev => ({
        ...prev,
        role: null,
        permissions: [],
        error: error instanceof Error ? error.message : 'Failed to fetch role',
        loading: false
      }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const initializeRole = async () => {
      // Wait for auth to be initialized before fetching role
      if (!authInitialized) {
        setState(prev => ({
          ...prev,
          loading: true,
          error: null
        }));
        return;
      }

      // Add a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.log('useUserRole: Timeout reached, stopping loading');
          setState(prev => ({
            ...prev,
            loading: false,
            error: null
          }));
        }
      }, 5000); // 5 second timeout

      // Add a small delay to ensure auth context is fully settled
      await new Promise(resolve => setTimeout(resolve, 100));

      if (mounted) {
        await fetchUserRole();
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };

    initializeRole();

    // Subscribe to auth state changes only if auth is initialized
    if (authInitialized) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
        if (mounted) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await fetchUserRole();
          } else if (event === 'SIGNED_OUT') {
            setState(prev => ({
              ...prev,
              role: null,
              permissions: [],
              error: null,
              loading: false
            }));
          }
        }
      });

      return () => {
        mounted = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fetchUserRole, authInitialized]);

  return {
    ...state,
    isAdmin: state.role === 'admin',
    isJGManagement: state.role === 'jg_management',
    isSubcontractor: state.role === 'subcontractor'
  };
}