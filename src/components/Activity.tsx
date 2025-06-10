import React, { useState, useEffect } from 'react';
import { 
  Activity as ActivityIcon, 
  Clock, 
  ArrowRight, 
  Calendar, 
  Building2, 
  FileText, 
  Search, 
  Filter, 
  ChevronDown,
  User,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseISO, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '../lib/supabase';

interface ActivityItem {
  id: string;
  job_id: string;
  changed_by: string;
  from_phase_id: string | null;
  to_phase_id: string;
  change_reason: string | null;
  changed_at: string;
  from_phase_label: string | null;
  from_phase_color: string | null;
  to_phase_label: string;
  to_phase_color: string;
  job_work_order_num: number;
  job_unit_number: string;
  property_name: string;
  user_full_name: string | null;
}

export function Activity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);
  const [phases, setPhases] = useState<{label: string, color: string}[]>([]);
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    fetchActivities();
    fetchPhases();
    fetchUsers();
  }, [dateFilter, phaseFilter, userFilter]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      
      // First, get the job phase changes
      let query = supabase
        .from('job_phase_changes')
        .select(`
          id,
          job_id,
          changed_by,
          from_phase_id,
          to_phase_id,
          change_reason,
          changed_at
        `)
        .order('changed_at', { ascending: false });

      // Apply date filter
      if (dateFilter === 'today') {
        const today = new Date();
        const startOfToday = formatInTimeZone(
          today, 
          'America/New_York', 
          "yyyy-MM-dd'T'00:00:00XXX"
        );
        query = query.gte('changed_at', startOfToday);
      } else if (dateFilter === 'week') {
        const weekAgo = subDays(new Date(), 7);
        query = query.gte('changed_at', weekAgo.toISOString());
      } else if (dateFilter === 'month') {
        const monthAgo = subDays(new Date(), 30);
        query = query.gte('changed_at', monthAgo.toISOString());
      }

      // Apply user filter
      if (userFilter.length > 0) {
        query = query.in('changed_by', userFilter);
      }

      const { data: phaseChanges, error: phaseChangesError } = await query;

      if (phaseChangesError) throw phaseChangesError;
      if (!phaseChanges || phaseChanges.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      // Get all the phase IDs we need to fetch
      const fromPhaseIds = phaseChanges.map(change => change.from_phase_id).filter(Boolean) as string[];
      const toPhaseIds = phaseChanges.map(change => change.to_phase_id);
      const allPhaseIds = [...new Set([...fromPhaseIds, ...toPhaseIds])];

      // Get all the job IDs we need to fetch
      const jobIds = phaseChanges.map(change => change.job_id);

      // Get all the user IDs we need to fetch
      const userIds = phaseChanges.map(change => change.changed_by);

      // Fetch all phases
      const { data: phasesData, error: phasesError } = await supabase
        .from('job_phases')
        .select('id, job_phase_label, color_dark_mode')
        .in('id', allPhaseIds);

      if (phasesError) throw phasesError;

      // Create a map of phase ID to phase data
      const phaseMap = phasesData.reduce((acc, phase) => {
        acc[phase.id] = {
          label: phase.job_phase_label,
          color: phase.color_dark_mode
        };
        return acc;
      }, {} as Record<string, { label: string, color: string }>);

      // Apply phase filter if needed
      let filteredChanges = phaseChanges;
      if (phaseFilter.length > 0) {
        filteredChanges = phaseChanges.filter(change => {
          const toPhase = phaseMap[change.to_phase_id];
          return toPhase && phaseFilter.includes(toPhase.label);
        });
      }

      // Fetch all jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          property:properties(
            property_name
          )
        `)
        .in('id', jobIds);

      if (jobsError) throw jobsError;

      // Create a map of job ID to job data
      const jobMap = jobsData.reduce((acc, job) => {
        acc[job.id] = {
          work_order_num: job.work_order_num,
          unit_number: job.unit_number,
          property_name: job.property?.property_name || 'Unknown Property'
        };
        return acc;
      }, {} as Record<string, { work_order_num: number, unit_number: string, property_name: string }>);

      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (usersError) throw usersError;

      // Create a map of user ID to user data
      const userMap = usersData.reduce((acc, user) => {
        acc[user.id] = user.full_name;
        return acc;
      }, {} as Record<string, string>);

      // Combine all the data
      const transformedData = filteredChanges.map(change => {
        const job = jobMap[change.job_id] || { 
          work_order_num: 0, 
          unit_number: 'Unknown', 
          property_name: 'Unknown Property' 
        };
        
        const fromPhase = change.from_phase_id ? phaseMap[change.from_phase_id] : null;
        const toPhase = phaseMap[change.to_phase_id];
        
        return {
          id: change.id,
          job_id: change.job_id,
          changed_by: change.changed_by,
          from_phase_id: change.from_phase_id,
          to_phase_id: change.to_phase_id,
          change_reason: change.change_reason,
          changed_at: change.changed_at,
          from_phase_label: fromPhase?.label || null,
          from_phase_color: fromPhase?.color || null,
          to_phase_label: toPhase?.label || 'Unknown Phase',
          to_phase_color: toPhase?.color || '#4B5563',
          job_work_order_num: job.work_order_num,
          job_unit_number: job.unit_number,
          property_name: job.property_name,
          user_full_name: userMap[change.changed_by] || 'Unknown User'
        };
      });

      setActivities(transformedData);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  };

  const fetchPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('job_phases')
        .select('job_phase_label, color_dark_mode')
        .order('sort_order');

      if (error) throw error;
      setPhases(data.map(phase => ({
        label: phase.job_phase_label,
        color: phase.color_dark_mode
      })));
    } catch (err) {
      console.error('Error fetching phases:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(data.map(user => ({
        id: user.id,
        name: user.full_name || 'Unknown User'
      })));
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const formatActivityDate = (dateString: string) => {
    return formatInTimeZone(
      parseISO(dateString),
      'America/New_York',
      'MMM d, yyyy h:mm a'
    );
  };

  const formatRelativeTime = (dateString: string) => {
    const date = parseISO(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return formatInTimeZone(date, 'America/New_York', 'MMM d, yyyy');
    }
  };

  const togglePhaseFilter = (phase: string) => {
    if (phaseFilter.includes(phase)) {
      setPhaseFilter(phaseFilter.filter(p => p !== phase));
    } else {
      setPhaseFilter([...phaseFilter, phase]);
    }
  };

  const toggleUserFilter = (userId: string) => {
    if (userFilter.includes(userId)) {
      setUserFilter(userFilter.filter(id => id !== userId));
    } else {
      setUserFilter([...userFilter, userId]);
    }
  };

  const filteredActivities = activities.filter(activity => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      activity.property_name.toLowerCase().includes(searchTermLower) ||
      activity.job_unit_number.toLowerCase().includes(searchTermLower) ||
      activity.to_phase_label.toLowerCase().includes(searchTermLower) ||
      (activity.from_phase_label && activity.from_phase_label.toLowerCase().includes(searchTermLower)) ||
      (activity.user_full_name && activity.user_full_name.toLowerCase().includes(searchTermLower)) ||
      formatWorkOrderNumber(activity.job_work_order_num).toLowerCase().includes(searchTermLower)
    );
  });

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <ActivityIcon className="h-8 w-8 text-gray-600 dark:text-gray-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Activity Log</h1>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#1E293B] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex space-x-4">
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center px-4 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              <ChevronDown className="h-4 w-4 ml-2" />
            </button>
            
            {filterOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-10 border border-gray-200 dark:border-[#2D3B4E]">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Date Range</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="dateFilter"
                        value="all"
                        checked={dateFilter === 'all'}
                        onChange={() => setDateFilter('all')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">All time</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="dateFilter"
                        value="today"
                        checked={dateFilter === 'today'}
                        onChange={() => setDateFilter('today')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Today</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="dateFilter"
                        value="week"
                        checked={dateFilter === 'week'}
                        onChange={() => setDateFilter('week')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Last 7 days</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="dateFilter"
                        value="month"
                        checked={dateFilter === 'month'}
                        onChange={() => setDateFilter('month')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Last 30 days</span>
                    </label>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 dark:border-[#2D3B4E] p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Job Phases</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {phases.map(phase => (
                      <label key={phase.label} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={phaseFilter.includes(phase.label)}
                          onChange={() => togglePhaseFilter(phase.label)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <span 
                          className="ml-2 flex items-center"
                          style={{ color: phase.color }}
                        >
                          <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: phase.color }}></span>
                          {phase.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="border-t border-gray-200 dark:border-[#2D3B4E] p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Users</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {users.map(user => (
                      <label key={user.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={userFilter.includes(user.id)}
                          onChange={() => toggleUserFilter(user.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">{user.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="border-t border-gray-200 dark:border-[#2D3B4E] p-4 flex justify-end">
                  <button
                    onClick={() => {
                      setDateFilter('all');
                      setPhaseFilter([]);
                      setUserFilter([]);
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filter indicators */}
      {(phaseFilter.length > 0 || userFilter.length > 0) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {phaseFilter.map(phase => (
            <div 
              key={phase}
              className="flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
            >
              <span>{phase}</span>
              <button 
                onClick={() => togglePhaseFilter(phase)}
                className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          {userFilter.map(userId => {
            const user = users.find(u => u.id === userId);
            return user ? (
              <div 
                key={userId}
                className="flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
              >
                <User className="h-3 w-3 mr-1" />
                <span>{user.name}</span>
                <button 
                  onClick={() => toggleUserFilter(userId)}
                  className="ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ) : null;
          })}
          
          <button
            onClick={() => {
              setPhaseFilter([]);
              setUserFilter([]);
            }}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-12 text-center shadow">
          <ActivityIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No activity found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search or filters' : 'There is no activity to display for the selected filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="p-6 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <ActivityIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <Link 
                          to={`/dashboard/jobs/${activity.job_id}`}
                          className="text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {formatWorkOrderNumber(activity.job_work_order_num)}
                        </Link>
                        <span className="mx-2 text-gray-500 dark:text-gray-400">•</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {activity.property_name} - Unit {activity.job_unit_number}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(activity.changed_at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center mb-2">
                      <span className="text-gray-700 dark:text-gray-300 mr-2">Phase changed:</span>
                      {activity.from_phase_label && (
                        <>
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2"
                            style={{ 
                              backgroundColor: activity.from_phase_color || '#4B5563',
                              color: 'white'
                            }}
                          >
                            {activity.from_phase_label}
                          </span>
                          <ArrowRight className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                        </>
                      )}
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: activity.to_phase_color || '#4B5563',
                          color: 'white'
                        }}
                      >
                        {activity.to_phase_label}
                      </span>
                    </div>
                    
                    {activity.change_reason && (
                      <div className="mb-2 text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Reason:</span> {activity.change_reason}
                      </div>
                    )}
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <User className="h-4 w-4 mr-1" />
                      <span>{activity.user_full_name || 'Unknown User'}</span>
                      <span className="mx-2">•</span>
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{formatActivityDate(activity.changed_at)}</span>
                    </div>
                    
                    <div className="mt-3 flex items-center">
                      <Link 
                        to={`/dashboard/jobs/${activity.job_id}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                      >
                        View Job Details
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}