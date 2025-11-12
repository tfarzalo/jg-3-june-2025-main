import React from 'react';
import { useAuth } from '@/contexts/AuthProvider';
import { Dashboard } from './components/Dashboard';
import { MainLayout } from './components/ui/MainLayout';

export function AppContent() {
  const { session, initializing } = useAuth();

  // Don't render anything while auth is initializing
  if (initializing) {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If no session, show auth message
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🔐 Authentication Required</h1>
          <p className="text-gray-600 mb-4">Please log in to access the application.</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // User is authenticated - render the dashboard with full layout
  return (
    <MainLayout>
      <Dashboard />
    </MainLayout>
  );
}
