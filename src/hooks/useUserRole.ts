import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthProvider';

interface UseUserRoleResult {
  user: any;
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
  const { session, user } = useAuth();
  const [state, setState] = useState({
    role: null as string | null,
    permissions: [] as {resource: string, action: string}[],
    loading: true,
    error: null as string | null
  });

  const fetchUserRole = useCallback(async () => {
    try {
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
  }, [session]);

  useEffect(() => {
    let mounted = true;

    const initializeRole = async () => {
      if (mounted) {
        await fetchUserRole();
      }
    };

    initializeRole();

    return () => {
      mounted = false;
    };
  }, [fetchUserRole]);

  return {
    user,
    ...state,
    isAdmin: state.role === 'admin',
    isJGManagement: state.role === 'jg_management',
    isSubcontractor: state.role === 'subcontractor'
  };
}