import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';

/**
 * Hook to validate the current session when a component mounts
 * Useful for pages that are accessed after periods of inactivity
 */
export function useSessionValidation() {
  const { session, initialized } = useAuth();

  useEffect(() => {
    const validateSession = async () => {
      // Only validate if auth is initialized
      if (!initialized) return;

      try {
        // Get the current session directly from Supabase
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session validation error:', error);
          return;
        }

        if (currentSession) {
          // Check if the session is expired
          const expiresAt = new Date(currentSession.expires_at! * 1000);
          const now = new Date();
          
          if (expiresAt <= now) {
            console.log('Session has expired, attempting refresh...');
            
            // Try to refresh the session
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshData.session) {
              console.log('Session refresh failed during validation');
              toast.error('Your session has expired. Please sign in again.');
              
              // Clear auth data and redirect
              const projectRef = import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0];
              if (projectRef) {
                localStorage.removeItem(`sb-${projectRef}-auth-token`);
              }
              
              setTimeout(() => {
                window.location.href = '/auth';
              }, 1000);
            } else {
              console.log('Session refreshed successfully during validation');
            }
          }
        } else if (session) {
          // We think we have a session in context, but Supabase says we don't
          console.log('Session mismatch detected - context has session but Supabase does not');
          toast.error('Authentication error. Please sign in again.');
          
          setTimeout(() => {
            window.location.href = '/auth';
          }, 1000);
        }
      } catch (error) {
        console.error('Error during session validation:', error);
      }
    };

    // Validate session when component mounts
    validateSession();
  }, [session, initialized]);
}
