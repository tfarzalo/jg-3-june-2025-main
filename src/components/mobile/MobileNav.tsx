import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  ClipboardList,
  FileText,
  Building2,
  Users,
  Calendar as CalendarIcon,
  Activity,
  Settings,
  MessageCircle,
  HelpCircle,
  FolderOpen,
  UserCog,
  DollarSign,
  CheckCircle,
  XCircle,
  Archive
} from 'lucide-react';
import { useUserRole } from '../../contexts/UserRoleContext';
import { useUnreadMessages } from '../../contexts/UnreadMessagesProvider';

interface MobileNavProps {
  onClose: () => void;
}

export function MobileNav({ onClose }: MobileNavProps) {
  const { isAdmin, isJGManagement, isSubcontractor } = useUserRole();
  const { unreadCount } = useUnreadMessages();

  const getIconColor = (label: string) => {
    switch (label) {
      case 'Dashboard': return '#276EF1';
      case 'All Jobs': return '#8A9BA8';
      case 'Job Requests': return '#276EF1';
      case 'Work Orders': return '#E95420';
      case 'Pending Work Orders': return '#FBBF24';
      case 'Invoicing': return '#00A878';
      case 'Completed': return '#F47C7C';
      case 'Cancelled': return '#6C6C6C';
      case 'Archives': return '#5A5A5A';
      case 'Properties': return '#009688';
      case 'Property Mgmt Groups': return '#009688';
      case 'File Manager': return '#D64527';
      case 'Users': return '#A0522D';
      case 'Messaging': return '#1E40AF';
      case 'Calendar': return '#E91E63';
      case 'Activity Log': return '#3F51B5';
      case 'Admin Settings': return '#9E9E9E';
      case 'Contacts': return '#7C3AED';
      case 'Support': return '#F59E0B';
      default: return '#9E9E9E';
    }
  };

  // Subcontractor navigation
  if (isSubcontractor) {
    return (
      <nav className="space-y-1">
        <NavLink
          to="/dashboard/subcontractor"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <LayoutGrid className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Dashboard') }} />
          <span className="truncate">Dashboard</span>
        </NavLink>
      </nav>
    );
  }

  // Admin/Management navigation
  return (
    <nav className="space-y-6">
      {/* Dashboard */}
      <div className="space-y-1">
        <div className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Dashboard
        </div>
        <NavLink
          to="/dashboard"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <LayoutGrid className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Dashboard') }} />
          <span className="truncate">Dashboard</span>
        </NavLink>
      </div>

      {/* Job Management */}
      <div className="space-y-1">
        <div className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Job Management
        </div>
        <NavLink
          to="/dashboard/jobs"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <ClipboardList className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('All Jobs') }} />
          <span className="truncate">All Jobs</span>
        </NavLink>
        <NavLink
          to="/dashboard/jobs/requests"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <FileText className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Job Requests') }} />
          <span className="truncate">Job Requests</span>
        </NavLink>
        <NavLink
          to="/dashboard/jobs/work-orders"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <FileText className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Work Orders') }} />
          <span className="truncate">Work Orders</span>
        </NavLink>
        <NavLink
          to="/dashboard/jobs/pending-work-orders"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <FileText className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Pending Work Orders') }} />
          <span className="truncate">Pending Work Orders</span>
        </NavLink>
        <NavLink
          to="/dashboard/jobs/invoicing"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <DollarSign className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Invoicing') }} />
          <span className="truncate">Invoicing</span>
        </NavLink>
        <NavLink
          to="/dashboard/jobs/completed"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Completed') }} />
          <span className="truncate">Completed</span>
        </NavLink>
        <NavLink
          to="/dashboard/jobs/cancelled"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <XCircle className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Cancelled') }} />
          <span className="truncate">Cancelled</span>
        </NavLink>
        <NavLink
          to="/dashboard/jobs/archives"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <Archive className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Archives') }} />
          <span className="truncate">Archives</span>
        </NavLink>
      </div>

      {/* Properties */}
      <div className="space-y-1">
        <div className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Properties
        </div>
        <NavLink
          to="/dashboard/properties"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <Building2 className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Properties') }} />
          <span className="truncate">Properties</span>
        </NavLink>
        <NavLink
          to="/dashboard/property-groups"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <Building2 className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Property Mgmt Groups') }} />
          <span className="truncate">Property Mgmt Groups</span>
        </NavLink>
      </div>

      {/* File Management */}
      <div className="space-y-1">
        <div className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Files
        </div>
        <NavLink
          to="/dashboard/files"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <FolderOpen className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('File Manager') }} />
          <span className="truncate">File Manager</span>
        </NavLink>
      </div>

      {/* Communication */}
      <div className="space-y-1">
        <div className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Communication
        </div>
        <NavLink
          to="/dashboard/users"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <Users className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Users') }} />
          <span className="truncate">Users</span>
        </NavLink>
        <NavLink
          to="/messaging"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors relative ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <MessageCircle className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Messaging') }} />
          <span className="truncate">Messaging</span>
          {unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </NavLink>
        <NavLink
          to="/dashboard/contacts"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <UserCog className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Contacts') }} />
          <span className="truncate">Contacts</span>
        </NavLink>
      </div>

      {/* Other */}
      <div className="space-y-1">
        <div className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Other
        </div>
        <NavLink
          to="/dashboard/calendar"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <CalendarIcon className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Calendar') }} />
          <span className="truncate">Calendar</span>
        </NavLink>
        <NavLink
          to="/dashboard/activity"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <Activity className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Activity Log') }} />
          <span className="truncate">Activity Log</span>
        </NavLink>
        <NavLink
          to="/dashboard/support"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
            }`
          }
        >
          <HelpCircle className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Support') }} />
          <span className="truncate">Support</span>
        </NavLink>
        {isAdmin && (
          <NavLink
            to="/dashboard/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]'
              }`
            }
          >
            <Settings className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: getIconColor('Admin Settings') }} />
            <span className="truncate">Admin Settings</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}
