import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users as UsersIcon, 
  Search, 
  Edit, 
  Trash2, 
  XCircle,
  Key,
  UserPlus,
  RefreshCw,
  Filter,
  ChevronDown,
  User,
  ShieldCheck,
  UserCog,
  Eye,
  Mail,
  Send,
  CheckCircle,
  ClipboardList
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { usePresence } from '../hooks/usePresence';
import { useLastSeen } from '../hooks/useLastSeen';
import { UserChip } from './UserChip';
import { formatDistanceToNow } from 'date-fns';
import { getAvailableWorkingDays, getWorkingDaysCount } from '../lib/availabilityUtils';
import { useUserRole } from '../contexts/UserRoleContext';
import { SubcontractorAdminView } from './users/SubcontractorAdminView';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  avatar_url: string | null;
  last_seen: string | null;
  working_days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  } | null;
}

export function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [changingPassword, setChangingPassword] = useState(false);
  const [subcontractorAdminUser, setSubcontractorAdminUser] = useState<User | null>(null);

  // Welcome email prompt state (shown after subcontractor creation)
  const [showWelcomeEmailPrompt, setShowWelcomeEmailPrompt] = useState(false);
  const [sendingWelcomeEmail, setSendingWelcomeEmail] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [pendingWelcomeEmail, setPendingWelcomeEmail] = useState<{
    userId: string;
    email: string;
    full_name: string;
    password: string;
  } | null>(null);

  // Resend welcome email (no password — portal link only)
  const [resendingEmailForUserId, setResendingEmailForUserId] = useState<string | null>(null);
  const [showResendConfirm, setShowResendConfirm] = useState<User | null>(null);

  // ── Temp password generator ────────────────────────────────────────────────
  const generateTempPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    arr.forEach(v => { pwd += chars[v % chars.length]; });
    // Guarantee at least one upper, lower, digit, symbol
    return pwd;
  };
  
  // Use the new presence hooks
  const { isOnline } = usePresence();
  const { touchLastSeen } = useLastSeen();
  
  // Get current user role for access control
  const { role: currentUserRole, isAdmin } = useUserRole();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const canDeleteUsers = ['admin', 'jg_management', 'assistant_manager', 'is_super_admin'].includes(currentUserRole || '');
  
  // Form state for adding/editing users
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'subcontractor', // Default to subcontractor instead of user
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
  
  // Form state for changing password
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: ''
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user first
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || !currentUser.id) throw new Error('No current user found or user id missing');
      
      // Store current user ID for access control
      setCurrentUserId(currentUser.id);
      
      // Update current user's last_seen immediately
      await touchLastSeen();

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // Ensure all users have a last_seen value
      const usersWithLastSeen = data?.map(user => ({
        ...user,
        last_seen: user.last_seen || user.updated_at || user.created_at
      })) || [];
      
      setUsers(usersWithLastSeen);
      setFilteredUsers(usersWithLastSeen);

    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [touchLastSeen]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Real-time subscription for profile updates (online status, last_seen, etc.)
  useEffect(() => {
    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('[Users] Profile update received:', payload);
          
          if (payload.eventType === 'UPDATE') {
            const updatedProfile = payload.new as User;
            setUsers(prev => 
              prev.map(user => 
                user.id === updatedProfile.id 
                  ? { ...user, ...updatedProfile, last_seen: updatedProfile.last_seen || user.last_seen }
                  : user
              )
            );
          } else if (payload.eventType === 'INSERT') {
            const newProfile = payload.new as User;
            setUsers(prev => [newProfile, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setUsers(prev => prev.filter(user => user.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log('[Users] Real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter users based on search term and role filter
  useEffect(() => {
    let filtered = users;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply role filter
    if (roleFilter.length > 0) {
      filtered = filtered.filter(user => roleFilter.includes(user.role));
    }

    // Sort users by last seen time (most recently active first)
    // This ensures both online and offline users are ordered by their last activity
    filtered.sort((a, b) => {
      if (!a.last_seen && !b.last_seen) return 0;
      if (!a.last_seen) return 1;
      if (!b.last_seen) return -1;
      return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For non-subcontractor roles, validate password match
    if (formData.role !== 'subcontractor' && formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    // Ensure subcontractor has a temp password
    if (formData.role === 'subcontractor' && !formData.password) {
      toast.error('Temporary password is missing — click ↻ to regenerate');
      return;
    }

    try {
      // Call the create-user Edge Function instead of using admin API directly
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to create users');
        return;
      }

      console.log('=== CREATING USER VIA EDGE FUNCTION ===');
      console.log('User data:', {
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        working_days: formData.working_days,
        hasPassword: !!formData.password
      });

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      console.log('Function URL:', functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          working_days: formData.working_days,
          sendWelcomeEmail: true
        })
      });

      console.log('=== CREATE-USER FUNCTION RESPONSE ===');
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log('Response body:', result);

      if (!response.ok || !result.success) {
        console.error('❌ CREATE-USER FUNCTION ERROR:', result);
        throw new Error(result.error || 'Failed to create user');
      }

      console.log('✅ User created successfully:', result.user?.id);
      toast.success('User created successfully');
      
      const newUserId = result.user?.id;
      const createdRole = formData.role;
      const createdEmail = formData.email;
      const createdName = formData.full_name;
      const createdPassword = formData.password;
      
      setShowAddUserModal(false);
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        role: 'subcontractor',
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
      
      await fetchUsers();
      
      // If the created user is a Subcontractor, show welcome email prompt before redirecting
      if (createdRole === 'subcontractor' && newUserId) {
        setPendingWelcomeEmail({
          userId: newUserId,
          email: createdEmail,
          full_name: createdName,
          password: createdPassword,
        });
        setShowWelcomeEmailPrompt(true);
      }
    } catch (error) {
      console.error('❌ ERROR CREATING USER:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      toast.error(errorMessage, {
        duration: 8000,
        position: 'top-center'
      });
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    try {
      // Update profile
      const updateData: any = {
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        working_days: formData.working_days
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

      toast.success('User updated successfully');
      setShowEditUserModal(false);
      setSelectedUser(null);
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        role: 'subcontractor',
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
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      console.log('🗑️ Deleting user:', selectedUser.id, selectedUser.email);
      
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
            userId: selectedUser.id
          })
        }
      );

      const result = await response.json();
      console.log('Delete user response:', result);

      if (!response.ok || !result.success) {
        console.error('❌ Delete user failed:', result);
        throw new Error(result.error || result.message || 'Failed to delete user');
      }

      if (result.partial) {
        console.warn('⚠️ Partial deletion:', result.message);
        toast.warning(result.message);
      } else {
        console.log('✅ User deleted successfully');
        toast.success('User deleted successfully');
      }

      setShowDeleteConfirm(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        fullError: error
      });
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;
    
    if (!passwordData.password) {
      toast.error('Please enter a password');
      return;
    }

    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setChangingPassword(true);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('You must be logged in to change passwords');
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          password: passwordData.password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Failed to change password');
      }

      toast.success('Password changed successfully');
      setShowChangePasswordModal(false);
      setSelectedUser(null);
      setPasswordData({
        password: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const buildWelcomeEmailHtml = (info: { full_name: string; email: string; password: string }) => {
    const loginUrl = 'https://portal.jgpaintingpros.com';
    const firstName = info.full_name?.split(' ')[0] || 'there';
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Welcome to JG Painting Pros</h1>
          <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 16px;">Your subcontractor account is ready</p>
        </div>
        <div style="padding: 36px 32px; background: #f8fafc; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
          <p style="margin: 0 0 24px 0; font-size: 17px; color: #1e293b; line-height: 1.6;">Hi ${firstName},</p>
          <p style="margin: 0 0 28px 0; font-size: 15px; color: #475569; line-height: 1.7;">
            Your subcontractor account has been created on the JG Painting Pros portal. You can log in at any time using the credentials below to view your assignments, job details, and more.
          </p>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px 28px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Your Login Credentials</p>
            <div style="margin-top: 16px;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">
                <span style="font-weight: 600; color: #1e293b; display: inline-block; width: 80px;">Email:</span>
                <span style="color: #1d4ed8;">${info.email}</span>
              </p>
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                <span style="font-weight: 600; color: #1e293b; display: inline-block; width: 80px;">Password:</span>
                <span style="font-family: 'Courier New', monospace; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; color: #1e293b;">${info.password}</span>
              </p>
            </div>
          </div>
          <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 14px 18px; margin-bottom: 28px;">
            <p style="margin: 0; font-size: 13px; color: #854d0e; line-height: 1.6;">
              ⚠️ <strong>This is a temporary password.</strong> You will be prompted to create a new password the first time you log in. Please keep this email secure until then.
            </p>
          </div>
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${loginUrl}" style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.01em;">
              Log In to Your Account →
            </a>
          </div>
          <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center;">
            Or copy and paste this link into your browser:<br/>
            <a href="${loginUrl}" style="color: #3b82f6; text-decoration: none;">${loginUrl}</a>
          </p>
        </div>
        <div style="padding: 24px 32px; background: #1e293b; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #94a3b8;">JG Painting Pros · Subcontractor Portal</p>
          <p style="margin: 0; font-size: 12px; color: #64748b;">Please keep your credentials secure and do not share them.</p>
        </div>
      </div>
    `;
  };

  const handleSendWelcomeEmail = async () => {
    if (!pendingWelcomeEmail) return;
    setSendingWelcomeEmail(true);
    try {
      const loginUrl = 'https://portal.jgpaintingpros.com';
      const firstName = pendingWelcomeEmail.full_name?.split(' ')[0] || 'there';
      const html = buildWelcomeEmailHtml(pendingWelcomeEmail);

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: pendingWelcomeEmail.email,
          subject: 'Welcome to JG Painting Pros – Your Account is Ready',
          html,
          text: `Hi ${firstName},\n\nYour subcontractor account has been created.\n\nEmail: ${pendingWelcomeEmail.email}\nTemporary Password: ${pendingWelcomeEmail.password}\n\nIMPORTANT: You will be prompted to create a new password the first time you log in.\n\nLog in at: ${loginUrl}\n\nPlease keep your credentials secure.\n\n— JG Painting Pros`
        }
      });

      if (error) throw error;

      toast.success(`Welcome email sent to ${pendingWelcomeEmail.email}`);
    } catch (err) {
      console.error('Error sending welcome email:', err);
      toast.error('Failed to send welcome email');
    } finally {
      setSendingWelcomeEmail(false);
      const userId = pendingWelcomeEmail?.userId;
      setShowWelcomeEmailPrompt(false);
      setPendingWelcomeEmail(null);
      if (userId) {
        setTimeout(() => navigate(`/dashboard/subcontractor/edit/${userId}`), 300);
      }
    }
  };

  const handleSkipWelcomeEmail = () => {
    const userId = pendingWelcomeEmail?.userId;
    setShowWelcomeEmailPrompt(false);
    setPendingWelcomeEmail(null);
    if (userId) {
      navigate(`/dashboard/subcontractor/edit/${userId}`);
    }
  };

  const formatRoleLabel = (role: string) => {
    if (role === 'jg_management') return 'JG Management';
    if (role === 'assistant_manager') return 'Assistant Manager';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck className="h-3 w-3 mr-1" />;
      case 'assistant_manager':
        return <ShieldCheck className="h-3 w-3 mr-1" />;
      case 'jg_management':
        return <UserCog className="h-3 w-3 mr-1" />;
      case 'subcontractor':
        return <User className="h-3 w-3 mr-1" />;
      default:
        return <User className="h-3 w-3 mr-1" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'assistant_manager':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'jg_management':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'subcontractor':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    return formatDistanceToNow(new Date(lastSeen), { addSuffix: true });
  };

  // Render action buttons for a user
  const handleResendWelcomeEmail = async (user: User) => {
    setResendingEmailForUserId(user.id);
    try {
      const loginUrl = 'https://portal.jgpaintingpros.com';
      const firstName = user.full_name?.split(' ')[0] || 'there';
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Welcome to JG Painting Pros</h1>
            <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 16px;">Your subcontractor portal access</p>
          </div>
          <div style="padding: 36px 32px; background: #f8fafc; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <p style="margin: 0 0 24px 0; font-size: 17px; color: #1e293b; line-height: 1.6;">Hi ${firstName},</p>
            <p style="margin: 0 0 28px 0; font-size: 15px; color: #475569; line-height: 1.7;">
              This is a reminder that you have an active subcontractor account on the JG Painting Pros portal. Log in below to view your assignments and job details.
            </p>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px 28px; margin-bottom: 28px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Your Login Email</p>
              <p style="margin: 8px 0 0 0; font-size: 15px; color: #1d4ed8;">${user.email}</p>
            </div>
            <div style="text-align: center; margin-bottom: 28px;">
              <a href="${loginUrl}" style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 8px;">
                Log In to Your Account →
              </a>
            </div>
            <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center;">If you've forgotten your password, contact your JG Painting Pros administrator.</p>
          </div>
          <div style="padding: 24px 32px; background: #1e293b; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #94a3b8;">JG Painting Pros · Subcontractor Portal</p>
          </div>
        </div>
      `;
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: user.email,
          subject: 'Your JG Painting Pros Subcontractor Portal Access',
          html,
          text: `Hi ${firstName},\n\nThis is a reminder that you have an active subcontractor account.\n\nLogin email: ${user.email}\nPortal: ${loginUrl}\n\nIf you forgot your password, contact your administrator.\n\n— JG Painting Pros`,
        },
      });
      if (error) throw error;
      toast.success(`Welcome email resent to ${user.email}`);
    } catch (err) {
      console.error('Error resending welcome email:', err);
      toast.error('Failed to resend welcome email');
    } finally {
      setResendingEmailForUserId(null);
      setShowResendConfirm(null);
    }
  };

  const renderActionButtons = (user: User) => {
    return (
      <div className="flex justify-end space-x-3">
        {/* View Profile - Only show for non-admins OR if viewing own profile */}
        {(user.role !== 'admin' || user.id === currentUserId) && (
          <button
            onClick={() => {
              if (user.role === 'subcontractor') {
                navigate(`/dashboard/subcontractor/edit/${user.id}`);
              } else {
                navigate(`/dashboard/profile/${user.id}`);
              }
            }}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            title="View Profile"
          >
            <Eye className="h-5 w-5" />
          </button>
        )}

        {/* Subcontractor admin view */}
        {user.role === 'subcontractor' && (
          <button
            onClick={() => setSubcontractorAdminUser(user)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300"
            title="Subcontractor Admin View"
          >
            <ClipboardList className="h-5 w-5" />
          </button>
        )}

        {user.role === 'subcontractor' && (
          <button
            onClick={() => setShowResendConfirm(user)}
            disabled={resendingEmailForUserId === user.id}
            className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 disabled:opacity-40"
            title="Resend Welcome Email"
          >
            {resendingEmailForUserId === user.id
              ? <Send className="h-5 w-5 animate-pulse" />
              : <Mail className="h-5 w-5" />}
          </button>
        )}
        
        {/* Change Password - Allow for all users */}
        <button
          onClick={() => {
            setSelectedUser(user);
            setPasswordData({
              password: '',
              confirmPassword: ''
            });
            setShowChangePasswordModal(true);
          }}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
          title="Change Password"
        >
          <Key className="h-5 w-5" />
        </button>
        
        {/* Edit Profile - Allow for all users */}
        {user.role === 'subcontractor' ? (
          <Link
            to={`/dashboard/subcontractor/edit/${user.id}`}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
            title="Edit Profile"
          >
            <Edit className="h-5 w-5" />
          </Link>
        ) : (
          <button
            onClick={() => {
              setSelectedUser(user);
              setFormData({
                email: user.email,
                password: '',
                confirmPassword: '',
                full_name: user.full_name || '',
                role: user.role,
                working_days: user.working_days || {
                  sunday: true,
                  monday: true,
                  tuesday: true,
                  wednesday: true,
                  thursday: true,
                  friday: true,
                  saturday: false
                }
              });
              setShowEditUserModal(true);
            }}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
            title="Edit User"
          >
            <Edit className="h-5 w-5" />
          </button>
        )}
        
        {/* Delete User */}
        {canDeleteUsers && (
          <button
            onClick={() => {
              setSelectedUser(user);
              setShowDeleteConfirm(true);
            }}
            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
            title="Delete User"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setRoleFilter([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">
          <XCircle className="h-12 w-12 mx-auto" />
        </div>
        <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Users</p>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-4 sm:space-y-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={async () => {
                setRefreshing(true);
                await fetchUsers();
                setRefreshing(false);
              }}
              disabled={refreshing}
              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Refresh Users"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 transition-colors ${
                showFilters 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              title="Toggle Filters"
            >
              <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  const tempPwd = generateTempPassword();
                  setFormData(prev => ({ ...prev, email: '', full_name: '', role: 'subcontractor', password: tempPwd, confirmPassword: tempPwd }));
                  setShowAddUserModal(true);
                }}
                className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Add User</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {showFilters && (
            <div className="flex flex-wrap gap-2">
              {['admin', 'assistant_manager', 'jg_management', 'subcontractor', 'user'].map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    setRoleFilter(prev => 
                      prev.includes(role) 
                        ? prev.filter(r => r !== role)
                        : [...prev, role]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    roleFilter.includes(role)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {role === 'jg_management' ? 'JG Management' : role === 'assistant_manager' ? 'Assistant Manager' : role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
              {(searchTerm || roleFilter.length > 0) && (
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-1 rounded-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Currently Online Users */}
          {/* Note: Users are sorted by most recently active first (maintained from the main sorting) */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3 border-2 border-white dark:border-[#1E293B] shadow-sm"></div>
              Currently Online ({filteredUsers.filter(user => isOnline(user.id)).length})
            </h2>
            
            {filteredUsers.filter(user => isOnline(user.id)).length > 0 ? (
              <div className="bg-white dark:bg-[#1E293B] rounded-lg overflow-hidden shadow">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2D3B4E]">
                  <thead>
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Seen
                      </th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
                    {filteredUsers.filter(user => isOnline(user.id)).map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.role === 'subcontractor' ? (
                            <button
                              type="button"
                              onClick={() => setSubcontractorAdminUser(user)}
                              className="text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Open subcontractor admin view"
                            >
                              <UserChip
                                user={user}
                                isOnline={isOnline(user.id)}
                                size="lg"
                              />
                            </button>
                          ) : (
                            <UserChip
                              user={user}
                              isOnline={isOnline(user.id)}
                              size="lg"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                            {getRoleIcon(user.role)}
                            {formatRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-500 rounded-full mr-2 border-2 border-white dark:border-[#1E293B] shadow-sm"></div>
                            <span>{formatLastSeen(user.last_seen)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {renderActionButtons(user)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-8 text-center">
                <div className="text-gray-500 dark:text-gray-400">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UsersIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium">No users currently online</p>
                  <p className="text-sm">Users will appear here when they come online</p>
                </div>
              </div>
            )}
          </div>

          {/* Currently Offline Users */}
          {/* Note: Users are sorted by most recently active first (maintained from the main sorting) */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-3 border-2 border-white dark:border-[#1E293B] shadow-sm"></div>
              Currently Offline ({filteredUsers.filter(user => !isOnline(user.id)).length})
            </h2>
            
            {filteredUsers.filter(user => !isOnline(user.id)).length > 0 ? (
              <div className="bg-white dark:bg-[#1E293B] rounded-lg overflow-hidden shadow">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2D3B4E]">
                  <thead>
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Seen
                      </th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
                    {filteredUsers.filter(user => !isOnline(user.id)).map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.role === 'subcontractor' ? (
                            <button
                              type="button"
                              onClick={() => setSubcontractorAdminUser(user)}
                              className="text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Open subcontractor admin view"
                            >
                              <UserChip
                                user={user}
                                isOnline={isOnline(user.id)}
                                size="lg"
                              />
                            </button>
                          ) : (
                            <UserChip
                              user={user}
                              isOnline={isOnline(user.id)}
                              size="lg"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                            {getRoleIcon(user.role)}
                            {formatRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-red-500 rounded-full mr-2 border-2 border-white dark:border-[#1E293B] shadow-sm"></div>
                            <span>{formatLastSeen(user.last_seen)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {renderActionButtons(user)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-8 text-center">
                <div className="text-gray-500 dark:text-gray-400">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UsersIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm">All users are currently online</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {subcontractorAdminUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Subcontractor Admin View</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Jobs and preferred-property assignments</p>
              </div>
              <button
                type="button"
                onClick={() => setSubcontractorAdminUser(null)}
                className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-[#0F172A]"
                title="Close"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <SubcontractorAdminView
                userId={subcontractorAdminUser.id}
                userName={subcontractorAdminUser.full_name || subcontractorAdminUser.email}
                userEmail={subcontractorAdminUser.email}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New User</h3>
            <form onSubmit={handleAddUser} className="space-y-4" autoComplete="off">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    // Auto-generate temp password when switching to subcontractor
                    const newPassword = newRole === 'subcontractor' ? generateTempPassword() : '';
                    setFormData({ ...formData, role: newRole, password: newPassword, confirmPassword: newPassword });
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="off"
                >
                  <option value="subcontractor">Subcontractor</option>
                  <option value="jg_management">JG Management</option>
                  <option value="assistant_manager">Assistant Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Password fields */}
              {formData.role === 'subcontractor' ? (
                /* Subcontractor — auto-generated temp password */
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Temporary Password <span className="text-xs font-normal text-gray-400">(auto-generated)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={formData.password}
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-[#0F172A]/60 border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white font-mono text-sm select-all cursor-default"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(formData.password);
                        toast.success('Password copied to clipboard');
                      }}
                      className="px-3 py-2 bg-gray-200 dark:bg-[#2D3B4E] hover:bg-gray-300 dark:hover:bg-[#3D4E63] rounded-lg text-gray-700 dark:text-gray-300 text-xs font-medium transition-colors"
                      title="Copy password"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, password: generateTempPassword(), confirmPassword: '' })}
                      className="px-3 py-2 bg-gray-200 dark:bg-[#2D3B4E] hover:bg-gray-300 dark:hover:bg-[#3D4E63] rounded-lg text-gray-700 dark:text-gray-300 text-xs font-medium transition-colors"
                      title="Regenerate"
                    >
                      ↻
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                    <span>⚠️</span>
                    <span>This temporary password will be included in the welcome email. The user <strong>will be prompted to set a new password</strong> on first login.</span>
                  </p>
                </div>
              ) : (
                /* Non-subcontractor — manual password entry */
                <>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirm-password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit User</h3>
            <form onSubmit={handleEditUser} className="space-y-4" autoComplete="off">
              <div>
                <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="edit-email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="edit-full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  id="edit-role"
                  name="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="off"
                >
                  <option value="subcontractor">Subcontractor</option>
                  <option value="jg_management">JG Management</option>
                  <option value="assistant_manager">Assistant Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-2">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 To change the user's password, use the "Change Password" button (key icon) from the users list.
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="new-password"
                  value={passwordData.password}
                  onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirm-new-password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete User</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <strong>{selectedUser.full_name || selectedUser.email}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Email Confirmation Modal */}
      {showWelcomeEmailPrompt && pendingWelcomeEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-5 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Send Welcome Email?</h3>
                  <p className="text-blue-100 text-sm">Subcontractor account created successfully</p>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                Send a welcome email to <strong className="text-gray-900 dark:text-white">{pendingWelcomeEmail.full_name}</strong> with their login credentials?
              </p>

              {/* Admin notice */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">⚠️ Heads up — temporary password included</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  This email will include the <strong>auto-generated temporary password</strong> shown on the previous screen.
                  The recipient will be <strong>prompted to create a new password</strong> the first time they log in.
                  Once they change it, the temporary password will no longer work.
                </p>
              </div>

              {/* Toggle preview */}
              <button
                onClick={() => setShowEmailPreview(p => !p)}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mb-4"
              >
                <Eye className="h-4 w-4" />
                {showEmailPreview ? 'Hide email preview' : 'Show email preview'}
              </button>

              {/* Rendered email preview */}
              {showEmailPreview && (
                <div className="mb-5 rounded-xl overflow-hidden border border-gray-200 dark:border-[#334155] shadow-inner">
                  <div className="bg-gray-100 dark:bg-[#0F172A] px-4 py-2 flex items-center gap-3 border-b border-gray-200 dark:border-[#334155]">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Email Preview</span>
                  </div>
                  <div className="bg-white overflow-auto max-h-96">
                    <iframe
                      srcDoc={buildWelcomeEmailHtml(pendingWelcomeEmail)}
                      className="w-full min-h-[420px] border-0"
                      title="Welcome email preview"
                      sandbox=""
                    />
                  </div>
                </div>
              )}

              {/* Quick info row */}
              {!showEmailPreview && (
                <div className="bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-xl p-4 mb-5 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">This email will include</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                      <CheckCircle className="h-3 w-3" /> Login email address
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                      <CheckCircle className="h-3 w-3" /> Temporary password
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                      <CheckCircle className="h-3 w-3" /> Portal login link
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                      <CheckCircle className="h-3 w-3" /> Password-change reminder
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons — fixed at bottom */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-[#334155] shrink-0 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSendWelcomeEmail}
                disabled={sendingWelcomeEmail}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold transition-colors text-sm"
              >
                {sendingWelcomeEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Confirm &amp; Send Welcome Email
                  </>
                )}
              </button>
              <button
                onClick={handleSkipWelcomeEmail}
                disabled={sendingWelcomeEmail}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resend Welcome Email Confirm Modal */}
      {showResendConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Resend Welcome Email</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{showResendConfirm.email}</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Resend a portal access email to{' '}
              <strong className="text-gray-900 dark:text-white">{showResendConfirm.full_name || showResendConfirm.email}</strong>.
            </p>

            {/* Admin notice */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2.5 mb-4 space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">⚠️ No password in this email</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                This resend does <strong>not</strong> include a new password — it only sends their login email and a link to the portal.
                If they've forgotten their password, use the <strong>Change Password</strong> (key icon) to reset it first, then resend.
              </p>
            </div>

            {/* What's included */}
            <div className="bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-lg px-3 py-2.5 mb-5 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">This email will include</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                  <CheckCircle className="h-3 w-3" /> Login email address
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                  <CheckCircle className="h-3 w-3" /> Portal login link
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleResendWelcomeEmail(showResendConfirm)}
                disabled={resendingEmailForUserId === showResendConfirm.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {resendingEmailForUserId === showResendConfirm.id ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Sending…</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Email</>
                )}
              </button>
              <button
                onClick={() => setShowResendConfirm(null)}
                disabled={resendingEmailForUserId !== null}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
