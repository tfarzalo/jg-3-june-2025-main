import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Auth } from './Auth';

export function AuthRedirectGuard() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);

  console.log('AuthRedirectGuard: Rendering with state:', {
    hasSession: !!session,
    loading,
    pathname: location.pathname,
    hasRedirected: hasRedirectedRef.current
  });

  // Reset the redirect flag when component unmounts
  useEffect(() => {
    return () => {
      console.log('AuthRedirectGuard: Cleaning up');
      hasRedirectedRef.current = false;
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  // If loading, show nothing (parent will show spinner)
  if (loading) {
    console.log('AuthRedirectGuard: Loading, showing nothing');
    return null;
  }

  // Only redirect if we're on the auth page and have a session
  // and haven't already redirected (to prevent loops)
  if (session && location.pathname === '/auth' && !hasRedirectedRef.current) {
    console.log('AuthRedirectGuard: Session exists, preparing redirect to dashboard');
    hasRedirectedRef.current = true;
    
    // Use a small timeout to ensure the state updates have propagated
    redirectTimeoutRef.current = window.setTimeout(() => {
      console.log('AuthRedirectGuard: Executing redirect to dashboard');
      return <Navigate to="/dashboard" replace />;
    }, 100);
    
    return null;
  }

  // Otherwise, render the Auth component
  console.log('AuthRedirectGuard: Rendering Auth component');
  return <Auth />;
}

export default AuthRedirectGuard;