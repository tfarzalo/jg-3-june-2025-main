import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Save, 
  Users, 
  Calendar, 
  Moon, 
  Sun, 
  User, 
  Monitor,
  LinkIcon,
  Download,
  Bell,
  Info
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useTheme } from './ui/ThemeProvider';
import { toast } from 'sonner';

interface AppSettingsData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  theme_preference: string | null;
  notification_settings: string | null;
}

interface NotificationSettings {
  job_phase_changes: boolean;
  work_orders: boolean;
  callbacks: boolean;
  system_alerts: boolean;
}

export function AppSettings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [settings, setSettings] = useState<AppSettingsData>({
    id: '',
    email: '',
    full_name: '',
    role: 'user',
    theme_preference: 'dark',
    notification_settings: null
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    job_phase_changes: true,
    work_orders: true,
    callbacks: true,
    system_alerts: true
  });

  const [calendarUrls, setCalendarUrls] = useState({
    jobRequests: '',
    workOrders: '',
    allJobs: ''
  });

  const [calendarToken, setCalendarToken] = useState<string | null>(null);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  useEffect(() => {
    if (calendarToken) {
      const baseUrl = window.location.origin;
      setCalendarUrls({
        jobRequests: `${baseUrl}/functions/v1/calendar-feed/job-requests?token=${encodeURIComponent(calendarToken)}`,
        workOrders: `${baseUrl}/functions/v1/calendar-feed/work-orders?token=${encodeURIComponent(calendarToken)}`,
        allJobs: `${baseUrl}/functions/v1/calendar-feed/all-jobs?token=${encodeURIComponent(calendarToken)}`
      });
    }
  }, [calendarToken]);

  useEffect(() => {
    // Apply theme preference when it changes
    if (settings.theme_preference) {
      if (theme !== settings.theme_preference && settings.theme_preference !== 'system') {
        toggleTheme();
      }
    }
  }, [settings.theme_preference, theme, toggleTheme]);

  useEffect(() => {
    // Parse notification settings when settings are loaded
    if (settings.notification_settings) {
      try {
        const parsedSettings = JSON.parse(settings.notification_settings);
        setNotificationSettings(parsedSettings);
      } catch (e) {
        console.error('Error parsing notification settings:', e);
      }
    }
  }, [settings.notification_settings]);

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
          
          setSettings(newProfile as AppSettingsData);
          setNotificationSettings({
            job_phase_changes: true,
            work_orders: true,
            callbacks: true,
            system_alerts: true
          });
        } else {
          throw error;
        }
      } else if (data) {
        setSettings(data);
        setIsAdmin(data.role === 'admin');

        // Parse notification settings
        if (data.notification_settings) {
          try {
            const parsedSettings = JSON.parse(data.notification_settings);
            setNotificationSettings(parsedSettings);
          } catch (e) {
            console.error('Error parsing notification settings:', e);
            // Set default notification settings
            setNotificationSettings({
              job_phase_changes: true,
              work_orders: true,
              callbacks: true,
              system_alerts: true
            });
          }
        } else {
          // Set default notification settings
          setNotificationSettings({
            job_phase_changes: true,
            work_orders: true,
            callbacks: true,
            system_alerts: true
          });
        }
      }

      // Get or create calendar token
      const { data: tokenData, error: tokenError } = await supabase
        .from('calendar_tokens')
        .select('token')
        .eq('user_id', userData.user.id)
        .single();

      if (tokenError && tokenError.code === 'PGRST116') {
        // Token doesn't exist, create one
        const newToken = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from('calendar_tokens')
          .insert([{
            user_id: userData.user.id,
            token: newToken,
            created_at: new Date().toISOString()
          }]);

        if (insertError) throw insertError;
        setCalendarToken(newToken);
      } else if (tokenData) {
        setCalendarToken(tokenData.token);
      }
      
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleThemeChange = (theme: string) => {
    setSettings(prev => ({ ...prev, theme_preference: theme }));
  };

  const handleNotificationSettingChange = (setting: keyof NotificationSettings) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          theme_preference: settings.theme_preference,
          notification_settings: JSON.stringify(notificationSettings)
        })
        .eq('id', settings.id);
        
      if (updateError) throw updateError;
      
      toast.success('Settings updated successfully');
      
      // Apply theme change immediately
      if (settings.theme_preference === 'light' && theme === 'dark') {
        toggleTheme();
      } else if (settings.theme_preference === 'dark' && theme === 'light') {
        toggleTheme();
      }
      
    } catch (err) {
      console.error('Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const copyCalendarUrl = (type: 'jobRequests' | 'workOrders' | 'allJobs') => {
    const url = calendarUrls[type];
    if (url) {
      navigator.clipboard.writeText(url)
        .then(() => toast.success('Calendar URL copied to clipboard'))
        .catch(() => toast.error('Failed to copy URL'));
    }
  };

  const regenerateCalendarToken = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');

      // Generate new token
      const newToken = crypto.randomUUID();
      
      // Update token in database
      const { error: updateError } = await supabase
        .from('calendar_tokens')
        .upsert({
          user_id: userData.user.id,
          token: newToken,
          created_at: new Date().toISOString()
        });

      if (updateError) throw updateError;

      setCalendarToken(newToken);
      
      // Update calendar URLs
      const baseUrl = window.location.origin;
      setCalendarUrls({
        jobRequests: `${baseUrl}/functions/v1/calendar-feed/job-requests?token=${encodeURIComponent(newToken)}`,
        workOrders: `${baseUrl}/functions/v1/calendar-feed/work-orders?token=${encodeURIComponent(newToken)}`,
        allJobs: `${baseUrl}/functions/v1/calendar-feed/all-jobs?token=${encodeURIComponent(newToken)}`
      });

      toast.success('Calendar token regenerated successfully');
    } catch (err) {
      console.error('Error regenerating calendar token:', err);
      toast.error('Failed to regenerate calendar token');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-4xl mx-auto">
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">User Information</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={settings.email}
                  readOnly
                  className="w-full h-11 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={settings.full_name || ''}
                  readOnly
                  className="w-full h-11 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Edit your name in the Profile page</p>
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Role
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    id="role"
                    name="role"
                    value={settings.role}
                    readOnly
                    className="w-full h-11 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Role can only be changed by an admin</p>
              </div>
            </div>
          </div>

          {/* Theme Preferences */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Theme Preferences</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
                  Choose Theme
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <div 
                    className={`flex flex-col items-center p-4 rounded-lg cursor-pointer border-2 ${
                      settings.theme_preference === 'light' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                    onClick={() => handleThemeChange('light')}
                  >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-2 shadow">
                      <Sun className="h-6 w-6 text-yellow-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Light</span>
                  </div>
                  
                  <div 
                    className={`flex flex-col items-center p-4 rounded-lg cursor-pointer border-2 ${
                      settings.theme_preference === 'dark' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                    onClick={() => handleThemeChange('dark')}
                  >
                    <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mb-2 shadow">
                      <Moon className="h-6 w-6 text-gray-300" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Dark</span>
                  </div>
                  
                  <div 
                    className={`flex flex-col items-center p-4 rounded-lg cursor-pointer border-2 ${
                      settings.theme_preference === 'system' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                    onClick={() => handleThemeChange('system')}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-white to-gray-900 rounded-full flex items-center justify-center mb-2 shadow">
                      <Monitor className="h-6 w-6 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">System</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <div className="flex items-center mb-6">
              <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Job Phase Changes</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Receive notifications when a job changes phase
                  </p>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${
                    notificationSettings.job_phase_changes ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                  onClick={() => handleNotificationSettingChange('job_phase_changes')}
                >
                  <div 
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      notificationSettings.job_phase_changes ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Work Order Updates</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Receive notifications about work order updates
                  </p>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${
                    notificationSettings.work_orders ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                  onClick={() => handleNotificationSettingChange('work_orders')}
                >
                  <div 
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      notificationSettings.work_orders ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Callbacks</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Receive notifications about property callbacks
                  </p>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${
                    notificationSettings.callbacks ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                  onClick={() => handleNotificationSettingChange('callbacks')}
                >
                  <div 
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      notificationSettings.callbacks ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">System Alerts</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Receive important system notifications and alerts
                  </p>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${
                    notificationSettings.system_alerts ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                  onClick={() => handleNotificationSettingChange('system_alerts')}
                >
                  <div 
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      notificationSettings.system_alerts ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Sync */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Calendar Sync</h2>
              <button
                type="button"
                onClick={regenerateCalendarToken}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                Regenerate Token
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  All Upcoming Job Requests
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={calendarUrls.jobRequests}
                    readOnly
                    className="flex-1 h-11 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#2D3B4E] rounded-l-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => copyCalendarUrl('jobRequests')}
                    className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg transition-colors"
                  >
                    <LinkIcon className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Sync all upcoming job requests to your calendar
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  All Work Orders
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={calendarUrls.workOrders}
                    readOnly
                    className="flex-1 h-11 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#2D3B4E] rounded-l-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => copyCalendarUrl('workOrders')}
                    className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg transition-colors"
                  >
                    <LinkIcon className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Sync all work orders to your calendar
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  All Jobs
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={calendarUrls.allJobs}
                    readOnly
                    className="flex-1 h-11 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#2D3B4E] rounded-l-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => copyCalendarUrl('allJobs')}
                    className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg transition-colors"
                  >
                    <LinkIcon className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Sync all jobs (both requests and work orders) to your calendar
                </p>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      How to Add to Your Calendar
                    </p>
                    <div className="mt-2 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Google Calendar</p>
                        <ol className="mt-1 text-sm text-blue-700 dark:text-blue-300 list-decimal pl-5 space-y-1">
                          <li>Open Google Calendar</li>
                          <li>Click the + next to "Other calendars"</li>
                          <li>Select "From URL"</li>
                          <li>Paste the calendar URL</li>
                          <li>Click "Add calendar"</li>
                        </ol>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Apple Calendar</p>
                        <ol className="mt-1 text-sm text-blue-700 dark:text-blue-300 list-decimal pl-5 space-y-1">
                          <li>Open Calendar app</li>
                          <li>Go to File → New Calendar Subscription</li>
                          <li>Paste the calendar URL</li>
                          <li>Click "Subscribe"</li>
                          <li>Choose your preferences and click "OK"</li>
                        </ol>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-800/30 rounded">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> Your calendar links are permanent and will continue to work. If you need to revoke access, click the "Regenerate Token" button above.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow border-l-4 border-purple-500">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <Users className="h-5 w-5 mr-2 text-purple-500" />
                Admin Settings
              </h2>
              
              <div className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                  As an administrator, you have access to additional settings and user management features.
                </p>
                
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/users')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Manage Users
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/settings/roles')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Manage Roles
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}