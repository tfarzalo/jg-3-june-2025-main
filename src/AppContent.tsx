import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from './components/ui/MainLayout';
import { useAuth } from './contexts/AuthContext';
import { useUserRole } from './hooks/useUserRole';

// Lazy load components with error handling
const Auth = lazy(() => 
  import('./components/Auth')
    .then(module => ({ default: module.Auth }))
    .catch(error => {
      console.error('Error loading Auth component:', error);
      throw error;
    })
);

const Dashboard = lazy(() => 
  import('./components/Dashboard')
    .then(module => ({ default: module.Dashboard }))
    .catch(error => {
      console.error('Error loading Dashboard component:', error);
      throw error;
    })
);

const SubcontractorDashboard = lazy(() => 
  import('./components/SubcontractorDashboard')
    .then(module => ({ default: module.SubcontractorDashboard }))
    .catch(error => {
      console.error('Error loading SubcontractorDashboard component:', error);
      throw error;
    })
);

const Unauthorized = lazy(() => 
  import('./components/Unauthorized')
    .then(module => ({ default: module.Unauthorized }))
    .catch(error => {
      console.error('Error loading Unauthorized component:', error);
      throw error;
    })
);

// Error boundary component
const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-4">
    <div className="max-w-md w-full space-y-4 bg-white dark:bg-[#1E293B] p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Something went wrong</h2>
      <p className="text-gray-600 dark:text-gray-400">{error.message}</p>
      <button
        onClick={() => window.location.reload()}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Reload Page
      </button>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

export function AppContent() {
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    console.log('AppContent: Auth state:', { 
      hasSession: !!session, 
      authLoading, 
      roleLoading, 
      role,
      pathname: location.pathname 
    });

    // Only handle routing after initial load
    if (isInitialLoad) {
      if (!authLoading && !roleLoading) {
        setIsInitialLoad(false);
      }
      return;
    }
  }, [session, authLoading, roleLoading, role, location.pathname, isInitialLoad]);

  // Show loading spinner during initial load or while loading auth/role
  if (authLoading || roleLoading || isInitialLoad) {
    return <LoadingSpinner />;
  }

  // Handle authentication routes
  if (!session) {
    if (location.pathname === '/auth') {
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <Auth />
        </Suspense>
      );
    }
    return <Navigate to="/auth" replace />;
  }

  // Handle authenticated routes
  return (
    <Routes>
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard/subcontractor"
        element={
          <MainLayout>
            <Suspense fallback={<LoadingSpinner />}>
              {role === 'subcontractor' || role === 'admin' || role === 'jg_management' ? (
                <SubcontractorDashboard />
              ) : (
                <Navigate to="/unauthorized" replace />
              )}
            </Suspense>
          </MainLayout>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <MainLayout>
            <Suspense fallback={<LoadingSpinner />}>
              {role === 'subcontractor' ? (
                <Navigate to="/dashboard/subcontractor" replace />
              ) : (
                <Dashboard />
              )}
            </Suspense>
          </MainLayout>
        }
      />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}