import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';

interface ProtectedRouteProps {
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  fallback = <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
}) => {
  const { session, initializing } = useAuth();

  // Show loading while auth is initializing
  if (initializing) {
    return <>{fallback}</>;
  }

  // Redirect to auth if no session
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Render protected content
  return <Outlet />;
};
