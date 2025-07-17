import React from 'react';
import { useUserRole } from '../hooks/useUserRole';

interface PermissionGuardProps {
  children: React.ReactNode;
  resource: string;
  action: string;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ 
  children, 
  resource, 
  action, 
  fallback = null 
}: PermissionGuardProps) {
  const { hasPermission, loading } = useUserRole();
  
  if (loading) {
    return null;
  }
  
  if (hasPermission(resource, action)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}