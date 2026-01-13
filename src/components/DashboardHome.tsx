import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  FileText, 
  DollarSign, 
  CheckCircle,
  Plus,
  Activity,
  Clock,
  ArrowRight,
  Mailbox
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MetricTile } from './ui/MetricTile';
import { DashboardCard } from './ui/DashboardCard';
import { supabase } from '../utils/supabase';
import { formatDate, formatDateTime } from '../lib/dateUtils';
import TodaysAgendaModal from './modals/TodaysAgendaModal';
import { useDashboardJobs } from './shared/useDashboardJobs';
import { useUserRole } from '../contexts/UserRoleContext';

interface JobPhase {
  id: string;
  job_phase_label: string;
  color_dark_mode: string;
}

interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  property: {
    property_name: string;
  };
  total_billing_amount?: number;
}

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

export function DashboardHome() {
  const navigate = useNavigate();
  const { isSubcontractor, loading: roleLoading } = useUserRole();
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [phaseColors, setPhaseColors] = useState<Record<string, string>>({});
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [loadingCompletedDates, setLoadingCompletedDates] = useState(false);
  const [phases, setPhases] = useState<any[]>([]);
  
  // Use the dedicated dashboard jobs hook for specific job categories
  const { 
    jobRequests, 
    workOrders, 
    invoicingJobs, 
    todaysJobs, 
    loading: dashboardJobsLoading
  } = useDashboardJobs();
  
  // Redirect subcontractors to their dashboard
  useEffect(() => {
    if (!roleLoading && isSubcontractor) {
      navigate('/dashboard/subcontractor', { replace: true });
    }
  }, [isSubcontractor, roleLoading, navigate]);
  
  // Main data fetching effect - must be called before conditional return
  useEffect(() => {
    // Only fetch data if not a subcontractor (admin and jg_management should see data)
    if (roleLoading || isSubcontractor) {
      return;
    }
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch jobs, properties, job phases, and activities in parallel
        const [jobsResult, propertiesResult, phasesResult] = await Promise.all([
          supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              scheduled_date,
              created_at,
              updated_at,
              property:properties(property_name),
              job_phase:current_phase_id(job_phase_label, color_dark_mode),
              assigned_to:profiles(full_name),
              job_type:job_types(job_type_label),
              total_billing_amount
            `)
            .order('created_at', { ascending: false }),
          supabase
            .from('properties')
            .select('*')
            .eq('is_archived', false)
            .order('property_name'),
          supabase
            .from('job_phases')
            .select('id, job_phase_label, color_dark_mode')
        ]);
        
        if (jobsResult.error) throw jobsResult.error;
        if (propertiesResult.error) throw propertiesResult.error;
        if (phasesResult.error) throw phasesResult.error;
        
        setJobs(jobsResult.data || []);
        setPhases(phasesResult.data || []);
        
        // Create and set a map for easy lookup of phase colors
        const colorsMap: Record<string, string> = (phasesResult.data || []).reduce((acc: Record<string, string>, phase: JobPhase) => {
          acc[phase.job_phase_label] = phase.color_dark_mode;
          return acc;
        }, {} as Record<string, string>);
        
        setPhaseColors(colorsMap);
        
        // Fetch activities
        await fetchActivities();
        
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();

    // Set up real-time subscriptions for automatic updates
    const jobsSubscription = supabase
      .channel('dashboard-jobs')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'jobs' },
        async (payload) => {
          console.log('New job added:', payload.new);
          // Fetch the complete job data with relations
          const { data: newJob, error } = await supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              scheduled_date,
              property:properties(property_name),
              job_phase:current_phase_id(job_phase_label, color_dark_mode),
              assigned_to:profiles(full_name),
              job_type:job_types(job_type_label),
              total_billing_amount
            `)
            .eq('id', payload.new.id)
            .eq('is_archived', false)
            .eq('is_deleted', false)
            .single();
          
          if (!error && newJob) {
            setJobs(prev => [newJob, ...prev]);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs' },
        async (payload) => {
          console.log('Job updated:', payload.new);
          // Fetch the complete updated job data
          const { data: updatedJob, error } = await supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              scheduled_date,
              property:properties(property_name),
              job_phase:current_phase_id(job_phase_label, color_dark_mode),
              assigned_to:profiles(full_name),
              job_type:job_types(job_type_label),
              total_billing_amount
            `)
            .eq('id', payload.new.id)
            .eq('is_archived', false)
            .eq('is_deleted', false)
            .single();
          
          if (!error && updatedJob) {
            setJobs(prev => prev.map(job => 
              job.id === updatedJob.id ? updatedJob : job
            ));
          } else if (error || !updatedJob) {
            // If the job was archived/deleted or we can't fetch it, remove it from state
            setJobs(prev => prev.filter(job => job.id !== payload.new.id));
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'jobs' },
        (payload) => {
          console.log('Job deleted:', payload.old);
          setJobs(prev => prev.filter(job => job.id !== payload.old.id));
        }
      )
      .subscribe();

    // Set up real-time subscription for activity updates
    const activitySubscription = supabase
      .channel('dashboard-activity')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_phase_changes' },
        () => {
          console.log('New activity detected, refreshing activities...');
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      jobsSubscription.unsubscribe();
      activitySubscription.unsubscribe();
    };
  }, [roleLoading, isSubcontractor]); // Add dependencies for the conditional logic

  // Get completed jobs with their completion dates
  useEffect(() => {
    const fetchCompletedJobsWithDates = async () => {
      const completedJobsList = jobs.filter(job => 
        job.job_phase?.job_phase_label === 'Completed'
      ).slice(0, 8);

      // If no completed jobs, set empty array and return
      if (completedJobsList.length === 0) {
        setCompletedJobs([]);
        return;
      }

      setLoadingCompletedDates(true);
      
      try {
        // Fetch completion dates for each job with timeout protection
        const jobsWithDates = await Promise.all(
          completedJobsList.map(async (job) => {
            try {
              const completedDate = await getCompletedDate(job.id);
              return {
                ...job,
                completed_date: completedDate
              };
            } catch (err) {
              console.error(`Error fetching completion date for job ${job.id}:`, err);
              // Return job without completion date if fetch fails
              return {
                ...job,
                completed_date: null
              };
            }
          })
        );

        setCompletedJobs(jobsWithDates);
      } catch (err) {
        console.error('Error fetching completed jobs with dates:', err);
        // Fallback to jobs without completion dates
        setCompletedJobs(completedJobsList);
      } finally {
        setLoadingCompletedDates(false);
      }
    };

    if (jobs.length > 0 && phases.length > 0) {
      fetchCompletedJobsWithDates();
    } else {
      // Reset completed jobs if no data available
      setCompletedJobs([]);
    }
  }, [jobs, phases]);
  
  // Early return for subcontractors - but AFTER all hooks have been called
  if (roleLoading || isSubcontractor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  


  const fetchActivities = async () => {
    try {
      // Get the job phase changes
      const { data: phaseChanges, error: phaseChangesError } = await supabase
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
        .order('changed_at', { ascending: false })
        .limit(4);

      if (phaseChangesError) throw phaseChangesError;
      if (!phaseChanges || phaseChanges.length === 0) {
        setActivities([]);
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

      // Fetch phases
      const { data: phasesData, error: phasesError } = await supabase
        .from('job_phases')
        .select('id, job_phase_label, color_dark_mode')
        .in('id', allPhaseIds);

      if (phasesError) throw phasesError;

      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          property:properties(property_name)
        `)
        .in('id', jobIds) as { data: Job[] | null, error: any };

      if (jobsError) throw jobsError;

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (usersError) throw usersError;

      // Create maps for easy lookup
      const phasesMap = new Map(phasesData?.map(phase => [phase.id, phase]) || []);
      const jobsMap = new Map(jobsData?.map(job => [job.id, job]) || []);
      const usersMap = new Map(usersData?.map(user => [user.id, user]) || []);

      // Combine all the data
      const activitiesData = phaseChanges.map(change => {
        const job = jobsMap.get(change.job_id);
        const fromPhase = change.from_phase_id ? phasesMap.get(change.from_phase_id) : null;
        const toPhase = phasesMap.get(change.to_phase_id);
        const user = usersMap.get(change.changed_by);

        return {
          id: change.id,
          job_id: change.job_id,
          changed_by: change.changed_by,
          from_phase_id: change.from_phase_id,
          to_phase_id: change.to_phase_id,
          change_reason: change.change_reason,
          changed_at: change.changed_at,
          from_phase_label: fromPhase?.job_phase_label || null,
          from_phase_color: fromPhase?.color_dark_mode || null,
          to_phase_label: toPhase?.job_phase_label || '',
          to_phase_color: toPhase?.color_dark_mode || '',
          job_work_order_num: job?.work_order_num || 0,
          job_unit_number: job?.unit_number || '',
          property_name: job?.property?.property_name || '',
          user_full_name: user?.full_name || null
        } as ActivityItem;
      });

      setActivities(activitiesData);
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
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
      return new Date(dateString).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  // Filter jobs by status  // Get today's jobs from the dedicated hook
  const sortedTodaysJobs = todaysJobs.slice(0, 4);
  
  // Define allTodaysJobs - should be today's jobs, not all jobs
  const allTodaysJobs = todaysJobs || [];
  
  // Pending Work Orders list
  const pendingWorkOrders = jobs.filter(job => job.job_phase?.job_phase_label === 'Pending Work Order');

  // Debug logging
  console.log('Dashboard: todaysJobs from hook:', todaysJobs.length);
  console.log('Dashboard: allTodaysJobs:', allTodaysJobs.length);
  console.log('Dashboard: sortedTodaysJobs:', sortedTodaysJobs.length);

  // Helper functions to handle array/object data from useDashboardJobs
  const getJobPhaseColor = (job: any) => {
    const jobPhase = Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase;
    return jobPhase?.color_dark_mode || '#6B7280';
  };

  const getPropertyName = (job: any) => {
    const property = Array.isArray(job.property) ? job.property[0] : job.property;
    return property?.property_name || 'Unknown Property';
  };

  const getAssignedTo = (job: any) => {
    const assignedTo = Array.isArray(job.assigned_to) ? job.assigned_to[0] : job.assigned_to;
    return assignedTo?.full_name || 'Unassigned';
  };

  const getJobType = (job: any) => {
    const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
    return jobType?.job_type_label || 'Unknown Type';
  };

  // Function to get the date when a job was moved to Completed phase
  const getCompletedDate = async (jobId: string): Promise<string | null> => {
    try {
      // Get the Completed phase ID
      const completedPhase = phases.find(phase => phase.job_phase_label === 'Completed');
      if (!completedPhase) return null;

      // Find the most recent phase change to Completed for this job
      const { data: phaseChanges, error } = await supabase
        .from('job_phase_changes')
        .select('changed_at')
        .eq('job_id', jobId)
        .eq('to_phase_id', completedPhase.id)
        .order('changed_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching completed date:', error);
        return null;
      }

      // Return the first result if available, otherwise null
      return phaseChanges && phaseChanges.length > 0 ? phaseChanges[0].changed_at : null;
    } catch (err) {
      console.error('Error fetching completed date:', err);
      return null;
    }
  };

  const metrics = [
    { 
      icon: ClipboardList,
      label: 'Job Requests',
      value: jobs.filter(job => job.job_phase?.job_phase_label === 'Job Request').length.toString(),
      trend: { value: 12, isPositive: true },
      color: 'blue',
      notation: 'New / Scheduled'
    },
    {
      icon: FileText,
      label: 'Work Orders',
      value: jobs.filter(job => 
        job.job_phase?.job_phase_label === 'Work Order'
      ).length.toString(),
      trend: { value: 15, isPositive: true },
      color: 'orange',
      notation: 'In House'
    },
    {
      icon: Clock,
      label: 'Pending Work Orders',
      value: jobs.filter(job => job.job_phase?.job_phase_label === 'Pending Work Order').length.toString(),
      trend: { value: 8, isPositive: true },
      color: 'yellow',
      notation: 'Per Customer'
    },
    {
      icon: CheckCircle,
      label: 'Completed',
      value: jobs.filter(job => job.job_phase?.job_phase_label === 'Completed').length.toString(),
      trend: { value: 5, isPositive: true },
      color: phaseColors['Completed'] || '#1E40AF',
      notation: 'Ready for Billing'
    },
    {
      icon: ClipboardList,
      label: 'All Jobs',
      value: jobs.length.toString(),
      trend: { value: 4, isPositive: true },
      color: 'purple',
      notation: 'All Phases'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-background dark:bg-background-dark min-h-screen">
      {/* Metrics Grid - Hidden on mobile */}
      <div className="hidden lg:grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 auto-rows-fr gap-6 mb-8">
        {metrics.map((metric, index) => (
          <Link 
            key={index} 
            to={
              metric.label === 'Job Requests' 
                ? '/dashboard/jobs/requests'
                : metric.label === 'Work Orders'
                ? '/dashboard/jobs/work-orders'
                : metric.label === 'Pending Work Orders'
                ? '/dashboard/jobs/pending-work-orders'
                : metric.label === 'Invoicing'
                ? '/dashboard/jobs/invoicing'
                : metric.label === 'Completed'
                ? '/dashboard/jobs/completed'
                : '/dashboard/jobs'
            } 
            state={
              metric.label === 'Work Orders'
                ? { sortField: 'job_phase', sortDirection: 'desc' }
                : metric.label === 'Pending Work Orders'
                ? { sortField: 'job_phase', sortDirection: 'asc' }
                : undefined
            }
            className="block h-full"
          >
            <MetricTile
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              trend={metric.trend}
              color={metric.color}
              notation={(metric as any).notation}
            />
          </Link>
        ))}
      </div>

      {/* Mobile Layout - Today's Agenda First */}
      <div className="lg:hidden mb-6">
        {/* Today's Agenda - Mobile First */}
        <DashboardCard 
          title="Today's Agenda" 
          viewAllLink="/dashboard/calendar"
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[400px]"
        >
          {/* Job Type Summary - Under the title */}
          <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
              <div className="flex space-x-4">
                <span className="text-blue-500 font-medium">
                  Paint: {sortedTodaysJobs.filter(job => getJobType(job) === 'Paint').length}
                </span>
                <span className="text-orange-500 font-medium">
                  Callback: {sortedTodaysJobs.filter(job => getJobType(job) === 'Callback').length}
                </span>
                <span className="text-red-500 font-medium">
                  Repair: {sortedTodaysJobs.filter(job => getJobType(job) === 'Repair').length}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">Total: {sortedTodaysJobs.length}</span>
                {allTodaysJobs.length > 4 && (
                  <button 
                    onClick={() => setIsAgendaModalOpen(true)}
                    className="text-blue-500 hover:text-blue-700 font-medium"
                  >
                    View Calendar
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {sortedTodaysJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No jobs scheduled for today
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 flex-1 pr-2">
                {sortedTodaysJobs.map(job => (
                  <Link 
                    key={job.id} 
                    to={`/dashboard/jobs/${job.id}`}
                    className="block"
                  >
                    <div 
                      className="rounded-lg p-2.5"
                      style={{
                        backgroundColor: `${getJobPhaseColor(job)}1A`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                            <span 
                              className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                              style={{ backgroundColor: getJobPhaseColor(job) }}
                            ></span>
                            {getPropertyName(job)}
                            <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                              Unit {job.unit_number}
                            </span>
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Assigned: {getAssignedTo(job)}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 ml-2">
                          {getJobType(job)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
                {allTodaysJobs.length > 4 && (
                  <div className="text-center py-2 text-sm text-gray-500 dark:text-gray-400">
                    Showing 4 of {allTodaysJobs.length} jobs
                  </div>
                )}
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Mobile Layout - Other Cards */}
        <div className="space-y-4 mt-4">
          {/* Job Requests - Mobile */}
          <DashboardCard 
            title="Job Requests" 
            notation="New / Scheduled"
            titleColor="text-[#3B82F6]"
            titleWeight="semibold"
            viewAllLink="/dashboard/jobs/requests"
            actionButton={
              <Link 
                to="/dashboard/jobs/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Job Request
              </Link>
            }
            phaseColor={phaseColors['Job Request'] || '#3B82F6'}
            className="min-h-[300px]"
          >
            <div className="space-y-4 max-h-[250px] overflow-y-auto">
              {jobRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No job requests found
                </div>
              ) : (
                <div className="space-y-2">
                  {jobRequests.slice(0, 5).map(job => (
                    <Link 
                      key={job.id} 
                      to={`/dashboard/jobs/${job.id}`}
                      className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {getPropertyName(job)}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Unit {job.unit_number || 'N/A'} • {formatDate(job.scheduled_date)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </DashboardCard>

          {/* Work Orders - Mobile */}
          <DashboardCard 
            title="Work Orders" 
            notation="In House"
            viewAllLink="/dashboard/jobs/work-orders"
            viewAllState={{ sortField: 'job_phase', sortDirection: 'desc' }}
            titleColor="text-gray-900 dark:text-white"
            className="min-h-[300px]"
            phaseColor={phaseColors['Work Order'] || '#F97316'}
          >
            <div className="space-y-4 max-h-[250px] overflow-y-auto">
              {workOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No work orders found
                </div>
              ) : (
                <div className="space-y-2">
                  {workOrders.slice(0, 5).map(job => (
                    <Link 
                      key={job.id} 
                      to={`/dashboard/jobs/${job.id}`}
                      className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {formatWorkOrderNumber(job.work_order_num)}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getPropertyName(job)} • Unit {job.unit_number || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {getJobType(job)}
                          </p>
                        </div>
                        <span 
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: getJobPhaseColor(job) }}
                        ></span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Desktop Layout - Original Grid */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 auto-rows-fr gap-6 mb-6">
        {/* Job Requests */}
        <DashboardCard 
          title="Job Requests" 
          notation="New / Scheduled"
          viewAllLink="/dashboard/jobs/requests"
          actionButton={
            <Link 
              to="/dashboard/jobs/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Job Request
            </Link>
          }
          titleColor="text-gray-900 dark:text-white"
          phaseColor={phaseColors['Job Request'] || '#3B82F6'}
          className="min-h-[400px]"
        >
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {jobRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No job requests found
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Unit #</th>
                    <th className="pb-2">Work Date</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                  {jobRequests.slice(0, 8).map(job => (
                    <tr key={job.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block max-w-[220px] truncate">
                          {getPropertyName(job)}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block truncate">
                          {job.unit_number || 'N/A'}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block truncate">
                          {formatDate(job.scheduled_date)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DashboardCard>

        {/* Pending Work Orders */}
        <DashboardCard 
          title="Pending Work Orders" 
          notation="Per Customer"
          viewAllLink="/dashboard/jobs/pending-work-orders"
          viewAllState={{ sortField: 'job_phase', sortDirection: 'asc' }}
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[400px]"
          phaseColor={phaseColors['Pending Work Order'] || '#DAA520'}
        >
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {pendingWorkOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pending work orders found
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2">WO#</th>
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Unit #</th>
                    <th className="pb-2">Type</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                  {pendingWorkOrders.slice(0, 8).map(job => (
                    <tr key={job.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="flex items-center">
                          <span 
                            className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                            style={{ backgroundColor: getJobPhaseColor(job) }}
                          ></span>
                          {formatWorkOrderNumber(job.work_order_num)}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block max-w-[220px] truncate">
                          {getPropertyName(job)}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block truncate">
                          {job.unit_number || 'N/A'}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block truncate">
                          {getJobType(job)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DashboardCard>

        {/* Today's Agenda - Desktop */}
        <DashboardCard 
          title="Today's Agenda" 
          viewAllLink="/dashboard/calendar"
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[400px]"
        >
          {/* Job Type Summary - Under the title */}
          <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
              <div className="flex space-x-4">
                <span className="text-blue-500 font-medium">
                  Paint: {sortedTodaysJobs.filter(job => getJobType(job) === 'Paint').length}
                </span>
                <span className="text-orange-500 font-medium">
                  Callback: {sortedTodaysJobs.filter(job => getJobType(job) === 'Callback').length}
                </span>
                <span className="text-red-500 font-medium">
                  Repair: {sortedTodaysJobs.filter(job => getJobType(job) === 'Repair').length}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">Total: {sortedTodaysJobs.length}</span>
                {allTodaysJobs.length > 4 && (
                  <button 
                    onClick={() => setIsAgendaModalOpen(true)}
                    className="text-blue-500 hover:text-blue-700 font-medium"
                  >
                    View Calendar
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {sortedTodaysJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No jobs scheduled for today
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 flex-1 pr-2">
                {sortedTodaysJobs.map(job => (
                  <Link 
                    key={job.id} 
                    to={`/dashboard/jobs/${job.id}`}
                    className="block"
                  >
                    <div 
                      className="rounded-lg p-2.5"
                      style={{
                        backgroundColor: `${getJobPhaseColor(job)}1A`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                            <span 
                              className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                              style={{ backgroundColor: getJobPhaseColor(job) }}
                            ></span>
                            {getPropertyName(job)}
                            <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                              Unit {job.unit_number}
                            </span>
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Assigned: {getAssignedTo(job)}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 ml-2">
                          {getJobType(job)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
                {allTodaysJobs.length > 4 && (
                  <div className="text-center py-2 text-sm text-gray-500 dark:text-gray-400">
                    Showing 4 of {allTodaysJobs.length} jobs
                  </div>
                )}
              </div>
            )}
          </div>
        </DashboardCard>
      </div>

      {/* Main Content Grid - Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 auto-rows-fr gap-6">
        {/* Work Orders - moved to bottom-left */}
        <DashboardCard 
          title="Work Orders" 
          notation="In House"
          viewAllLink="/dashboard/jobs/work-orders"
          viewAllState={{ sortField: 'job_phase', sortDirection: 'desc' }}
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[400px]"
          phaseColor={phaseColors['Work Order'] || '#F97316'}
        >
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {workOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No work orders found
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2">WO#</th>
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Unit #</th>
                    <th className="pb-2">Type</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                  {workOrders.slice(0, 8).map(job => (
                    <tr key={job.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="flex items-center">
                          <span 
                            className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                            style={{ backgroundColor: getJobPhaseColor(job) }}
                          ></span>
                          {formatWorkOrderNumber(job.work_order_num)}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block max-w-[220px] truncate">
                          {getPropertyName(job)}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block truncate">
                          {job.unit_number || 'N/A'}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block truncate">
                          {getJobType(job)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DashboardCard>

        {/* Completed */}
        <DashboardCard 
          title="Completed" 
          notation="Ready for Billing / Invoicing"
          viewAllLink="/dashboard/jobs/completed"
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[400px]"
          phaseColor={phaseColors['Completed'] || '#EF4444'}
        >
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {loadingCompletedDates ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Loading completion dates...
              </div>
            ) : completedJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No completed jobs
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Date Modified</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                  {completedJobs.map(job => (
                    <tr key={job.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block truncate">
                          {`WO-${String(job.work_order_num).padStart(6, '0')}`}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block max-w-[220px] truncate">
                          {job.property?.property_name || 'Unknown Property'}
                        </Link>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block truncate">
                          {job.completed_date 
                            ? formatDateTime(job.completed_date)
                            : formatDateTime(job.updated_at || job.created_at)
                          }
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DashboardCard>

        {/* Activity Pulse */}
        <DashboardCard 
          title="Recent Activity" 
          viewAllLink="/dashboard/activity"
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[400px]"
        >
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No recent activity
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="mt-1">
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-900 dark:text-white">
                        Job status updated
                        <span className="inline-flex items-center mx-1">
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </span>
                        <span style={{ color: activity.to_phase_color }}>
                          {activity.to_phase_label}
                        </span>
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(activity.changed_at)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatWorkOrderNumber(activity.job_work_order_num)}
                      <span className="mx-1">•</span>
                      {activity.property_name} - Unit {activity.job_unit_number}
                      <ArrowRight className="h-3 w-3 mx-1" />
                      <Link 
                        to={`/dashboard/jobs/${activity.job_id}`}
                        className="text-blue-500 hover:text-blue-400"
                      >
                        View Job
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardCard>
      </div>
      
      <TodaysAgendaModal 
        open={isAgendaModalOpen} 
        onClose={() => setIsAgendaModalOpen(false)} 
        jobs={allTodaysJobs} 
      />
    </div>
  );
}
