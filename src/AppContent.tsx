import { useEffect, useState, lazy, Suspense, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { MainLayout } from '@/components/ui/MainLayout';

// Use safer lazy loading with error handling
const Auth = lazy(() => 
  import('@/components/Auth').catch(() => ({ default: () => <div>Error loading Auth component</div> }))
);
const Dashboard = lazy(() => 
  import('@/components/Dashboard').catch(() => ({ default: () => <div>Error loading Dashboard component</div> }))
);
const SubcontractorDashboard = lazy(() => 
  import('@/components/SubcontractorDashboard').catch(() => ({ default: () => <div>Error loading SubcontractorDashboard component</div> }))
);
const NewWorkOrder = lazy(() => 
  import('@/components/NewWorkOrder').catch(() => ({ default: () => <div>Error loading NewWorkOrder component</div> }))
);
const ApprovalPage = lazy(() => 
  import('@/pages/ApprovalPage').catch(() => ({ default: () => <div>Error loading ApprovalPage component</div> }))
);

const LoadingSpinner = () => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
);

export function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('AppContent: Loading timeout reached, forcing completion');
      setIsInitialLoad(false);
      setLoadingTimeout(true);
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, []);

  // Check if current route is an approval page (should not require auth)
  const isApprovalPage = useMemo(() => 
    location.pathname.startsWith('/approval/'), 
    [location.pathname]
  );

  // Memoize auth state to prevent unnecessary logging
  const authState = useMemo(() => ({
    hasSession: !!session,
    authLoading: authLoading,
    roleLoading: roleLoading,
    role,
    pathname: location.pathname,
    isApprovalPage
  }), [session, authLoading, roleLoading, role, location.pathname, isApprovalPage]);

  useEffect(() => {
    try {
      // Only log when auth state actually changes
      console.log('AppContent: Auth state update:', authState);

      const { hasSession, authLoading, roleLoading, role, isApprovalPage } = authState;

      // Skip auth logic for approval pages
      if (isApprovalPage) {
        setIsInitialLoad(false);
        return;
      }

      // Only handle routing after initial load
      if (isInitialLoad) {
        if (!authLoading && !roleLoading) {
          setIsInitialLoad(false);
        }
        return;
      }

      // Handle routing based on auth state
      if (!authLoading) {
        if (!hasSession) {
          console.log('AppContent: No session, redirecting to auth');
          try {
            navigate('/auth', { replace: true });
          } catch (navError) {
            console.error('Navigation error:', navError);
            setError('Navigation failed');
          }
        } else if (hasSession && !roleLoading) {
          console.log('AppContent: Session exists, handling dashboard routing');
          // Only redirect to dashboard if we're on the auth page
          if (location.pathname === '/auth') {
            // Redirect based on user role
            try {
              if (role === 'subcontractor') {
                navigate('/dashboard/subcontractor', { replace: true });
              } else {
                navigate('/dashboard', { replace: true });
              }
            } catch (navError) {
              console.error('Navigation error:', navError);
              setError('Navigation failed');
            }
          }
        }
      }
    } catch (err) {
      console.error('AppContent: Error in useEffect:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [authState, navigate, isInitialLoad, location.pathname]);

  // Show error state if there's an error
  if (error) {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-600 mb-4">Application Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => {
              setError(null);
              window.location.reload();
            }} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  // Don't show loading spinner for approval pages or if timeout reached
  if (!isApprovalPage && !loadingTimeout && (authState.authLoading || authState.roleLoading || isInitialLoad)) {
    console.log('AppContent: Rendering spinner', {
      roleLoading: authState.roleLoading,
      isInitialLoad,
      hasSession: authState.hasSession,
      role: authState.role,
      location: location.pathname,
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
