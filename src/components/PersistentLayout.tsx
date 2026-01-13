import React from 'react';
import { Outlet } from 'react-router-dom';
import Topbar from './ui/Topbar';
import { Sidebar } from './Sidebar';
import { useUserRole } from '../contexts/UserRoleContext';

export function PersistentLayout() {
  const { isSubcontractor } = useUserRole();
  
  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar - Hidden on mobile */}
      {!isSubcontractor && (
        <div className="hidden lg:block">
          <Sidebar />
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar showOnlyProfile={isSubcontractor} />
        <main className="flex-1 overflow-auto bg-gray-100 dark:bg-[#0F172A]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
