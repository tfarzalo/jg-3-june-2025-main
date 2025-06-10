import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
      
      if (sessionError) throw sessionError;
      if (!session) {
        setState(prev => ({
          ...prev,
          role: null,
          permissions: [],
          error: null,
          loading: false
        }));
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profileError) throw profileError;

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

    const initializeRole = async () => {
      if (mounted) {
        await fetchUserRole();
      }
    };

    initializeRole();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
      subscription.unsubscribe();
    };
  }, [fetchUserRole]);

  return {
    ...state,
    isAdmin: state.role === 'admin',
    isJGManagement: state.role === 'jg_management',
    isSubcontractor: state.role === 'subcontractor'
  };
}