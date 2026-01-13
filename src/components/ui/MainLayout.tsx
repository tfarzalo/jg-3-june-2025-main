import React, { Suspense } from 'react';
import { usePresence } from '../../hooks/usePresence';
import { useLastSeen } from '../../hooks/useLastSeen';
import { UserLoginAlertManager } from '../UserLoginAlertManager';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  
  // Initialize presence and last seen tracking
  usePresence();
  useLastSeen();
  
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* User Login Alerts */}
      <UserLoginAlertManager />
      
      {/* Offline Status */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
          <span>You are currently offline. Some features may not work properly.</span>
        </div>
      )}
      
      {/* Page Content */}
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }>
        {children}
      </Suspense>
    </>
  );
}