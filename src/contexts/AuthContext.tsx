import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  error: null,
  initialized: false,
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
  const [lastActivity, setLastActivity] = useState(Date.now());

  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', resetActivity);
    document.addEventListener('keydown', resetActivity);
    document.addEventListener('click', resetActivity);
    document.addEventListener('scroll', resetActivity);

    return () => {
      document.removeEventListener('mousemove', resetActivity);
      document.removeEventListener('keydown', resetActivity);
      document.removeEventListener('click', resetActivity);
      document.removeEventListener('scroll', resetActivity);
    };
  }, [resetActivity]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT) {
        console.log('User inactive for 24 hours, signing out.');
        signOut();
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [lastActivity]);

  useEffect(() => {
    if (initialized) return; // Prevent multiple initializations
    
    let mounted = true;
    let initCompleted = false;
  
    // Aggressive timeout to prevent hanging
    const emergencyTimeout = setTimeout(() => {
      if (!initCompleted && mounted) {
        console.log('Force completing auth initialization');
        initCompleted = true;
        setSession(null);
        setUser(null);
        setError(null);
        setLoading(false);
        setInitialized(true);
      }
    }, 10000); // Increased to 10 seconds
  
    const initializeAuth = async () => {
      if (!mounted || initCompleted) return;
      
      try {
        console.log('Starting auth initialization...');
        setLoading(true);
        
        // Get project reference early
        const projectRef = getSupabaseProjectRef();
        
        // First, try to get the current session from Supabase directly
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted || initCompleted) return;
        
        if (sessionError) {
          console.error('Session error during initialization:', sessionError);
          // Clear any potentially corrupted session data
          try {
            localStorage.removeItem(`sb-${projectRef}-auth-token`);
          } catch (e) {
            console.error('Error clearing localStorage:', e);
          }
          initCompleted = true;
          setSession(null);
          setUser(null);
          setError(null); // Clear any previous errors
          setLoading(false);
          setInitialized(true);
          console.log('Auth initialization completed - session error handled');
          return;
        }

        if (session) {
          // Check if this session is expired
          const expiresAt = new Date(session.expires_at! * 1000);
          const now = new Date();
          
          if (expiresAt <= now) {
            console.log('Session found but expired, attempting refresh...');
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              
              if (!mounted || initCompleted) return;
              
              if (refreshError || !refreshData.session) {
                console.log('Session refresh failed during initialization, clearing session');
                localStorage.removeItem(`sb-${projectRef}-auth-token`);
                initCompleted = true;
                setSession(null);
                setUser(null);
                setError(null);
                setLoading(false);
                setInitialized(true);
                console.log('Auth initialization completed - expired session cleared');
                return;
              } else {
                console.log('Session refreshed successfully during initialization');
                initCompleted = true;
                setSession(refreshData.session);
                setUser(refreshData.session.user);
                setError(null);
                setLoading(false);
                setInitialized(true);
                console.log('Auth initialization completed - session refreshed');
                return;
              }
            } catch (refreshError) {
              console.error('Error during session refresh:', refreshError);
              initCompleted = true;
              setSession(null);
              setUser(null);
              setError(null);
              setLoading(false);
              setInitialized(true);
              console.log('Auth initialization completed - refresh error');
              return;
            }
          } else {
            console.log('Valid non-expired session found during initialization');
            initCompleted = true;
            setSession(session);
            setUser(session.user);
            setError(null);
            setLoading(false);
            setInitialized(true);
            console.log('Auth initialization completed - valid session found');
            return;
          }
        }

        // If no session from Supabase, check localStorage as fallback
        const storedToken = localStorage.getItem(`sb-${projectRef}-auth-token`);
        
        if (storedToken && !initCompleted) {
          try {
            const parsedToken = JSON.parse(storedToken);
            
            if (parsedToken.access_token && parsedToken.expires_at) {
              const expiresAt = new Date(parsedToken.expires_at * 1000);
              const now = new Date();
              
              // Only try to use stored session if it's not expired
              if (expiresAt > now) {
                console.log('Attempting to restore session from localStorage');
                const { data: { session: restoredSession }, error: restoreError } = 
                  await supabase.auth.setSession({
                    access_token: parsedToken.access_token,
                    refresh_token: parsedToken.refresh_token
                  });
                
                if (!mounted || initCompleted) return;
                
                if (restoreError || !restoredSession) {
                  console.log('Failed to restore session, clearing storage');
                  localStorage.removeItem(`sb-${projectRef}-auth-token`);
                } else {
                  console.log('Successfully restored session from localStorage');
                  initCompleted = true;
                  setSession(restoredSession);
                  setUser(restoredSession.user);
                  setError(null);
                  setLoading(false);
                  setInitialized(true);
                  console.log('Auth initialization completed - session restored');
                  return;
                }
              } else {
                console.log('Stored session expired, clearing');
                localStorage.removeItem(`sb-${projectRef}-auth-token`);
              }
            }
          } catch (error) {
            console.error('Error parsing stored session, clearing:', error);
            localStorage.removeItem(`sb-${projectRef}-auth-token`);
          }
        }

        // If we get here, no valid session exists
        if (!initCompleted && mounted) {
          console.log('No valid session found, user needs to log in');
          initCompleted = true;
          setSession(null);
          setUser(null);
          setError(null);
          setLoading(false);
          setInitialized(true);
          console.log('Auth initialization completed - no session');
        }
        
      } catch (error: any) {
        if (!initCompleted && mounted) {
          console.error('Auth initialization error:', error);
          initCompleted = true;
          setError(error.message || 'Failed to initialize auth');
          setSession(null);
          setUser(null);
          setLoading(false);
          setInitialized(true);
          console.log('Auth initialization completed - with error');
        }
      }
    };

    // Initialize auth immediately
    initializeAuth();

    // Clear the emergency timeout once init starts
    const clearEmergencyTimeout = () => clearTimeout(emergencyTimeout);

    // Fallback timeout to ensure initialization completes even with network issues
    const initTimeout = setTimeout(() => {
      if (!initialized && mounted) {
        console.log('Auth initialization timeout - forcing completion');
        forceComplete();
      }
    }, 4000); // 4 second fallback timeout

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
        setSession(null);
        setUser(null);
        setError(null);
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
      setLoading(false); // Always set loading to false after any auth state change
      
      // Mark as initialized after any auth state change
      if (!initialized) {
        console.log('Setting initialized to true via auth state change');
        setInitialized(true);
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
          // Check if session is expired or close to expiring
          const expiresAt = new Date(session.expires_at! * 1000);
          const now = new Date();
          const timeUntilExpiry = expiresAt.getTime() - now.getTime();
          const fiveMinutes = 5 * 60 * 1000;
          
          // If session has already expired or will expire within 5 minutes
          if (timeUntilExpiry < fiveMinutes) {
            console.log('Session expired or close to expiring, refreshing...');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error('Failed to refresh session:', refreshError);
              // If refresh fails, the session is truly invalid - sign out
              console.log('Session refresh failed, signing out user');
              setSession(null);
              setUser(null);
              setError('Session expired. Please sign in again.');
              // Clear any stored session data
              const projectRef = getSupabaseProjectRef();
              localStorage.removeItem(`sb-${projectRef}-auth-token`);
            } else {
              console.log('Session refreshed successfully');
              // Update the session with the new one
              if (refreshData.session) {
                setSession(refreshData.session);
                setUser(refreshData.session.user);
              }
            }
          }
        } else {
          console.log('No session found during refresh check');
          // No session exists, ensure auth state is clean
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Error in session refresh check:', error);
      }
    }, 60000); // Check every minute

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      clearTimeout(initTimeout);
      clearTimeout(emergencyTimeout);
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
    initialized,
    signIn,
    signOut,
  }), [session, user, loading, error, initialized, signIn, signOut]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};