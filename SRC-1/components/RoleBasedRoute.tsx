import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole } from '../hooks/useUserRole';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export function RoleBasedRoute({ 
  children, 
  allowedRoles, 
  redirectTo = '/dashboard' 
}: RoleBasedRouteProps) {
  const { role, loading } = useUserRole();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  // Check if user's role is in the allowed roles
  if (role && allowedRoles.includes(role)) {
    return <>{children}</>;
  }
  
  // Redirect to specified path or dashboard
  return <Navigate to={redirectTo} state={{ from: location }} replace />;
}