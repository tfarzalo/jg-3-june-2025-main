import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  User, 
  Upload, 
  Mail, 
  Phone, 
  Info, 
  Save, 
  Trash2, 
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  Bell,
  Settings,
  Clipboard
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { SubcontractorJobHistory } from './users/SubcontractorJobHistory';
import { formatDisplayDate } from '../lib/dateUtils';

interface UserProfileData {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  mobile_phone: string | null;
  sms_phone: string | null;
  bio: string | null;
  role: string;
  username: string | null;
  theme_preference: string | null;
  work_schedule: string[] | null;
  notification_settings: string | null;
  // New availability fields
  availability?: any;
  preferred_contact_method?: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  timezone?: string | null;
  language_preference?: string | null;
  communication_preferences?: any;
  professional_info?: any;
  social_media?: any;
  notes?: string | null;
  last_profile_update?: string | null;
}

interface NotificationSettings {
  job_phase_changes: boolean;
  work_orders: boolean;
  callbacks: boolean;
  system_alerts: boolean;
}

interface JobHistoryItem {
  id: string;
  work_order_num: number;
  job_phase: {
    job_phase_label: string;
    color_light_mode: string;
    color_dark_mode: string;
  } | null;
  unit_number: string;
  unit_size: {
    unit_size_label: string;
  };
  job_type: {
    job_type_label: string;
  };
  description: string | null;
  scheduled_date: string;
  property: {
    property_name: string;
  };
}

