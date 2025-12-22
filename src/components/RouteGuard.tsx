import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole } from '../contexts/UserRoleContext';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

/**
 * RouteGuard component that protects routes based on user roles
 * Admin and JG Management users have full access
 * Subcontractors are restricted to their dashboard and work order routes
 */
export function RouteGuard({ 
  children, 
  allowedRoles = ['admin', 'jg_management'], 
  redirectTo = '/dashboard/subcontractor' 
}: RouteGuardProps) {
  const { role, isSubcontractor, isAdmin, isJGManagement, loading } = useUserRole();
  const location = useLocation();



  // Show loading while role is being determined
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Admin and JG Management users have full access to all routes
  if (isAdmin || isJGManagement) {
    return <>{children}</>;
  }

  // If user is a subcontractor
  if (isSubcontractor) {
    // Allow access to subcontractor dashboard and work order routes
    if (location.pathname === '/dashboard/subcontractor' || 
        (location.pathname.startsWith('/dashboard/jobs/') && location.pathname.includes('/new-work-order'))) {
      return <>{children}</>;
    }
    
    // Redirect all other routes to subcontractor dashboard
    return <Navigate to={redirectTo} replace />;
  }

  // For other users, check if they have the required role
  if (role && !allowedRoles.includes(role)) {
    // Redirect to main dashboard if role not allowed
    return <Navigate to="/dashboard" replace />;
  }

  // Allow access
  return <>{children}</>;
}

/**
 * Specific guard for subcontractor-only routes
 */
export function SubcontractorRouteGuard({ children }: { children: React.ReactNode }) {
  const { isSubcontractor, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isSubcontractor) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * Guard for admin/management only routes
 */
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isJGManagement, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin && !isJGManagement) {
    return <Navigate to="/dashboard/subcontractor" replace />;
  }

  return <>{children}</>;
}
