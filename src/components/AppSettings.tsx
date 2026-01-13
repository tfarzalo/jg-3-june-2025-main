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
  Ruler
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

interface AppSettingsData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}


export function AppSettings() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'email-templates' | 'lead-forms' | 'daily-agenda' | 'users' | 'sub-assignment-alerts' | 'bulk-schedule' | 'job-categories' | 'unit-sizes'>('overview');
  const [subAssignmentRecipients, setSubAssignmentRecipients] = useState<string[]>([]);
  const [adminOptions, setAdminOptions] = useState<AppSettingsData[]>([]);

  useEffect(() => {
    fetchUserSettings();
    fetchSubAssignmentRecipients();
  }, []);

  // Redirect non-admin users
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, roleLoading, navigate]);


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

  const toggleRecipient = async (userId: string) => {
    try {
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
  if (!isAdmin) {
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
          </div>
        </div>
      </div>
    </div>
  );
}
