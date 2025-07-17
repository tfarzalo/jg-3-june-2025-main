import { useState, useCallback } from 'react';
import { gibsonai } from './gibsonai';
import { toast } from 'sonner';

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign in user
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { user, token } = await gibsonai.auth.signIn(email, password);
      
      // Store token in localStorage
      localStorage.setItem('gibson_token', token);
      
      setUser(user);
      return true;
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to sign in';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign out user
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      await gibsonai.auth.signOut();
      
      // Remove token from localStorage
      localStorage.removeItem('gibson_token');
      
      setUser(null);
      return true;
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Failed to sign out');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get current session
  const getSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { user } = await gibsonai.auth.getUser();
      setUser(user);
      
      return { data: { session: user ? { user } : null } };
    } catch (error) {
      console.error('Get session error:', error);
      setError('Failed to get session');
      setUser(null);
      return { data: { session: null } };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    getSession
  };
}

export default useAuth;