import { useEffect, useState, lazy, Suspense, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { MainLayout } from '@/components/ui/MainLayout';

const Auth = lazy(() => import('@/components/Auth'));
const Dashboard = lazy(() => import('@/components/Dashboard'));
const SubcontractorDashboard = lazy(() => import('@/components/SubcontractorDashboard'));
const NewWorkOrder = lazy(() => import('@/components/NewWorkOrder'));
const ApprovalPage = lazy(() => import('@/pages/ApprovalPage'));

const LoadingSpinner = () => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
);

export function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, initialized: authInitialized } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Reduced timeout and better logic
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('AppContent: Auth initialization timeout, forcing completion');
      setIsInitialLoad(false);
    }, 8000); // Increased to 8 seconds to allow for session refresh

    return () => clearTimeout(timeout);
  }, []);

  // Check if current route is an approval page (should not require auth)
  const isApprovalPage = useMemo(() => 
    location.pathname.startsWith('/approval/'), 
    [location.pathname]
  );

  // Simplified auth state with proper initialization check
  const authState = useMemo(() => ({
    hasSession: !!session,
    authLoading: authLoading,
    roleLoading: roleLoading && !!session, // Only consider role loading if we have a session
    role,
    pathname: location.pathname,
    isApprovalPage,
    isInitialized: authInitialized
  }), [session, authLoading, roleLoading, role, location.pathname, isApprovalPage, authInitialized]);

  useEffect(() => {
    console.log('AppContent: Auth state update:', authState);

    const { hasSession, authLoading, roleLoading, role, isApprovalPage, isInitialized } = authState;
    let redirectTimeout: NodeJS.Timeout | null = null;

    // Skip auth logic for approval pages
    if (isApprovalPage) {
      setIsInitialLoad(false);
      return;
    }

    // Wait for auth to be properly initialized
    if (!isInitialized) {
      console.log('AppContent: Waiting for auth initialization...');
      return;
    }

    // Mark initial load as complete once auth is initialized
    if (isInitialLoad && isInitialized) {
      console.log('AppContent: Auth initialized, marking initial load complete');
      setIsInitialLoad(false);
    }

    // Handle routing based on auth state (only after initialization)
    if (isInitialized && !authLoading) {
      if (!hasSession) {
        console.log('AppContent: No session, redirecting to auth');
        if (location.pathname !== '/auth') {
          navigate('/auth', { replace: true });
        }
      } else if (hasSession) {
        console.log('AppContent: Session exists, handling dashboard routing', {
          roleLoading,
          role,
          pathname: location.pathname
        });
        
        // If we're on the auth page and have a session, redirect to dashboard
        if (location.pathname === '/auth') {
          // If role is still loading, wait a bit but don't wait forever
          if (roleLoading) {
            console.log('AppContent: Role still loading, setting up redirect timeout...');
            // Set a short timeout to redirect even if role loading is stuck
            redirectTimeout = setTimeout(() => {
              // Check if we're still on auth page and navigate accordingly
              if (window.location.pathname === '/auth') {
                console.log('AppContent: Timeout reached, forcing redirect to dashboard');
                // Get the current role from the hook directly or use default
                const currentRole = role;
                if (currentRole === 'subcontractor') {
                  navigate('/dashboard/subcontractor', { replace: true });
                } else {
                  navigate('/dashboard', { replace: true });
                }
              }
            }, 1500); // Reduced to 1.5 seconds
          } else {
            // Role is loaded, redirect immediately
            console.log('AppContent: Role loaded, redirecting to dashboard immediately');
            if (role === 'subcontractor') {
              navigate('/dashboard/subcontractor', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          }
        }
      }
    }

    // Cleanup function to clear timeout
    return () => {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [authState, navigate, isInitialLoad, location.pathname]);

  // Show loading spinner only when actually loading and not initialized
  const shouldShowLoading = !isApprovalPage && 
    ((authState.authLoading && !authState.isInitialized) || 
     (!authState.isInitialized && isInitialLoad) ||
     // Only show loading for role if we don't have a role yet and auth is done
     (authState.hasSession && authState.roleLoading && !authState.role && authState.isInitialized));

  if (shouldShowLoading) {
    console.log('AppContent: Rendering spinner', {
      authLoading: authState.authLoading,
      roleLoading: authState.roleLoading,
      isInitialized: authState.isInitialized,
      isInitialLoad,
      hasSession: authState.hasSession,
      role: authState.role,
      location: location.pathname
    });
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route path="/approval/:token" element={
        <Suspense fallback={<LoadingSpinner />}>
          <ApprovalPage />
        </Suspense>
      } />
      <Route path="/auth" element={
        <Suspense fallback={<LoadingSpinner />}>
          <Auth />
        </Suspense>
      } />
      <Route path="/dashboard/jobs/:jobId/new-work-order" element={
        <Suspense fallback={<LoadingSpinner />}>
          <NewWorkOrder />
        </Suspense>
      } />
      <Route path="/dashboard/*" element={
        <MainLayout>
          <Suspense fallback={<LoadingSpinner />}>
            {authState.role === 'subcontractor' ? <SubcontractorDashboard /> : <Dashboard />}
          </Suspense>
        </MainLayout>
      } />
      <Route path="*" element={
        <Suspense fallback={<LoadingSpinner />}>
          <Auth />
        </Suspense>
      } />
    </Routes>
  );
}
