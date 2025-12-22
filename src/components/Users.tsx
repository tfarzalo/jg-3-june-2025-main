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
  Eye
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
  
  // Use the new presence hooks
  const { isOnline } = usePresence();
  const { touchLastSeen } = useLastSeen();
  
  // Get current user role for access control
  const { role: currentUserRole, isAdmin } = useUserRole();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
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
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
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
      
      // If the created user is a Subcontractor, navigate to their profile edit page
      if (createdRole === 'subcontractor' && newUserId) {
        console.log('🔄 Redirecting to subcontractor edit page:', `/dashboard/subcontractor/edit/${newUserId}`);
        toast.success('Redirecting to profile edit page...');
        setTimeout(() => {
          navigate(`/dashboard/subcontractor/edit/${newUserId}`);
        }, 500);
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
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

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

      // Update password if provided
      if (formData.password) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          selectedUser.id,
          { password: formData.password }
        );

        if (passwordError) {
          console.error('Password update error:', passwordError);
          toast.warning('Profile updated but password change failed. Please contact support.');
        }
      }

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
    
    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setChangingPassword(true);

      const { error } = await supabase.auth.admin.updateUserById(
        selectedUser.id,
        { password: passwordData.password }
      );

      if (error) throw error;

      toast.success('Password changed successfully');
      setShowChangePasswordModal(false);
      setSelectedUser(null);
      setPasswordData({
        password: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
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
        
        {/* Delete User - Allow for all users */}
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
              onClick={() => setRefreshing(true)}
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
                onClick={() => setShowAddUserModal(true)}
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
              {['admin', 'jg_management', 'subcontractor', 'user'].map((role) => (
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
                  {role === 'jg_management' ? 'JG Management' : role.charAt(0).toUpperCase() + role.slice(1)}
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
                          <UserChip 
                            user={user}
                            isOnline={isOnline(user.id)}
                            size="lg"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                            {getRoleIcon(user.role)}
                            {user.role === 'jg_management' ? 'JG Management' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
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
                          <UserChip 
                            user={user}
                            isOnline={isOnline(user.id)}
                            size="lg"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                            {getRoleIcon(user.role)}
                            {user.role === 'jg_management' ? 'JG Management' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
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
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="off"
                >
                  <option value="subcontractor">Subcontractor</option>
                  <option value="jg_management">JG Management</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
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
                <label htmlFor="edit-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  id="edit-password"
                  name="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="edit-confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="edit-confirmPassword"
                  name="confirm-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1E293B]"
                  autoComplete="new-password"
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
                  <option value="admin">Admin</option>
                </select>
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
    </div>
  );
}