import { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';
import { MainLayout } from './ui/MainLayout';

const Auth = lazy(() => import('./Auth'));
const Dashboard = lazy(() => import('./Dashboard'));
const SubcontractorDashboard = lazy(() => import('./SubcontractorDashboard'));

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

  useEffect(() => {
    console.log('AppContent: Effect running with state:', {
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

    // Handle routing based on auth state
    if (!authLoading) {
      if (!session) {
        console.log('AppContent: No session, redirecting to auth');
        navigate('/auth', { replace: true });
      } else if (session && !roleLoading) {
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
  }, [session, authLoading, roleLoading, role, navigate, location.pathname, isInitialLoad]);

  if (authLoading || roleLoading || isInitialLoad) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route path="/auth" element={
        <Suspense fallback={<LoadingSpinner />}>
          <Auth />
        </Suspense>
      } />
      <Route path="/dashboard/*" element={
        <MainLayout>
          <Suspense fallback={<LoadingSpinner />}>
            {role === 'subcontractor' ? <SubcontractorDashboard /> : <Dashboard />}
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