export function UserProfile() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobHistory, setJobHistory] = useState<JobHistoryItem[]>([]);
  const [loadingJobHistory, setLoadingJobHistory] = useState(false);
  
  const [profile, setProfile] = useState<UserProfileData>({
    id: '',
    email: '',
    full_name: '',
    nickname: '',
    avatar_url: null,
    mobile_phone: '',
    sms_phone: '',
    bio: '',
    role: 'user',
    username: '',
    theme_preference: 'dark',
    work_schedule: [],
    notification_settings: null
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    job_phase_changes: true,
    work_orders: true,
    callbacks: true,
    system_alerts: true
  });


  useEffect(() => {
    fetchUserProfile(userId);
  }, [userId]);

  useEffect(() => {
    // Parse notification settings when profile is loaded
    if (profile.notification_settings) {
      try {
        const settings = JSON.parse(profile.notification_settings);
        setNotificationSettings(settings);
      } catch (e) {
        console.error('Error parsing notification settings:', e);
      }
    }
  }, [profile.notification_settings]);

  const fetchUserProfile = async (targetUserId?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching user profile...', targetUserId ? `for user ${targetUserId}` : 'for current user');
      
      // Get current user (for authentication check)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Auth error:', userError);
        throw userError;
      }
      if (!userData.user) {
        console.error('No user found');
        throw new Error('User not found');
      }
      
      console.log('UserProfile: Current user ID from auth:', userData.user.id);
      
      // Determine which user's profile to load
      let userIdToLoad = targetUserId || userData.user.id;
      
      // If viewing another user's profile, set view-only mode
      if (targetUserId && targetUserId !== userData.user.id) {
        setIsViewOnly(true);
        console.log('UserProfile: View-only mode enabled for user:', targetUserId);
      } else {
        setIsViewOnly(false);
      }
      
      // Check if user ID has any unexpected characters
      if (userIdToLoad && userIdToLoad.includes(':')) {
        console.error('UserProfile: User ID contains unexpected characters:', userIdToLoad);
        // Clean the user ID by removing anything after the first colon
        userIdToLoad = userIdToLoad.split(':')[0];
        console.log('UserProfile: Cleaned user ID:', userIdToLoad);
      } else {
        console.log('UserProfile: Loading profile with clean ID:', userIdToLoad);
      }
      
      // Get profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userIdToLoad)
        .single();
      
      console.log('Profile query result:', { data, error });
      
      if (error) {
        console.error('Profile query error:', error);
        if (error.code === 'PGRST116') {
          // Profile not found - only create if viewing own profile
          if (targetUserId && targetUserId !== userData.user.id) {
            throw new Error('Profile not found for this user');
          }
          
          console.log('Profile not found, creating new profile...');
          const newProfile = {
            id: userIdToLoad, // Use the cleaned user ID
            email: userData.user.email,
            full_name: userData.user.user_metadata?.full_name || '',
            role: 'user',
            theme_preference: 'dark',
            work_schedule: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
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
            
          if (insertError) {
            console.error('Profile creation error:', insertError);
            throw insertError;
          }
          
          console.log('New profile created successfully');
          setProfile(newProfile as UserProfileData);
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
        console.log('Profile data loaded:', data);
        setProfile({
          ...data,
          work_schedule: data.work_schedule || []
        });
        
        if (data.avatar_url) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('avatars')
            .getPublicUrl(data.avatar_url);
            
          setAvatarUrl(publicUrl);
        }

        // Parse notification settings
        if (data.notification_settings) {
          try {
            const settings = JSON.parse(data.notification_settings);
            setNotificationSettings(settings);
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
      
      
    } catch (err) {
      console.error('Error fetching profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      console.error('Error details:', {
        message: errorMessage,
        error: err,
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(errorMessage);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobHistory = async (userId: string) => {
    try {
      setLoadingJobHistory(true);
      
      // Fetch jobs assigned to this subcontractor
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          description,
          scheduled_date,
          subcontractor_assigned,
          job_phase:job_phase_id (
            job_phase_label,
            color_light_mode,
            color_dark_mode
          ),
          unit_size:unit_size_id (
            unit_size_label
          ),
          job_type:job_type_id (
            job_type_label
          ),
          property:property_id (
            property_name
          )
        `)
        .eq('subcontractor_assigned', userId)
        .order('scheduled_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching job history:', error);
        throw error;
      }
      
      // Transform data to match interface (Supabase returns arrays for relations)
      const transformedData: JobHistoryItem[] = (data || []).map((job: any) => ({
        id: job.id,
        work_order_num: job.work_order_num,
        unit_number: job.unit_number,
        description: job.description,
        scheduled_date: job.scheduled_date,
        job_phase: Array.isArray(job.job_phase) && job.job_phase.length > 0 ? job.job_phase[0] : null,
        unit_size: Array.isArray(job.unit_size) && job.unit_size.length > 0 ? job.unit_size[0] : { unit_size_label: 'N/A' },
        job_type: Array.isArray(job.job_type) && job.job_type.length > 0 ? job.job_type[0] : { job_type_label: 'N/A' },
        property: Array.isArray(job.property) && job.property.length > 0 ? job.property[0] : { property_name: 'N/A' }
      }));
      
      setJobHistory(transformedData);
    } catch (err) {
      console.error('Error loading job history:', err);
      toast.error('Failed to load job history');
    } finally {
      setLoadingJobHistory(false);
    }
  };

  // Fetch job history when profile is loaded and user is a subcontractor
  useEffect(() => {
    if (profile.id && profile.role === 'subcontractor') {
      fetchJobHistory(profile.id);
    }
  }, [profile.id, profile.role]);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image is too large. Maximum size is 2MB.');
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed.');
        return;
      }
      
      setAvatarFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleWorkScheduleChange = (day: string) => {
    setProfile(prev => {
      const currentSchedule = prev.work_schedule || [];
      if (currentSchedule.includes(day)) {
        return { ...prev, work_schedule: currentSchedule.filter(d => d !== day) };
      } else {
        return { ...prev, work_schedule: [...currentSchedule, day] };
      }
    });
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
      // Upload avatar if changed
      let avatarPath = profile.avatar_url;
      
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        avatarPath = fileName;
      }
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          nickname: profile.nickname,
          avatar_url: avatarPath,
          mobile_phone: profile.mobile_phone,
          sms_phone: profile.sms_phone,
          bio: profile.bio,
          username: profile.username,
          work_schedule: profile.work_schedule,
          notification_settings: JSON.stringify(notificationSettings)
        })
        .eq('id', profile.id);
        
      if (updateError) throw updateError;
      
      // If avatar was updated, trigger global avatar refresh
      if (avatarFile) {
        // Trigger global avatar refresh by dispatching a custom event
        // This will notify other components that the avatar has been updated
        window.dispatchEvent(new CustomEvent('avatarUpdated', {
          detail: {
            userId: profile.id,
            avatarUrl: avatarPath,
            timestamp: Date.now()
          }
        }));
        
        console.log('Avatar updated, global refresh event dispatched');
      }
      
      toast.success('Profile updated successfully');
      
      // Refresh profile data
      fetchUserProfile();
      
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {isViewOnly ? `Viewing ${profile.full_name || profile.email}'s Profile` : 'User Profile'}
                </h1>
                {isViewOnly && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View-only mode</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={`space-y-6 ${isViewOnly ? 'pointer-events-none opacity-75' : ''}`}>
          {/* Avatar Section */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Profile Picture</h2>
            
            <div className="flex flex-col items-center">
              <div 
                className={`w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden ${!isViewOnly ? 'cursor-pointer hover:border-blue-500 dark:hover:border-blue-500' : ''} border-4 border-gray-300 dark:border-gray-600 transition-colors`}
                onClick={isViewOnly ? undefined : handleAvatarClick}
              >
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Avatar Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="User Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-16 w-16 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
              
              <button
                type="button"
                onClick={handleAvatarClick}
                className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
              >
                <Upload className="h-4 w-4 mr-1" />
                {profile.avatar_url ? 'Change Photo' : 'Upload Photo'}
              </button>
              
              {(profile.avatar_url || avatarPreview) && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl(null);
                    setAvatarPreview(null);
                    setAvatarFile(null);
                    setProfile(prev => ({ ...prev, avatar_url: null }));
                  }}
                  className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={profile.full_name || ''}
                  onChange={handleInputChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Nickname
                </label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={profile.nickname || ''}
                  onChange={handleInputChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your nickname"
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={profile.username || ''}
                  onChange={handleInputChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profile.email}
                  readOnly
                  className="w-full h-11 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Email cannot be changed</p>
              </div>

              <div>
                <label htmlFor="mobile_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Mobile Phone
                </label>
                <input
                  type="tel"
                  id="mobile_phone"
                  name="mobile_phone"
                  value={profile.mobile_phone || ''}
                  onChange={handleInputChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your mobile phone"
                />
              </div>

              <div>
                <label htmlFor="sms_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  SMS Phone
                </label>
                <input
                  type="tel"
                  id="sms_phone"
                  name="sms_phone"
                  value={profile.sms_phone || ''}
                  onChange={handleInputChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your SMS phone"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Bio / About
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  value={profile.bio || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell us about yourself"
                />
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

          {/* Role and Preferences */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Role and Preferences</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Role
                </label>
                <input
                  type="text"
                  id="role"
                  name="role"
                  value={profile.role}
                  readOnly
                  className="w-full h-11 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Role can only be changed by an admin</p>
              </div>

              <div>
                <label htmlFor="theme_preference" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Theme Preference
                </label>
                <select
                  id="theme_preference"
                  name="theme_preference"
                  value={profile.theme_preference || 'dark'}
                  onChange={handleInputChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System Default</option>
                </select>
              </div>
            </div>
          </div>

          {/* Work Schedule */}
          {profile.role === 'subcontractor' && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Work Schedule Availability</h2>
              
              <div className="grid grid-cols-5 gap-4">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                  <div key={day} className="flex flex-col items-center">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {day}
                    </label>
                    <div 
                      className={`w-12 h-12 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                        profile.work_schedule?.includes(day) 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}
                      onClick={() => handleWorkScheduleChange(day)}
                    >
                      {profile.work_schedule?.includes(day) ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <XCircle className="h-6 w-6" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Job History - Only for Subcontractors */}
          {profile.role === 'subcontractor' && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Clipboard className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Property Job History</h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">({jobHistory.length} jobs)</span>
                </div>
              </div>
              
              {loadingJobHistory ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                </div>
              ) : jobHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Clipboard className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p>No job history found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Work Order #
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Job Phase
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Unit #
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Unit Size
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Job Type
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Description
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Scheduled Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                      {jobHistory.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <a
                              href={`/jobs/${job.id}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              WO-{String(job.work_order_num).padStart(6, '0')}
                            </a>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {job.job_phase ? (
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: document.documentElement.classList.contains('dark')
                                    ? job.job_phase.color_dark_mode
                                    : job.job_phase.color_light_mode,
                                  color: 'white'
                                }}
                              >
                                {job.job_phase.job_phase_label}
                              </span>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400 text-sm">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {job.unit_number}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {job.unit_size.unit_size_label}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {job.job_type.job_type_label}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                            {job.description || 'N/A'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {formatDisplayDate(job.scheduled_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          {!isViewOnly && (
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
          )}
          {isViewOnly && (
            <div className="flex justify-end pointer-events-auto">
              <button
                type="button"
                onClick={() => navigate('/dashboard/users')}
                className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
              >
                Back to Users
              </button>
            </div>
          )}
        </form>

        {/* Job History Section - Only for Subcontractors */}
        {profile?.role === 'subcontractor' && profile.id ? (
          <SubcontractorJobHistory 
            userId={profile.id} 
            userName={profile.full_name || profile.email} 
          />
        ) : (
          profile?.role && profile?.id && null
        )}

        <div className="mt-6 text-center">
          <Link
            to="/sms-consent"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2"
          >
            SMS Messaging Consent
          </Link>
        </div>
      </div>
    </div>
  );
}
