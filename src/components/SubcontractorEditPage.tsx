import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Save, 
  Upload, 
  X,
  Trash2,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';
interface SubcontractorData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  address: string | null;
  company_name: string | null;
  working_days: {
    sunday: boolean;
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
  } | null;
  language_preference: string | null;
  created_at: string;
  updated_at: string;
}

const CALENDAR_FEED_BASE_URL = 'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed';

const googleCalendarLink = (icsUrl: string) => `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icsUrl)}`;

const appleCalendarLink = (icsUrl: string) => icsUrl.replace(/^https:\/\//, 'webcal://').replace(/^http:\/\//, 'webcal://');

const generateToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function SubcontractorEditPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subcontractor, setSubcontractor] = useState<SubcontractorData | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    address: '',
    company_name: '',
    password: '',
    confirmPassword: '',
    defaultToSpanish: false,
    working_days: {
      sunday: true,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [loadingCalendarFeed, setLoadingCalendarFeed] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

useEffect(() => {
  checkUserRole();
  if (userId) {
    fetchSubcontractorData();
  }
}, [userId]);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile && (profile.role === 'admin' || profile.role === 'jg_management')) {
          setCurrentUserRole(profile.role);
        } else {
          toast.error('Access denied. Only admins and JG management can edit subcontractors.');
          navigate('/dashboard/users');
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      toast.error('Error checking user permissions');
      navigate('/dashboard/users');
    }
  };

  const fetchSubcontractorData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('role', 'subcontractor')
        .single();

      if (error) throw error;

      if (data) {
        setSubcontractor(data);
        setFormData({
          email: data.email || '',
          full_name: data.full_name || '',
          phone: data.phone || '',
          address: data.address || '',
          company_name: data.company_name || '',
          password: '',
          confirmPassword: '',
          defaultToSpanish: data.language_preference === 'es',
          working_days: data.working_days || {
            sunday: true,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false
          }
        });
        setAvatarPreview(data.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching subcontractor data:', error);
      toast.error('Failed to fetch subcontractor data');
      navigate('/dashboard/users');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleWorkingDayChange = (day: keyof typeof formData.working_days) => {
    setFormData(prev => ({
      ...prev,
      working_days: {
        ...prev.working_days,
        [day]: !prev.working_days[day]
      }
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Avatar file size must be less than 5MB');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

const ensureSubcontractorCalendarToken = useCallback(async (targetId: string) => {
    setCalendarError(null);
    setLoadingCalendarFeed(true);
    try {
      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('token')
        .eq('user_id', targetId)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data?.token) {
        setCalendarToken(data.token);
        return;
      }

      const newToken = generateToken();
      const { error: insertError } = await supabase
        .from('calendar_tokens')
        .insert({ user_id: targetId, token: newToken });

      if (insertError) {
        throw insertError;
      }

      setCalendarToken(newToken);
    } catch (err) {
      console.error('Error loading calendar token:', err);
      setCalendarError('Unable to load calendar feed link.');
    } finally {
      setLoadingCalendarFeed(false);
    }
}, []);

useEffect(() => {
  if (subcontractor?.id) {
    setCalendarToken(null);
    setCalendarError(null);
    ensureSubcontractorCalendarToken(subcontractor.id);
  }
}, [subcontractor?.id, ensureSubcontractorCalendarToken]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subcontractor) return;

    // Validate passwords
    if (!formData.password) {
      toast.error('Please enter a password');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    try {
      setSaving(true);
      
      // Update password using Supabase admin API
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        subcontractor.id,
        { password: formData.password }
      );
      
      if (passwordError) {
        throw new Error(passwordError.message);
      }
      
      toast.success('Password changed successfully');
      
      // Reset form and close modal
      setFormData(prev => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }));
      setShowPasswordModal(false);
      
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const subcontractorFeedUrl = useMemo(() => {
    if (!calendarToken || !subcontractor?.id) return null;
    return `${CALENDAR_FEED_BASE_URL}?scope=subcontractor&token=${calendarToken}&subcontractor_id=${subcontractor.id}`;
  }, [calendarToken, subcontractor?.id]);

  const appleFeedUrl = useMemo(() => {
    if (!subcontractorFeedUrl) return null;
    return appleCalendarLink(subcontractorFeedUrl);
  }, [subcontractorFeedUrl]);

  const googleFeedUrl = useMemo(() => {
    if (!subcontractorFeedUrl) return null;
    return googleCalendarLink(subcontractorFeedUrl);
  }, [subcontractorFeedUrl]);

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) return subcontractor?.avatar_url || null;

    try {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subcontractor) return;

    // Validate password if provided
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      setSaving(true);

      // Upload avatar first if there's a new one
      const avatarUrl = await uploadAvatar();

      // Update profile data
      const updateData: any = {
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
        company_name: formData.company_name,
        working_days: formData.working_days,
        language_preference: formData.defaultToSpanish ? 'es' : 'en',
        updated_at: new Date().toISOString()
      };

              if (avatarUrl !== null) {
          updateData.avatar_url = avatarUrl;
          
          // Trigger global avatar refresh by dispatching a custom event
          // This will notify other components that the avatar has been updated
          window.dispatchEvent(new CustomEvent('avatarUpdated', {
            detail: {
              userId: userId,
              avatarUrl: avatarUrl,
              timestamp: Date.now()
            }
          }));
          
          console.log('Avatar updated, global refresh event dispatched');
        }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (profileError) throw profileError;

      // Update password if provided
      if (formData.password) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          userId,
          { password: formData.password }
        );

        if (passwordError) {
          console.error('Password update error:', passwordError);
          toast.warning('Profile updated but password change failed. Please contact support.');
        }
      }

      toast.success('Subcontractor updated successfully');
      
      // Refresh data
      await fetchSubcontractorData();
      
      // Reset password fields
      setFormData(prev => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }));

    } catch (error) {
      console.error('Error updating subcontractor:', error);
      toast.error('Failed to update subcontractor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!subcontractor) return;

    if (!confirm(`Are you sure you want to delete ${subcontractor.full_name || subcontractor.email}? This action cannot be undone.`)) {
      return;
    }

    try {
      setSaving(true);
      console.log('🗑️ Deleting subcontractor:', subcontractor.id);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to delete users');
        return;
      }

      // Call delete-user edge function
      console.log('Calling delete-user edge function...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: subcontractor.id
          })
        }
      );

      const result = await response.json();
      console.log('Delete user response:', result);

      if (!response.ok || !result.success) {
        console.error('❌ Delete user failed:', result);
        throw new Error(result.error || result.message || 'Failed to delete subcontractor');
      }

      if (result.partial) {
        console.warn('⚠️ Partial deletion:', result.message);
        toast.warning(result.message);
      } else {
        console.log('✅ Subcontractor deleted successfully');
        toast.success('Subcontractor deleted successfully');
      }

      navigate('/dashboard/users');

    } catch (error) {
      console.error('❌ Error deleting subcontractor:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete subcontractor';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subcontractor) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Subcontractor not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard/users')}
            className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit Subcontractor
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Update subcontractor profile and settings
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Avatar Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Profile Picture
          </h2>
          
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              
              {avatarPreview && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload New Avatar
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG or GIF. Max size 5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Basic Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Working Days Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Working Days & Availability
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select the days when this subcontractor is available for work. They will only appear in the Sub Scheduler on their working days.
          </p>
          
          <div className="grid grid-cols-5 gap-4">
            {/* First row: Monday through Friday */}
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => (
              <label key={day} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.working_days[day as keyof typeof formData.working_days]}
                  onChange={() => handleWorkingDayChange(day as keyof typeof formData.working_days)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {day}
                </span>
              </label>
            ))}
          </div>
          
          {/* Second row: Saturday and Sunday */}
          <div className="grid grid-cols-5 gap-4 mt-4">
            {['saturday', 'sunday'].map(day => (
              <label key={day} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.working_days[day as keyof typeof formData.working_days]}
                  onChange={() => handleWorkingDayChange(day as keyof typeof formData.working_days)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {day}
                </span>
              </label>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> Subcontractors will only be visible in the Sub Scheduler on days marked as working days. 
              This helps ensure proper scheduling and resource allocation.
            </p>
          </div>
        </div>

        {/* Language Preference Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Language Preference
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Set the default dashboard language for this subcontractor. They can still toggle the language manually, but it will reset to this default on next login.
          </p>
          
          <label className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={formData.defaultToSpanish}
              onChange={(e) => setFormData({ ...formData, defaultToSpanish: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Default Dashboard Language to Spanish
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                When checked, the subcontractor's dashboard will load in Spanish by default
              </p>
            </div>
          </label>
        </div>

        {/* Calendar Feed Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Subcontractor Calendar Feed
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Share this link to let {subcontractor?.full_name || 'this subcontractor'} subscribe to their assigned jobs in Apple or Google Calendar.
            </p>
          </div>

          {calendarError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
              <span>{calendarError}</span>
              {subcontractor?.id && (
                <button
                  type="button"
                  onClick={() => ensureSubcontractorCalendarToken(subcontractor.id)}
                  className="ml-4 px-3 py-1 text-xs font-medium bg-red-100 dark:bg-red-800/40 rounded-md text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {loadingCalendarFeed ? (
            <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-300">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
              <span>Loading calendar feed…</span>
            </div>
          ) : subcontractorFeedUrl ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ICS URL (copy this if direct links do not work)
                </label>
                <input
                  readOnly
                  value={subcontractorFeedUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                {appleFeedUrl && (
                  <a
                    className="underline text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    href={appleFeedUrl}
                  >
                    📱 Apple Calendar Feed
                  </a>
                )}
                {googleFeedUrl && (
                  <a
                    className="underline text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    target="_blank"
                    rel="noreferrer"
                    href={googleFeedUrl}
                  >
                    📧 Google Calendar Feed
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Calendar feed will become available once the subcontractor record is fully loaded.
            </p>
          )}
        </div>

        {/* Password Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Password Management
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Change the subcontractor's password if needed
          </p>
          
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Lock className="h-4 w-4 mr-2" />
            Change Password
          </button>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard/users')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Change Password for {subcontractor?.full_name || subcontractor?.email}
            </h3>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Changing...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
