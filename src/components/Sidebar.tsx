import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutGrid, 
  ClipboardList, 
  FileText, 
  Star, 
  DollarSign, 
  CheckCircle, 
  XCircle,
  Building2,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Users,
  FolderOpen,
  Upload,
  Calendar as CalendarIcon,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  ArrowRight,
  UserCog,
  CalendarDays,
  Archive
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useTheme } from './ui/ThemeProvider';
import { useUserRole } from '../hooks/useUserRole';
import { toast } from 'sonner';

interface NavItem {
  icon: React.ElementType;
  label: string;
  to: string;
  dataTutorial?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAdmin, isJGManagement, isSubcontractor } = useUserRole();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    DASHBOARD: true,
    'JOB MANAGEMENT': true,
    PROPERTIES: true,
    'FILE MANAGEMENT': true,
    'JG USERS': true,
    CALENDAR: true,
    ACTIVITY: true,
    SETTINGS: true
  });

  // Define navigation items based on user role
  const getNavGroups = (): NavGroup[] => {
    // Subcontractor view is simplified
    if (isSubcontractor) {
      return [
        {
          title: 'DASHBOARD',
          items: [
            { icon: LayoutGrid, label: 'Dashboard', to: '/dashboard/subcontractor' },
          ]
        },
        {
          title: 'SETTINGS',
          items: [
            { icon: UserCog, label: 'Profile', to: '/dashboard/profile' },
            { icon: Settings, label: 'Settings', to: '/dashboard/settings' },
          ]
        }
      ];
    }

    // Regular admin/management view
    return [
      {
        title: 'DASHBOARD',
        items: [
          { icon: LayoutGrid, label: 'Dashboard', to: '/dashboard', dataTutorial: 'dashboard' },
        ]
      },
      {
        title: 'JOB MANAGEMENT',
        items: [
          { icon: ClipboardList, label: 'All Jobs', to: '/dashboard/jobs', dataTutorial: 'jobs' },
          { icon: FileText, label: 'Job Requests', to: '/dashboard/jobs/requests' },
          { icon: FileText, label: 'Work Orders', to: '/dashboard/jobs/work-orders' },
          { icon: DollarSign, label: 'Invoicing', to: '/dashboard/jobs/invoicing' },
          { icon: CheckCircle, label: 'Completed', to: '/dashboard/jobs/completed' },
          { icon: XCircle, label: 'Cancelled', to: '/dashboard/jobs/cancelled' },
          { icon: Archive, label: 'Archives', to: '/dashboard/jobs/archives' },
          { icon: CalendarDays, label: 'Sub Scheduler', to: '/dashboard/sub-scheduler' },
        ]
      },
      {
        title: 'PROPERTIES',
        items: [
          { icon: Building2, label: 'Properties', to: '/dashboard/properties', dataTutorial: 'properties' },
          { icon: Building2, label: 'Property Groups', to: '/dashboard/property-groups' },
        ]
      },
      {
        title: 'FILE MANAGEMENT',
        items: [
          { icon: FolderOpen, label: 'Files', to: '/dashboard/files', dataTutorial: 'files' },
          { icon: Upload, label: 'Upload File', to: '/dashboard/files/upload' },
        ]
      },
      {
        title: 'JG USERS',
        items: [
          { icon: Users, label: 'Users', to: '/dashboard/users', dataTutorial: 'users' },
        ]
      },
      {
        title: 'CALENDAR',
        items: [
          { icon: CalendarIcon, label: 'Calendar', to: '/dashboard/calendar', dataTutorial: 'calendar' },
        ]
      },
      {
        title: 'ACTIVITY',
        items: [
          { icon: Activity, label: 'Activity Log', to: '/dashboard/activity', dataTutorial: 'activity' },
        ]
      },
      {
        title: 'SETTINGS',
        items: [
          { icon: UserCog, label: 'Profile', to: '/dashboard/profile' },
          { icon: Settings, label: 'Settings', to: '/dashboard/settings', dataTutorial: 'settings' },
        ]
      }
    ];
  };

  const navGroups = getNavGroups();

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const handleLogout = async () => {
    if (loggingOut) return; // Prevent multiple clicks
    
    setLoggingOut(true);
    
    try {
      // Check if online
      if (!navigator.onLine) {
        toast.error('You appear to be offline. Please check your internet connection and try again.');
        setLoggingOut(false);
        return;
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        toast.error('Error signing out. Please try again.');
      } else {
        // Only navigate after successful sign out
        navigate('/auth');
      }
    } catch (err) {
      console.error('Error during logout:', err);
      toast.error('Error during logout. Please try again.');
      // Still try to navigate to auth page even if there's an error
      navigate('/auth');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-[#0F172A] border-r border-gray-200 dark:border-[#1E293B] flex flex-col transition-all duration-300`}>
      <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-[#1E293B]">
        {!isCollapsed ? (
          <img 
            src="https://tbwtfimnbmvbgesidbxh.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1750132407578_jg-logo-icon.png" 
            alt="JG Painting" 
            className="h-12 w-auto"
          />
        ) : (
          <img 
            src="https://tbwtfimnbmvbgesidbxh.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1750132407578_jg-logo-icon.png" 
            alt="JG Painting" 
            className="h-8 w-auto"
          />
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white ml-2"
        >
          {isCollapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-2">
            {!isCollapsed && (
              <button
                onClick={() => toggleSection(group.title)}
                className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
              >
                <span>{group.title}</span>
                {expandedSections[group.title] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {(!isCollapsed && expandedSections[group.title] || isCollapsed) && (
              <div className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-600 dark:text-white'
                          : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1E293B] hover:text-gray-900 dark:hover:text-white'
                      }`
                    }
                    title={isCollapsed ? item.label : undefined}
                    data-tutorial={item.dataTutorial}
                  >
                    <item.icon className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5 mr-3'}`} />
                    {!isCollapsed && item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-[#1E293B]">
        <button 
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-full rounded-lg hover:bg-gray-100 dark:hover:bg-[#1E293B] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5 mr-3'}`} />
          {!isCollapsed && (loggingOut ? 'Logging out...' : 'Logout')}
        </button>
        {!isCollapsed && (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-600">
            Copyright 2025 JG Portal V2.0
          </div>
        )}
      </div>
    </div>
  );
}