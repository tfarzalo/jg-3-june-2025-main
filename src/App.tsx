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
import { ChatTrayProvider } from './contexts/ChatTrayProvider';
import { UnreadMessagesProvider } from './contexts/UnreadMessagesProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/ui/MainLayout';
import { PersistentLayout } from './components/PersistentLayout';
import { AlertStackingTest } from './components/AlertStackingTest';
import { ErrorBoundary } from './components/ErrorBoundary';

const Auth = lazy(() => import('./components/Auth'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const SubcontractorDashboard = lazy(() => import('./components/SubcontractorDashboard'));
const SubcontractorEditPage = lazy(() => import('./components/SubcontractorEditPage'));
const NewWorkOrder = lazy(() => import('./components/NewWorkOrder'));
const ApprovalPage = lazy(() => import('./pages/ApprovalPage'));
const PublicApprovalPage = lazy(() => import('./pages/PublicApprovalPage'));
const AssignmentDecisionPage = lazy(() => import('./pages/AssignmentDecisionPage'));
const ApprovalPreviewPage = lazy(() => import('./pages/ApprovalPreviewPage'));
const MessagingPage = lazy(() => import('./pages/MessagingPage'));
const LeadForm = lazy(() => import('./pages/LeadForm').then(module => ({ default: module.LeadForm })));
const SmsConsentPage = lazy(() => import('./pages/SmsConsentPage'));
const FileEditorPage = lazy(() => import('./pages/FileEditorPage'));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
  );

// Root layout
const RootLayout = () => (
  <ErrorBoundary>
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
          <ChatTrayProvider>
            <UnreadMessagesProvider>
              <ProtectedRoute />
            </UnreadMessagesProvider>
          </ChatTrayProvider>
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
        <Route path="/approve/:token" element={
          <Suspense fallback={<LoadingSpinner />}>
            <JobDataProvider>
              <AuthProvider>
                <PublicApprovalPage />
              </AuthProvider>
            </JobDataProvider>
          </Suspense>
        } />
        <Route path="/assignment/decision" element={
          <Suspense fallback={<LoadingSpinner />}>
            <AssignmentDecisionPage />
          </Suspense>
        } />
        <Route path="/approval/preview" element={
          <Suspense fallback={<LoadingSpinner />}>
            <ApprovalPreviewPage />
          </Suspense>
        } />
        <Route path="/lead-form/:formId" element={
          <Suspense fallback={<LoadingSpinner />}>
            <LeadForm />
          </Suspense>
        } />
        <Route path="/sms-consent" element={
          <Suspense fallback={<LoadingSpinner />}>
            <SmsConsentPage />
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
          <Route element={<PersistentLayout />}>
            <Route path="/test-alerts" element={
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout>
                  <AlertStackingTest />
                </MainLayout>
              </Suspense>
            } />
            <Route path="/messaging" element={
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout>
                  <MessagingPage />
                </MainLayout>
              </Suspense>
            } />
            <Route path="/dashboard/jobs/:jobId/new-work-order" element={
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout>
                  <NewWorkOrder />
                </MainLayout>
              </Suspense>
            } />
            <Route path="/dashboard/subcontractor/edit/:userId" element={
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout>
                  <SubcontractorEditPage />
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

          {/* Dedicated File Editor Route - Outside PersistentLayout to hide sidebar */}
          <Route path="/file-editor/:fileId" element={
            <Suspense fallback={<LoadingSpinner />}>
              <FileEditorPage />
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
