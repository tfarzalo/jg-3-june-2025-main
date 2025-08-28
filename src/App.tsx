import React, { lazy, Suspense } from 'react';
import { 
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
  Navigate,
  Outlet
} from 'react-router-dom';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthProvider';
import { JobDataProvider } from './contexts/JobDataContext';
import { UserRoleProvider } from './contexts/UserRoleContext';
import { SubcontractorPreviewProvider } from './contexts/SubcontractorPreviewContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/ui/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DebugInfo } from './components/DebugInfo';

const Auth = lazy(() => import('./components/Auth'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const SubcontractorDashboard = lazy(() => import('./components/SubcontractorDashboard'));
const NewWorkOrder = lazy(() => import('./components/NewWorkOrder'));
const ApprovalPage = lazy(() => import('./pages/ApprovalPage'));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
  );

// Root layout
const RootLayout = () => (
  <ErrorBoundary>
    <DebugInfo />
    <Outlet />
  </ErrorBoundary>
);

// Auth layout wrapper
const AuthLayout = () => (
  <JobDataProvider>
    <AuthProvider>
      <Auth />
    </AuthProvider>
  </JobDataProvider>
);

// Protected layout wrapper
const ProtectedLayout = () => (
  <JobDataProvider>
    <AuthProvider>
      <UserRoleProvider>
        <SubcontractorPreviewProvider>
          <ProtectedRoute />
        </SubcontractorPreviewProvider>
      </UserRoleProvider>
    </AuthProvider>
  </JobDataProvider>
);
  
  // Create router with correct structure
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route element={<RootLayout />}>
        {/* Public routes */}
        <Route path="/approval/:token" element={
          <Suspense fallback={<LoadingSpinner />}>
            <JobDataProvider>
              <AuthProvider>
                <ApprovalPage />
              </AuthProvider>
            </JobDataProvider>
          </Suspense>
        } />
        
        {/* Auth route */}
        <Route path="/auth" element={
          <Suspense fallback={<LoadingSpinner />}>
            <AuthLayout />
          </Suspense>
        } />
        
        {/* Protected routes */}
        <Route element={
          <Suspense fallback={<LoadingSpinner />}>
            <ProtectedLayout />
          </Suspense>
        }>
          <Route path="/dashboard/jobs/:jobId/new-work-order" element={
            <Suspense fallback={<LoadingSpinner />}>
              <MainLayout>
                <NewWorkOrder />
              </MainLayout>
            </Suspense>
          } />
          <Route path="/dashboard/*" element={
            <Suspense fallback={<LoadingSpinner />}>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </Suspense>
          } />
        </Route>
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Route>
    ),
    {
      future: {
        v7_relativeSplatPath: true
      }
    }
  );

function App() {
  return (
    <ThemeProvider>
      <RouterProvider 
        router={router}
        future={{
          v7_startTransition: true
        }}
      />
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1E293B',
            color: '#F8FAFC',
            border: '1px solid #334155'
          }
        }}
      />
    </ThemeProvider>
  );
}

export default App;
