import React from 'react';
import { Outlet } from 'react-router-dom';
import { useMaintenanceMode } from '../contexts/MaintenanceModeContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { MaintenancePage } from './MaintenancePage';

/**
 * MaintenanceGate
 *
 * Sits inside the ProtectedLayout provider tree (after auth + role are resolved).
 * - Only users with role = 'is_super_admin' bypass the maintenance overlay.
 * - All other users (including admins) see the MaintenancePage when maintenance is ON.
 * - While the maintenance flag is still loading, renders the Outlet so normal
 *   loading spinners inside each protected page handle the visual wait.
 */
export function MaintenanceGate() {
  const { isMaintenanceMode, maintenanceMessage, loading: maintenanceLoading } = useMaintenanceMode();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();

  // Wait for both maintenance flag and role to resolve before making a decision.
  if (maintenanceLoading || roleLoading) {
    return <Outlet />;
  }

  // Only the super admin bypasses maintenance mode
  if (isMaintenanceMode && !isSuperAdmin) {
    return <MaintenancePage message={maintenanceMessage} />;
  }

  return <Outlet />;
}
