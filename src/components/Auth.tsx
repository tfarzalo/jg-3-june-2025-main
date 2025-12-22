import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase';

export function Auth() {
  const navigate = useNavigate();
  const { signIn, session, initializing: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const loadingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    console.log('Auth: Component mounted');
    console.log('Auth: Current auth state:', { session: !!session, authLoading });
    // Debug: log when Auth is rendered
    console.log('Auth: Rendered', { session, authLoading });
    
    // Only redirect if we have a valid session and we're not already loading
    if (session && !authLoading) {
      console.log('Auth: Session found, checking user role for redirect');
      checkUserRoleAndRedirect();
    }
    
    return () => {
      console.log('Auth: Component unmounting');
      isMountedRef.current = false;
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [session, authLoading]); // Include dependencies to handle auth state changes properly

  const checkUserRoleAndRedirect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/dashboard');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        navigate('/dashboard');
        return;
      }

      // Redirect based on user role
      if (profile?.role === 'subcontractor') {
        console.log('Auth: Redirecting subcontractor to subcontractor dashboard');
        navigate('/dashboard/subcontractor');
      } else if (profile?.role === 'admin' || profile?.role === 'jg_management') {
        console.log('Auth: Redirecting admin/management to main dashboard');
        navigate('/dashboard');
      } else {
        console.log('Auth: Redirecting other users to main dashboard');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      navigate('/dashboard');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Auth: Sign in attempt');
    
    if (!email || !password) {
      console.log('Auth: Missing email or password');
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await signIn(email, password);
      console.log('Auth: Sign in result:', result);
      
      if (!result.success) {
        setLoading(false);
        throw new Error(result.error);
      }
      
      // Don't navigate here - let the session change trigger the navigation
      toast.success('Signed in successfully');
    } catch (err: any) {
      console.error('Auth: Error signing in:', err);
      setError(err.message || 'Failed to sign in');
      toast.error(err.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  // Show loading spinner only during initial auth check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If we have a session, show loading spinner while redirecting
  if (session) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-[#1E293B] p-8 rounded-xl shadow-lg">
         <div className="text-center">
    <div className="mx-auto h-16 w-16 flex items-center justify-center">
      <img
        src="https://tbwtfimnbmvbgesidbxh.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1750132407578_jg-logo-icon.png"
        alt="JG Portal Logo"
       className="h-16 w-auto object-contain"

              onError={(e) => {
                // Fallback to the current icon if logo fails to load
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="h-8 w-8 text-gray-400">
                      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path>
                      <path d="M7 7h.01"></path>
                    </svg>
                  `;
                }
              }}
            />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            JG Portal 2.0
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-base bg-white dark:bg-[#0F172A]"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-base bg-white dark:bg-[#0F172A]"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              ) : (
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-blue-500 group-hover:text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Auth;
