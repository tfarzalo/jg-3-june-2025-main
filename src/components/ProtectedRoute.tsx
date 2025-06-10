import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';

interface ProtectedRouteProps {
  component: React.ComponentType;
  requiredRoles?: string[];
}

export const ProtectedRoute = ({ 
  component: Component, 
  requiredRoles = [] 
}: ProtectedRouteProps) => {
  const { session, loading: isAuthLoading } = useAuth();
  const { role, loading: isRolesLoading } = useUserRole();
  
  if (isAuthLoading || isRolesLoading) {
    return <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>;
  }
  
  if (!session) {
    return <Navigate to="/auth" />;
  }
  
  // If no specific roles are required, just check authentication
  if (requiredRoles.length === 0) {
    return <Component />;
  }
  
  // Check if user has at least one of the required roles
  const hasRequiredRole = requiredRoles.includes(role || '');
  
  if (!hasRequiredRole) {
    return <Navigate to="/unauthorized" />;
  }
  
  return <Component />;
};