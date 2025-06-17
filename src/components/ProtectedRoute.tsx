import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';

interface ProtectedRouteProps {
  component: React.ComponentType;
  requiredRoles?: string[];
}

export const ProtectedRoute = ({ 
  component: Component, 
  requiredRoles = [] 
}: ProtectedRouteProps) => {
  const { session, loading: isAuthLoading, error } = useAuth();
  const { role, loading: isRolesLoading } = useUserRole();
  
  // Show loading while checking auth or roles
  if (isAuthLoading || isRolesLoading) {
    return <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>;
  }
  
  // If there's an auth error or no session, redirect to login
  if (error || !session) {
    console.log('ProtectedRoute: Redirecting to auth - error:', error, 'session:', !!session);
    return <Navigate to="/auth" replace />;
  }
  
  // If no specific roles are required, just check authentication
  if (requiredRoles.length === 0) {
    return <Component />;
  }
  
  // Check if user has at least one of the required roles
  const hasRequiredRole = requiredRoles.includes(role || '');
  
  if (!hasRequiredRole) {
    console.log('ProtectedRoute: Access denied - user role:', role, 'required:', requiredRoles);
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <Component />;
};
