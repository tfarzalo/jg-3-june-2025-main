import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  error: null,
  signIn: async () => ({ success: false, error: 'Auth context not initialized' }),
  signOut: async () => ({ success: false, error: 'Auth context not initialized' }),
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Get the Supabase project reference from the URL
const getSupabaseProjectRef = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url.split('//')[1].split('.')[0];
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // First, try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        // If we have a session, set it
        if (session) {
          console.log('Found existing session:', session);
          setSession(session);
          setUser(session.user);
          setLoading(false);
        } else {
          console.log('No session found, checking for stored session');
          // Check if there's a stored session in localStorage
          const projectRef = getSupabaseProjectRef();
          const storedSession = localStorage.getItem(`sb-${projectRef}-auth-token`);
          
          if (storedSession) {
            try {
              const parsedSession = JSON.parse(storedSession);
              if (parsedSession?.access_token) {
                console.log('Found stored session, attempting to refresh');
                const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.setSession({
                  access_token: parsedSession.access_token,
                  refresh_token: parsedSession.refresh_token
                });
                
                if (!mounted) return;

                if (refreshError) {
                  console.error('Refresh error:', refreshError);
                  // Clear invalid session
                  localStorage.removeItem(`sb-${projectRef}-auth-token`);
                  setError(refreshError.message);
                  setLoading(false);
                  return;
                }

                if (refreshedSession) {
                  console.log('Successfully refreshed session');
                  setSession(refreshedSession);
                  setUser(refreshedSession.user);
                  setLoading(false);
                  return;
                }
              }
            } catch (error) {
              console.error('Error parsing stored session:', error);
              // Clear invalid session
              localStorage.removeItem(`sb-${projectRef}-auth-token`);
            }
          }
          
          // If we get here, we couldn't restore a session
          console.log('No valid session found');
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      } catch (error: any) {
        if (!mounted) return;
        console.error('Auth initialization error:', error);
        setError(error.message || 'Failed to initialize auth');
        setLoading(false);
      }
    };

    // Initialize auth immediately
    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('Auth state changed:', event, session);

      if (event === 'SIGNED_OUT') {
        // Clear any local storage items
        const projectRef = getSupabaseProjectRef();
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
        localStorage.removeItem('gibson_token');
        sessionStorage.clear();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      } else if (event === 'USER_UPDATED') {
        console.log('User updated:', session?.user);
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      setSession(data.session);
      setUser(data.user);
      setLoading(false);

      return { success: true };
    } catch (error: any) {
      const message = error.message || 'Failed to sign in';
      setError(message);
      setLoading(false);
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      
      // Clear any local storage items
      const projectRef = getSupabaseProjectRef();
      localStorage.removeItem(`sb-${projectRef}-auth-token`);
      localStorage.removeItem('gibson_token');
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear all state
      setSession(null);
      setUser(null);
      setLoading(false);
      setError(null);

      // Clear any cached data
      sessionStorage.clear();
      
      // Force reload to clear any remaining state
      window.location.href = '/auth';
      
      return { success: true };
    } catch (error: any) {
      const message = error.message || 'Failed to sign out';
      setError(message);
      setLoading(false);
      toast.error(message);
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}; 