import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Loader2, Send, CheckCircle, XCircle, Info } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  daily_summary_enabled: boolean;
}

interface TestEmailStatus {
  status: 'idle' | 'sending' | 'success' | 'error';
  message: string;
}

interface EmailConfig {
  send_time_utc: string;
  send_time_timezone: string;
}

export function DailyAgendaEmailSettings() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [testEmailMode, setTestEmailMode] = useState<'single' | 'all'>('single');
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<TestEmailStatus>({
    status: 'idle',
    message: ''
  });
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [sendTime, setSendTime] = useState('07:00');
  const [savingTime, setSavingTime] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchEmailConfig();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get all admin and JG management users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .in('role', ['admin', 'manager']);
      
      if (profilesError) throw profilesError;

      // Get email settings for these users
      const { data: settingsData, error: settingsError } = await supabase
        .from('daily_email_settings')
        .select('user_id, enabled');
      
      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching email settings:', settingsError);
      }

      // Merge the data
      const usersWithSettings = profilesData?.map(profile => {
        const setting = settingsData?.find(s => s.user_id === profile.id);
        return {
          ...profile,
          daily_summary_enabled: setting?.enabled || false
        };
      }) || [];

      setUsers(usersWithSettings);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_email_config')
        .select('send_time_utc, send_time_timezone')
        .single();
      
      if (error) throw error;
      
      if (data) {
        setEmailConfig(data);
        // Treat the stored time as Eastern Time (ET) for display
        const utcTime = data.send_time_utc;
        // Parse HH:MM:SS to HH:MM for input
        const timeOnly = utcTime.substring(0, 5);
        setSendTime(timeOnly);
      }
    } catch (error) {
      console.error('Error fetching email config:', error);
    }
  };

  const toggleDailySummary = async (userId: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      
      // Upsert the setting
      const { error } = await supabase
        .from('daily_email_settings')
        .upsert({
          user_id: userId,
          enabled: newValue
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Update local state
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, daily_summary_enabled: newValue }
          : user
      ));

      toast.success(newValue ? 'Daily email enabled' : 'Daily email disabled');
    } catch (error) {
      console.error('Error toggling daily summary:', error);
      toast.error('Failed to update setting');
    }
  };

  const sendTestEmail = async () => {
    setTestEmailStatus({ status: 'sending', message: '' });

    try {
      const { data, error } = await supabase.functions.invoke('send-daily-agenda-email', {
        body: {
          mode: testEmailMode,
          recipient: testEmailMode === 'single' ? testEmailRecipient : null,
          test: true
        }
      });

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to send email');
      }

      setTestEmailStatus({
        status: 'success',
        message: data.message || `Email(s) sent successfully to ${testEmailMode === 'single' ? testEmailRecipient : 'all enabled users'}`
      });
      
      toast.success('Test email sent successfully');
    } catch (error) {
      console.error('Error sending test email:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
      
      setTestEmailStatus({
        status: 'error',
        message: errorMessage
      });
      
      toast.error('Failed to send test email: ' + errorMessage);
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      setTestEmailStatus({ status: 'idle', message: '' });
    }, 5000);
  };

  const updateSendTime = async () => {
    try {
      setSavingTime(true);
      
      // Format as HH:MM:SS for postgres TIME type
      const timeString = `${sendTime}:00`;
      
      // Get the config ID first
      const { data: configData, error: fetchError } = await supabase
        .from('daily_email_config')
        .select('id')
        .single();
      
      if (fetchError) throw fetchError;
      if (!configData) throw new Error('No email config found');
      
      // Update the config
      const { error: updateError } = await supabase
        .from('daily_email_config')
        .update({
          send_time_utc: timeString,
          updated_at: new Date().toISOString()
        })
        .eq('id', configData.id);
      
      if (updateError) throw updateError;
      
      toast.success(`Daily email time updated to ${sendTime}. Cron job will be rescheduled automatically.`);
      await fetchEmailConfig();
    } catch (error) {
      console.error('Error updating send time:', error);
      toast.error('Failed to update send time: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSavingTime(false);
    }
  };

  const isTestEmailValid = () => {
    if (testEmailMode === 'single') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(testEmailRecipient);
    }
    return true;
  };

  const enabledCount = users.filter(u => u.daily_summary_enabled).length;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Daily Agenda Email Settings</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure which admin and management users receive daily job summary emails.
        </p>
      </div>

      {/* Schedule Settings Section */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow border border-gray-200 dark:border-[#2D3B4E]">
        <div className="p-6 border-b border-gray-200 dark:border-[#2D3B4E]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email Schedule</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure when daily agenda emails are sent automatically
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="sendTime" className="block text-sm font-medium text-gray-900 dark:text-white">
              Daily Send Time (Eastern Time)
            </label>
            <div className="flex gap-3 items-center">
              <input
                id="sendTime"
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                onClick={updateSendTime}
                disabled={savingTime}
                className="whitespace-nowrap"
              >
                {savingTime ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Update Time'
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Current schedule: Emails sent daily at {sendTime} Eastern Time (ET). The system will automatically convert this to UTC for scheduling.
            </p>
          </div>
        </div>
      </div>

      {/* Test Email Section */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow border border-gray-200 dark:border-[#2D3B4E]">
        <div className="p-6 border-b border-gray-200 dark:border-[#2D3B4E]">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Send className="h-5 w-5" />
            Send Test Email
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Send a test agenda email immediately to verify formatting and delivery
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="single"
                name="emailMode"
                value="single"
                checked={testEmailMode === 'single'}
                onChange={(e) => setTestEmailMode(e.target.value as 'single' | 'all')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="single" className="cursor-pointer text-gray-900 dark:text-white">
                Send to single test email
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="all"
                name="emailMode"
                value="all"
                checked={testEmailMode === 'all'}
                onChange={(e) => setTestEmailMode(e.target.value as 'single' | 'all')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="all" className="cursor-pointer text-gray-900 dark:text-white">
                Send to all enabled users ({enabledCount} recipient{enabledCount !== 1 ? 's' : ''})
              </label>
            </div>
          </div>

          {testEmailMode === 'single' && (
            <div className="space-y-2">
              <label htmlFor="testEmail" className="block text-sm font-medium text-gray-900 dark:text-white">
                Test Email Address
              </label>
              <input
                id="testEmail"
                type="email"
                placeholder="test@example.com"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <Button
            onClick={sendTestEmail}
            disabled={!isTestEmailValid() || testEmailStatus.status === 'sending'}
            className="w-full sm:w-auto"
          >
            {testEmailStatus.status === 'sending' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test Email Now
              </>
            )}
          </Button>

          {(testEmailStatus.status === 'success' || testEmailStatus.status === 'error') && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              testEmailStatus.status === 'success'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-red-500 bg-red-50 dark:bg-red-900/20'
            }`}>
              {testEmailStatus.status === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              )}
              <p className={`text-sm ${
                testEmailStatus.status === 'success'
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {testEmailStatus.message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* User List Section */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow border border-gray-200 dark:border-[#2D3B4E]">
        <div className="p-6 border-b border-gray-200 dark:border-[#2D3B4E]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email Recipients</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Enable or disable daily summary emails for each user
          </p>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No admin or management users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2D3B4E] bg-gray-50 dark:bg-[#0F172A]">
                    <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">User Name</th>
                    <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Email</th>
                    <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Role</th>
                    <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Daily Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-200 dark:border-[#2D3B4E] hover:bg-gray-50 dark:hover:bg-[#1E293B]/50 transition-colors">
                      <td className="p-4 text-gray-900 dark:text-white">{user.full_name || 'N/A'}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">{user.email}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {user.role === 'manager' ? 'JG Management' : 'Admin'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleDailySummary(user.id, user.daily_summary_enabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            user.daily_summary_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              user.daily_summary_enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/50">
        <div className="p-6">
          <div className="flex gap-3">
            <div className="text-blue-600 dark:text-blue-400 mt-0.5">
              <Info className="h-5 w-5" />
            </div>
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-semibold mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300">
                <li>Emails are sent automatically at {sendTime} Eastern Time (ET) every day</li>
                <li>Email content includes job counts and details for the current day</li>
                <li>Use the test feature above to preview the email format</li>
                <li>Only users with the toggle enabled will receive daily emails</li>
                <li>The cron job will automatically reschedule when you change the send time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
