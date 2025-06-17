import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialized) return; // Prevent multiple initializations
    
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
      } finally {
        if (mounted) {
          setInitialized(true);
        }
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
        // Don't navigate here - let the route protection handle it
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      } else if (event === 'USER_UPDATED') {
        console.log('User updated:', session?.user);
      } else if (event === 'SIGNED_IN') {
        console.log('User signed in successfully');
      }

      setSession(session);
      setUser(session?.user ?? null);
      
      // Only set loading to false if we're not in the middle of a refresh
      if (event !== 'TOKEN_REFRESHED') {
        setLoading(false);
      }
    });

    // Set up periodic session refresh to prevent random logouts
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session refresh error:', error);
          return;
        }
        
        if (session) {
          // Check if session is close to expiring (within 5 minutes)
          const expiresAt = new Date(session.expires_at! * 1000);
          const now = new Date();
          const timeUntilExpiry = expiresAt.getTime() - now.getTime();
          const fiveMinutes = 5 * 60 * 1000;
          
          if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
            console.log('Session close to expiring, refreshing...');
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error('Failed to refresh session:', refreshError);
            } else {
              console.log('Session refreshed successfully');
            }
          }
        }
      } catch (error) {
        console.error('Error in session refresh check:', error);
      }
    }, 60000); // Check every minute

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [initialized]); // Only run once after initialization

  // Memoize signIn to prevent recreation on every render
  const signIn = useCallback(async (email: string, password: string) => {
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
  }, []);

  // Memoize signOut to prevent recreation on every render
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      const projectRef = getSupabaseProjectRef();
      localStorage.removeItem(`sb-${projectRef}-auth-token`);
      localStorage.removeItem('gibson_token');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
      setLoading(false);
      setError(null);
      sessionStorage.clear();
      // Removed navigate('/auth') from here. Let the caller handle navigation.
      return { success: true };
    } catch (error: any) {
      const message = error.message || 'Failed to sign out';
      setError(message);
      setLoading(false);
      toast.error(message);
      return { success: false, error: message };
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    session,
    user,
    loading,
    error,
    signIn,
    signOut,
  }), [session, user, loading, error, signIn, signOut]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};