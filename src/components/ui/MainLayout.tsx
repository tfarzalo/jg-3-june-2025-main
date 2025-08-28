import React, { Suspense } from 'react';
import { Sidebar } from '../Sidebar';
import Topbar from './Topbar';
import { useUserRole } from '../../contexts/UserRoleContext';
import { usePresence } from '../../hooks/usePresence';
import { useLastSeen } from '../../hooks/useLastSeen';
import { UserLoginAlertManager } from '../UserLoginAlertManager';
import { HealthCheck } from '../HealthCheck';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const { isSubcontractor } = useUserRole();
  
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
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A]">
      {/* Health Check */}
      <HealthCheck />
      
      {/* User Login Alerts */}
      <UserLoginAlertManager />
      
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
          <span>You are currently offline. Some features may not work properly.</span>
        </div>
      )}
      
      {isSubcontractor ? (
        // Simplified layout for subcontractors
        <div className="flex flex-col h-screen">
          <Topbar showOnlyProfile={true} />
          <main className="flex-1 overflow-auto bg-gray-100 dark:bg-[#0F172A]">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              {children}
            </Suspense>
          </main>
        </div>
      ) : (
        // Regular layout for other roles
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-auto bg-gray-100 dark:bg-[#0F172A]">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              }>
                {children}
              </Suspense>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}