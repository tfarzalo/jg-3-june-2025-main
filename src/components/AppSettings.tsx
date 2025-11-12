import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Save, 
  Users, 
  Download,
  Info,
  Mail
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { EmailTemplateManager } from './EmailTemplateManager';
import { LeadFormBuilder } from './LeadFormBuilder';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<AppSettingsData>({
    id: '',
    email: '',
    full_name: '',
    role: 'user'
  });

  const [showEmailTemplates, setShowEmailTemplates] = useState(false);
  const [showLeadFormBuilder, setShowLeadFormBuilder] = useState(false);

  useEffect(() => {
    fetchUserSettings();
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
      }

      
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      // App settings are now admin-only and don't require profile updates
      toast.success('Settings updated successfully');
      
    } catch (err) {
      console.error('Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
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

        <form onSubmit={handleSubmit} className="space-y-6">



          {/* Admin Section */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow border-l-4 border-purple-500">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <Users className="h-5 w-5 mr-2 text-purple-500" />
              Admin Settings
            </h2>
            
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                As an administrator, you have access to additional settings and user management features.
              </p>
              
              <div className="flex flex-wrap gap-4">
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
                
                <button
                  type="button"
                  onClick={() => setShowEmailTemplates(!showEmailTemplates)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {showEmailTemplates ? 'Hide Email Templates' : 'Manage Email Templates'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowLeadFormBuilder(!showLeadFormBuilder)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
                >
                  <Users className="h-4 w-4 mr-2" />
                  {showLeadFormBuilder ? 'Hide Lead Forms' : 'Manage Lead Forms'}
                </button>
              </div>
            </div>
          </div>

          {/* Email Template Management */}
          {showEmailTemplates && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow border-l-4 border-blue-500">
              <EmailTemplateManager />
            </div>
          )}

          {/* Lead Form Builder */}
          {showLeadFormBuilder && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow border-l-4 border-green-500">
              <LeadFormBuilder />
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