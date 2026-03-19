import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Users, 
  Mail,
  Calendar,
  Bell,
  FileText,
  LayoutDashboard,
  Briefcase,
  Ruler,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { EmailTemplateManager } from './EmailTemplateManager';
import { LeadFormBuilder } from './LeadFormBuilder';
import { DailyAgendaEmailSettings } from './DailyAgendaEmailSettings';
import { JobImportManager } from './admin/JobImportManager';
import { JobCategoryManager } from './admin/JobCategoryManager';
import { UnitSizeManager } from './admin/UnitSizeManager';
import { useUserRole } from '../hooks/useUserRole';
import { MaintenancePage } from './MaintenancePage';

interface AppSettingsData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}


export function AppSettings() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'email-templates' | 'lead-forms' | 'daily-agenda' | 'users' | 'sub-assignment-alerts' | 'bulk-schedule' | 'job-categories' | 'unit-sizes' | 'maintenance'>('overview');
  const [subAssignmentRecipients, setSubAssignmentRecipients] = useState<string[]>([]);
  const [adminOptions, setAdminOptions] = useState<AppSettingsData[]>([]);

  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    'We are currently performing scheduled maintenance. We will be back shortly.'
  );
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceFetching, setMaintenanceFetching] = useState(true);
  const [showMaintenancePreview, setShowMaintenancePreview] = useState(false);

  // Password confirmation modal state (for toggling maintenance mode)
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwModalPending, setPwModalPending] = useState<boolean | null>(null); // next toggle value
  const [pwInput, setPwInput] = useState('');
  const [showPwInput, setShowPwInput] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwConfirming, setPwConfirming] = useState(false);
  const MAINTENANCE_PASSWORD = 'SquireBoy40!';

  useEffect(() => {
    fetchUserSettings();
    fetchSubAssignmentRecipients();
    fetchMaintenanceConfig();
  }, []);

  // Redirect users who are neither admin nor super admin
  useEffect(() => {
    if (!roleLoading && !isAdmin && !isSuperAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, isSuperAdmin, roleLoading, navigate]);


  const fetchUserSettings = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');
      
      // Get profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Profile not found, create a new one
          const newProfile = {
            id: userData.user.id,
            email: userData.user.email,
            full_name: userData.user.user_metadata?.full_name || '',
            role: 'user',
            theme_preference: 'dark',
            notification_settings: JSON.stringify({
              job_phase_changes: true,
              work_orders: true,
              callbacks: true,
              system_alerts: true
            })
          };
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([newProfile]);
            
          if (insertError) throw insertError;
        } else {
          throw error;
        }
      }
      
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };



  const fetchSubAssignmentRecipients = async () => {
    try {
      const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'jg_management'])
        .order('full_name');
      if (adminError) throw adminError;
      setAdminOptions(admins || []);

      const { data: recipients, error: recError } = await supabase
        .from('sub_assignment_notification_recipients')
        .select('user_id');
      if (recError) throw recError;
      setSubAssignmentRecipients((recipients || []).map(r => r.user_id));
    } catch (err) {
      console.error('Error loading sub assignment recipients', err);
      toast.error('Failed to load sub assignment recipients');
    }
  };

  const fetchMaintenanceConfig = async () => {
    try {
      setMaintenanceFetching(true);
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single();
      if (error) throw error;
      if (data?.value) {
        setMaintenanceEnabled(data.value.enabled === true);
        if (data.value.message) setMaintenanceMessage(data.value.message);
      }
    } catch (err) {
      console.error('Error loading maintenance config:', err);
      toast.error('Failed to load maintenance settings');
    } finally {
      setMaintenanceFetching(false);
    }
  };

  const saveMaintenanceConfig = async (enabled: boolean, message: string) => {
    try {
      setMaintenanceLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('app_config')
        .update({
          value: { enabled, message },
          updated_at: new Date().toISOString(),
          updated_by: userData.user?.id ?? null,
        })
        .eq('key', 'maintenance_mode');
      if (error) throw error;
      setMaintenanceEnabled(enabled);
      setMaintenanceMessage(message);
      toast.success(
        enabled
          ? 'Maintenance mode enabled — non-admin users will see the maintenance overlay.'
          : 'Maintenance mode disabled — all users can access the app.'
      );
    } catch (err) {
      console.error('Error saving maintenance config:', err);
      toast.error('Failed to update maintenance settings');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const toggleRecipient = async (userId: string) => {    try {
      const exists = subAssignmentRecipients.includes(userId);
      if (exists) {
        const { error } = await supabase
          .from('sub_assignment_notification_recipients')
          .delete()
          .eq('user_id', userId);
        if (error) throw error;
        setSubAssignmentRecipients(prev => prev.filter(id => id !== userId));
      } else {
        const { error } = await supabase
          .from('sub_assignment_notification_recipients')
          .insert({ user_id: userId });
        if (error) throw error;
        setSubAssignmentRecipients(prev => [...prev, userId]);
      }
      toast.success('Notification recipients updated');
    } catch (err) {
      console.error('Error updating recipients', err);
      toast.error('Failed to update recipients');
    }
  };



  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Settings className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Application Settings</h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Navigation */}
          <div className="col-span-12 md:col-span-3">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <LayoutDashboard className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'overview' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('email-templates')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'email-templates'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <Mail className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'email-templates' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Email Templates</span>
              </button>

              <button
                onClick={() => setActiveTab('lead-forms')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'lead-forms'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <Users className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'lead-forms' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Lead Forms</span>
              </button>

              <button
                onClick={() => setActiveTab('daily-agenda')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'daily-agenda'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <Calendar className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'daily-agenda' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Daily Agenda Emails</span>
              </button>

              <button
                onClick={() => setActiveTab('job-categories')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'job-categories'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <Briefcase className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'job-categories' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Job Categories</span>
              </button>

              <button
                onClick={() => setActiveTab('unit-sizes')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'unit-sizes'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <Ruler className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'unit-sizes' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Unit Sizes</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'users'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <Users className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'users' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">User Management</span>
              </button>

              <button
                onClick={() => setActiveTab('sub-assignment-alerts')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'sub-assignment-alerts'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <Bell className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'sub-assignment-alerts' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Sub Assignment Alerts</span>
              </button>

              <button
                onClick={() => setActiveTab('bulk-schedule')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'bulk-schedule'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <FileText className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'bulk-schedule' ? 'text-blue-700 dark:text-blue-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Bulk Schedule</span>
              </button>

              <button
                onClick={() => setActiveTab('maintenance')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'maintenance'
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <ShieldAlert className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                  activeTab === 'maintenance' ? 'text-red-600 dark:text-red-200' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">Maintenance Mode</span>
              </button>
            </nav>
          </div>

          {/* Content Area */}
          <div className="col-span-12 md:col-span-9">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                    System Settings Overview
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    Manage your application's core configurations and administrative preferences from a centralized dashboard. 
                    Use the sidebar navigation to customize email communications, manage user access, configure automated reports, and oversee system integrations.
                  </p>
                  
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg flex items-start">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full mr-4 flex-shrink-0">
                      <Settings className="h-5 w-5 text-blue-600 dark:text-blue-200" />
                    </div>
                    <div>
                      <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Administrative Control</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Select a category from the left menu to view and modify specific settings. 
                        Changes made here affect system-wide behavior and should be managed with care.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Email Templates Tab */}
            {activeTab === 'email-templates' && (
              <EmailTemplateManager />
            )}

            {/* Lead Forms Tab */}
            {activeTab === 'lead-forms' && (
              <LeadFormBuilder />
            )}

            {/* Daily Agenda Tab */}
            {activeTab === 'daily-agenda' && (
              <DailyAgendaEmailSettings />
            )}

            {/* Job Categories Tab */}
            {activeTab === 'job-categories' && (
              <JobCategoryManager />
            )}

            {/* Unit Sizes Tab */}
            {activeTab === 'unit-sizes' && (
              <UnitSizeManager />
            )}

            {/* User Management Tab */}
            {activeTab === 'users' && (
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <Users className="h-5 w-5 mr-2 text-purple-500" />
                    User Management
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300">
                    Manage user accounts, roles, and permissions. User roles (Admin, JG Management, Subcontractor) can be assigned when creating or editing users.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/users')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Go to User Management
                  </button>
                </div>
              </div>
            )}

            {/* Sub Assignment Alerts Tab */}
            {activeTab === 'sub-assignment-alerts' && (
              <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <Bell className="h-5 w-5 mr-2 text-yellow-500" />
                    Sub Assignment Notifications
                  </h2>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Toggle which Admin and JG Management users receive emails and in-app notifications when a subcontractor accepts or declines an assignment.
                  </p>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {adminOptions.map(user => {
                    const isOn = subAssignmentRecipients.includes(user.id);
                    return (
                      <div key={user.id} className="flex items-center justify-between px-6 py-4">
                        <div>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">{user.full_name || user.email}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Admin</span>
                          <button
                            type="button"
                            onClick={() => toggleRecipient(user.id)}
                            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${isOn ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {adminOptions.length === 0 && (
                    <div className="p-6 text-sm text-gray-500">No admin or JG Management users found.</div>
                  )}
                </div>
              </div>
            )}

            {/* Bulk Schedule Tab */}
            {activeTab === 'bulk-schedule' && (
              <JobImportManager />
            )}

            {/* Maintenance Mode Tab */}
            {activeTab === 'maintenance' && (
              <div className="space-y-6">
                {/* Super-admin-only warning banner */}
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg">
                  <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      Super Admin–only feature
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                      When enabled, <strong>all users</strong> — including admins — will see the maintenance overlay. Only the super admin account can bypass it. A password is required to toggle this setting.
                    </p>
                  </div>
                </div>

                {/* Toggle card */}
                <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                      Maintenance Mode
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Use this toggle to put the application into maintenance mode during deployments, data migrations, or scheduled downtime.
                    </p>
                  </div>

                  <div className="p-6 space-y-6">
                    {maintenanceFetching ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        Loading maintenance settings…
                      </div>
                    ) : (
                      <>
                        {/* On/Off toggle — requires password confirmation */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">
                              Maintenance Mode
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {maintenanceEnabled
                                ? 'Currently ON — all users see the maintenance overlay.'
                                : 'Currently OFF — all users can access the application.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={maintenanceLoading}
                            onClick={() => {
                              setPwModalPending(!maintenanceEnabled);
                              setPwInput('');
                              setPwError(null);
                              setShowPwInput(false);
                              setShowPwModal(true);
                            }}
                            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors disabled:opacity-60 ${
                              maintenanceEnabled ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                maintenanceEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Status indicator */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full w-fit text-sm font-medium ${
                          maintenanceEnabled
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40'
                            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/40'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${maintenanceEnabled ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                          {maintenanceEnabled ? 'Maintenance active' : 'Application live'}
                        </div>

                        {/* Custom message */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Maintenance message
                            <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">(shown to users on the overlay)</span>
                          </label>
                          <textarea
                            value={maintenanceMessage}
                            onChange={(e) => setMaintenanceMessage(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="We are currently performing scheduled maintenance. We will be back shortly."
                          />
                        </div>

                        {/* Save message + Preview buttons */}
                        <div className="flex items-center gap-3 pt-2 flex-wrap">
                          <button
                            type="button"
                            disabled={maintenanceLoading}
                            onClick={() => saveMaintenanceConfig(maintenanceEnabled, maintenanceMessage)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            {maintenanceLoading ? 'Saving…' : 'Save message'}
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setShowMaintenancePreview(true)}
                              className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-300 text-sm font-medium rounded-lg transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                              Preview overlay
                            </button>
                          )}
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Changes take effect immediately for all connected users.
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Maintenance Overlay Preview Modal ── */}
                {showMaintenancePreview && (
                  <MaintenancePage
                    message={maintenanceMessage}
                    isPreview
                    onClosePreview={() => setShowMaintenancePreview(false)}
                  />
                )}

                {/* ── Password Confirmation Modal ── */}
                {showPwModal && (
                  <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                      onClick={() => { setShowPwModal(false); setPwError(null); }}
                    />

                    {/* Panel */}
                    <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-700/60 bg-[#0F172A] shadow-2xl p-6 space-y-5">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-900/30 border border-red-700/40">
                          <Lock className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white leading-tight">Confirm Action</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {pwModalPending
                              ? 'You are about to enable maintenance mode.'
                              : 'You are about to disable maintenance mode.'}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {pwModalPending
                          ? 'All users (including admins) will be shown the maintenance overlay. Only the super admin can access the app while this is active.'
                          : 'All users will regain access to the application immediately.'}
                      </p>

                      {/* Password input */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Enter super admin password to confirm
                        </label>
                        <div className="relative">
                          <input
                            type={showPwInput ? 'text' : 'password'}
                            autoFocus
                            autoComplete="current-password"
                            value={pwInput}
                            onChange={e => { setPwInput(e.target.value); setPwError(null); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (pwInput === MAINTENANCE_PASSWORD && pwModalPending !== null) {
                                  setPwConfirming(true);
                                  saveMaintenanceConfig(pwModalPending, maintenanceMessage).then(() => {
                                    setShowPwModal(false);
                                    setPwInput('');
                                    setPwConfirming(false);
                                  });
                                } else {
                                  setPwError('Incorrect password. Please try again.');
                                }
                              }
                            }}
                            placeholder="Password"
                            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwInput(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            {showPwInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {pwError && (
                          <p className="mt-1.5 text-xs text-red-400">{pwError}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3 pt-1">
                        <button
                          type="button"
                          disabled={pwConfirming}
                          onClick={() => { setShowPwModal(false); setPwError(null); setPwInput(''); }}
                          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-600/60 bg-slate-800/60 hover:bg-slate-700/60 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={pwConfirming || !pwInput}
                          onClick={() => {
                            if (pwInput !== MAINTENANCE_PASSWORD) {
                              setPwError('Incorrect password. Please try again.');
                              return;
                            }
                            if (pwModalPending === null) return;
                            setPwConfirming(true);
                            saveMaintenanceConfig(pwModalPending, maintenanceMessage).then(() => {
                              setShowPwModal(false);
                              setPwInput('');
                              setPwConfirming(false);
                            });
                          }}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                            pwModalPending
                              ? 'bg-red-600 hover:bg-red-500'
                              : 'bg-green-600 hover:bg-green-500'
                          }`}
                        >
                          {pwConfirming
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</>
                            : pwModalPending ? 'Enable Maintenance' : 'Disable Maintenance'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
