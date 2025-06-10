import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  CheckCircle, 
  XCircle,
  FileText,
  ArrowRight,
  FileEdit
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfDay, endOfDay, addDays, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useUserRole } from '../hooks/useUserRole';
import { LoadingScreen } from './ui/LoadingScreen';

interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  scheduled_date: string;
  property: {
    property_name: string;
    address: string;
    city: string;
    state: string;
  } | null;
  job_phase: {
    job_phase_label: string;
    color_dark_mode: string;
    id: string;
  } | null;
  job_type: {
    job_type_label: string;
  } | null;
  work_order?: {
    id: string;
  } | null;
}

export function SubcontractorDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [tomorrowJobs, setTomorrowJobs] = useState<Job[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [displayedJobs, setDisplayedJobs] = useState<Job[]>([]);
  const { role } = useUserRole();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const previewUserId = searchParams.get('userId');
  const isPreview = previewUserId && (role === 'admin' || role === 'jg_management');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      console.log('useEffect: Initial job fetch triggered.');
      try {
        setLoading(true);
        // Fetch both today's and tomorrow's jobs initially
        const [todayData, tomorrowData] = await Promise.all([
          fetchJobsForDate(new Date()),
          fetchJobsForDate(addDays(new Date(), 1))
        ]);
        console.log('fetchJobs: Today data fetched:', todayData);
        console.log('fetchJobs: Tomorrow data fetched:', tomorrowData);
        setTodayJobs(todayData || []);
        setTomorrowJobs(tomorrowData || []);
      } catch (err) {
        console.error('Error fetching initial jobs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
        setTodayJobs([]);
        setTomorrowJobs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [previewUserId]); // Re-run if preview user changes

  useEffect(() => {
    console.log('useEffect: selectedDate or jobs state changed.');
    console.log('  selectedDate:', selectedDate);
    console.log('  todayJobs count:', todayJobs.length);
    console.log('  tomorrowJobs count:', tomorrowJobs.length);
    
    // Update displayed jobs when selected date changes
    if (isSameDay(selectedDate, new Date())) {
      console.log('  Setting displayedJobs to todayJobs.');
      setDisplayedJobs(todayJobs);
    } else if (isSameDay(selectedDate, addDays(new Date(), 1))) {
      console.log('  Setting displayedJobs to tomorrowJobs.');
      setDisplayedJobs(tomorrowJobs);
    } else {
      console.log('  Fetching jobs for selected date:', selectedDate);
      // For other dates, fetch jobs specifically for that date
      fetchJobsForDate(selectedDate).then(jobs => {
        console.log('  fetchJobsForDate result for selected date:', jobs);
        setDisplayedJobs(jobs || []);
      }).catch(err => {
        console.error('Error setting displayed jobs for date:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs for date');
        setDisplayedJobs([]);
      });
    }
  }, [selectedDate, todayJobs, tomorrowJobs]);

  useEffect(() => {
    // Show loading screen for 4 seconds
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const fetchJobsForDate = async (date: Date): Promise<Job[] | undefined> => {
    console.log('fetchJobsForDate called for date:', date);
    try {
      // Get user ID - either from query param (for preview) or current user
      let userId: string | undefined;
      
      if (previewUserId) {
        // Admin/Management is previewing a subcontractor's dashboard
        userId = previewUserId;
        console.log('fetchJobsForDate: Using preview userId:', userId);
      } else {
        // Regular subcontractor viewing their own dashboard
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('fetchJobsForDate: Supabase getUser error:', userError);
          throw userError;
        }
        if (!userData.user) {
          console.error('fetchJobsForDate: Supabase getUser returned no user.');
          throw new Error('User not found');
        }
        userId = userData.user.id;
        console.log('fetchJobsForDate: Using current userId:', userId);
      }
      
      if (!userId) {
        console.error('fetchJobsForDate: userId is null or undefined.');
        throw new Error('No user ID available');
      }
      
      // Get date range in Eastern Time
      const startOfDate = formatInTimeZone(
        date, 
        'America/New_York', 
        "yyyy-MM-dd'T'00:00:00XXX"
      );
      
      const endOfDate = formatInTimeZone(
        date, 
        'America/New_York', 
        "yyyy-MM-dd'T'23:59:59XXX"
      );
      
      console.log(`fetchJobsForDate: Date range (ET): ${startOfDate} to ${endOfDate}`);

      // Get job phase ID for "Job Request" phase only
      console.log('fetchJobsForDate: Fetching Job Request phase ID.');
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Job Request');
        
      if (phaseError) {
        console.error('fetchJobsForDate: Supabase job_phases fetch error:', phaseError);
        throw phaseError;
      }
      
      if (!phaseData || phaseData.length === 0) {
        console.warn('fetchJobsForDate: "Job Request" phase not found in job_phases table.');
        return []; // No jobs to fetch if phase not found
      }
      
      const jobRequestPhaseId = phaseData[0].id;
      console.log('fetchJobsForDate: Job Request phase ID:', jobRequestPhaseId);
      
      // Get jobs assigned to this subcontractor for the selected date that are in Job Request phase
      console.log(`fetchJobsForDate: Fetching jobs for userId ${userId} in phase ${jobRequestPhaseId} between ${startOfDate} and ${endOfDate}`);
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          property:properties (
            property_name,
            address,
            city,
            state
          ),
          job_phase:current_phase_id (
            job_phase_label,
            color_dark_mode,
            id
          ),
          job_type:job_types (
            job_type_label
          ),
          work_order:work_orders (
            id
          )
        `)
        .eq('assigned_to', userId)
        .eq('current_phase_id', jobRequestPhaseId)
        .gte('scheduled_date', startOfDate)
        .lte('scheduled_date', endOfDate)
        .order('scheduled_date', { ascending: true });
        
      if (jobsError) {
        console.error('fetchJobsForDate: Supabase jobs fetch error:', jobsError);
        throw jobsError;
      }
      
      console.log('fetchJobsForDate: Raw jobs data received:', jobsData);

      // Map the data to match the Job interface, ensuring nested objects are always present with fallbacks
      const mappedJobs: Job[] = (jobsData || []).map(job => ({
        ...job,
        property: (job.property as any)?.[0] || {
          property_name: 'Unknown Property',
          address: 'No address available',
          city: '',
          state: '',
        } as Job['property'], // Cast the fallback to the correct type
        job_phase: (job.job_phase as any)?.[0] || {
          job_phase_label: 'Unknown Phase',
          color_dark_mode: '#6B7280',
          id: '',
        } as Job['job_phase'], // Cast the fallback to the correct type
        job_type: (job.job_type as any)?.[0] || {
          job_type_label: 'Unknown Type',
        } as Job['job_type'], // Cast the fallback to the correct type
        work_order: (job.work_order as any)?.[0] || null,
      }));
      
      console.log('fetchJobsForDate: Mapped jobs:', mappedJobs);
      return mappedJobs;
      
    } catch (err) {
      console.error('Error fetching jobs for date:', date, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs for date');
      return undefined; // Return undefined on error
    }
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const formatAddress = (property: Job['property']) => {
     if (!property) return 'No address available';
    return `${property.address}, ${property.city}, ${property.state}`;
  };

  // Determine if selected date is today
  const isToday = isSameDay(selectedDate, new Date());
  
  // Determine if selected date is tomorrow
  const isTomorrow = isSameDay(selectedDate, addDays(new Date(), 1));

  if (isLoading) {
    return <LoadingScreen message="Loading your workspace..." />;
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      {isPreview && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg">
          <p className="flex items-center font-medium">
            <CalendarIcon className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400" />
            You are viewing the subcontractor dashboard as {role === 'admin' ? 'an administrator' : 'JG Management'}
          </p>
          <p className="mt-1 text-sm">
            This is a preview of what the subcontractor sees. Any actions taken here will affect the actual data.
          </p>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <CalendarIcon className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">My Assigned Jobs</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSelectedDate(new Date())}
              className={`px-4 py-2 ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} rounded-lg transition-colors`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate(addDays(new Date(), 1))}
              className={`px-4 py-2 ${isTomorrow ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} rounded-lg transition-colors`}
            >
              Tomorrow
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Today's Jobs Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-500" />
            Jobs for {format(selectedDate, 'MMMM d, yyyy')}
          </h2>
          
          {displayedJobs.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Jobs Scheduled</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                There are no jobs scheduled for {format(selectedDate, 'MMMM d, yyyy')}.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Previous Day
                </button>
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Next Day
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedJobs.map(job => (
                <div 
                  key={job.id}
                  className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-4 border-l-4"
                  style={{ borderLeftColor: job.job_phase?.color_dark_mode || '#6B7280' }}
                >
                  <div className="flex flex-col space-y-3">
                    {/* Work Order Number and Property Name */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {formatWorkOrderNumber(job.work_order_num)}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {job.property?.property_name || 'Unknown Property'}
                        </p>
                      </div>
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: job.job_phase?.color_dark_mode || '#6B7280',
                          color: 'white'
                        }}
                      >
                        {job.job_phase?.job_phase_label || 'Unknown Phase'}
                      </span>
                    </div>

                    {/* Property Address and Unit Number */}
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center flex-1">
                        <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2 flex-shrink-0" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {job.property ? formatAddress(job.property) : 'No address available'}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Unit #{job.unit_number}
                        </span>
                      </div>
                    </div>

                    {/* Job Type */}
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {job.job_type?.job_type_label || 'Unknown Type'}
                      </span>
                    </div>

                    {/* Add Work Order Button */}
                    <div className="flex justify-end mt-2">
                      <Link
                        to={`/dashboard/jobs/${job.id}/new-work-order${isPreview ? `?userId=${previewUserId}` : ''}`}
                        className="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <FileEdit className="h-4 w-4 mr-2" />
                        Add Work Order
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tomorrow's Jobs Section */}
          {isToday && tomorrowJobs.length > 0 && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
                Tomorrow's Jobs
              </h2>
              
              <div className="space-y-3">
                {tomorrowJobs.map(job => (
                  <div 
                    key={job.id}
                    className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-3 border-l-2"
                    style={{ borderLeftColor: job.job_phase?.color_dark_mode || '#6B7280' }}
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatWorkOrderNumber(job.work_order_num)}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {job.property?.property_name || 'Unknown Property'}
                          </p>
                        </div>
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: job.job_phase?.color_dark_mode || '#6B7280',
                            color: 'white'
                          }}
                        >
                          {job.job_phase?.job_phase_label || 'Unknown Phase'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Unit #{job.unit_number}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {job.job_type?.job_type_label || 'Unknown Type'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubcontractorDashboard;