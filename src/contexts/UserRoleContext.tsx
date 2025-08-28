import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

interface UserRoleContextType {
  role: string | null;
  isSubcontractor: boolean;
  isAdmin: boolean;
  isJGManagement: boolean;
  loading: boolean;
  error: string | null;
}

const UserRoleContext = createContext<UserRoleContextType>({
  role: null,
  isSubcontractor: false,
  isAdmin: false,
  isJGManagement: false,
  loading: true,
  error: null
});

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate boolean flags based on role
  const isSubcontractor = role === 'subcontractor';
  const isAdmin = role === 'admin';
  const isJGManagement = role === 'jg_management';

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profileError) throw profileError;
          setRole(profile.role);
        }
      } catch (err) {

        setError(err instanceof Error ? err.message : 'Failed to fetch user role');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  return (
    <UserRoleContext.Provider value={{ 
      role, 
      isSubcontractor, 
      isAdmin, 
      isJGManagement, 
      loading, 
      error 
    }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}