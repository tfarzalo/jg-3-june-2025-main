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

const AppContent = lazy(() => import('./AppContent').then(module => ({ 
  default: module.AppContent 
})));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
);

// Create router with future flags
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="*" element={
      <Suspense fallback={<LoadingSpinner />}>
        <AppContent />
      </Suspense>
    } />
  ),
  {
    future: {
      v7_relativeSplatPath: true
    }
  }
);

function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

export default App;