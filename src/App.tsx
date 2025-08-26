import React, { lazy, Suspense } from 'react';
import { 
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route
} from 'react-router-dom';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { unregisterOldServiceWorkers } from './utils/sw-cleanup';

// Lazy load main components for better code splitting
const AppContent = lazy(() => import('./AppContent').then(module => ({ 
  default: module.AppContent 
})));

const NotFound = lazy(() => import('./pages/NotFound'));
const Health = lazy(() => import('./pages/Health'));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
);

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-red-600 mb-4">Application Error</h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Create router with SPA fallback handling
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Health check endpoint */}
      <Route path="/healthz" element={
        <Suspense fallback={<LoadingSpinner />}>
          <Health />
        </Suspense>
      } />
      
      {/* NotFound catch-all route */}
      <Route path="/404" element={
        <Suspense fallback={<LoadingSpinner />}>
          <NotFound />
        </Suspense>
      } />
      
      {/* Main app routes */}
      <Route path="*" element={
        <Suspense fallback={<LoadingSpinner />}>
          <ErrorBoundary>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ErrorBoundary>
        </Suspense>
      } />
    </>
  ),
  {
    // Use basename from environment for subpath deployments
    basename: import.meta.env.VITE_BASE_PATH || '/',
    
    // Future flags for React Router v7 compatibility
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true
    }
  }
);

function App() {
  // Clean up old service workers and caches on app start
  React.useEffect(() => {
    unregisterOldServiceWorkers();
  }, []);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;