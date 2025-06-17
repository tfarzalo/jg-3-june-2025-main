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
  const { session, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
        navigate('/auth', { replace: true });
      } else if (hasSession && !roleLoading) {
        console.log('AppContent: Session exists, handling dashboard routing');
        // Only redirect to dashboard if we're on the auth page
        if (location.pathname === '/auth') {
          // Redirect based on user role
          if (role === 'subcontractor') {
            navigate('/dashboard/subcontractor', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }
      }
    }
  }, [authState, navigate, isInitialLoad, location.pathname]); // Simplified dependencies

  // Don't show loading spinner for approval pages
  if (!isApprovalPage && (authState.authLoading || authState.roleLoading || isInitialLoad)) {
    console.log('AppContent: Rendering spinner', {
      authLoading: authState.authLoading,
      roleLoading: authState.roleLoading,
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
