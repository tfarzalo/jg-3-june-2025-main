import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  FileText, 
  Star, 
  DollarSign, 
  CheckCircle,
  Plus,
  Calendar,
  Activity,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MetricTile } from './ui/MetricTile';
import { DashboardCard } from './ui/DashboardCard';
import { supabase } from '../utils/supabase';

interface JobPhase {
  id: string;
  job_phase_label: string;
  color_dark_mode: string;
}

interface Property {
  name: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [phases, setPhases] = useState<JobPhase[]>([]);
  const [phaseColors, setPhaseColors] = useState<Record<string, string>>({});
  
  useEffect(() => {
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
        setProperties(propertiesResult.data || []);
        
        // Create and set a map for easy lookup of phase colors
        const colorsMap: Record<string, string> = (phasesResult.data || []).reduce((acc: Record<string, string>, phase: JobPhase) => {
          acc[phase.job_phase_label] = phase.color_dark_mode;
          return acc;
        }, {} as Record<string, string>);
        
        setPhaseColors(colorsMap);
        
        // Fetch activities
        await fetchActivities();
        
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

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
      setError('Failed to load activities. Please try again.');
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

  // Filter jobs by status
  const jobRequests = jobs.filter(job => job.job_phase?.job_phase_label === 'Job Request').slice(0, 5);
  const workOrders = jobs.filter(job => 
    job.job_phase?.job_phase_label === 'Work Order' || 
    job.job_phase?.job_phase_label === 'Pending Work Order'
  ).slice(0, 5);
  const invoicingJobs = jobs.filter(job => job.job_phase?.job_phase_label === 'Invoicing').slice(0, 5);
  const completedJobs = jobs.filter(job => job.job_phase?.job_phase_label === 'Completed').slice(0, 5);
  
  // Get today's jobs
  const today = new Date().toISOString().split('T')[0];
  const todaysJobs = jobs.filter(job => job.scheduled_date?.startsWith(today)).slice(0, 5);

  // Calculate today's job counts by type
  const allTodaysJobs = jobs.filter(job => job.scheduled_date?.startsWith(today));

  const todayPaintJobs = allTodaysJobs.filter(job => job.job_type?.job_type_label === 'Paint').length;
  const todayCallbackJobs = allTodaysJobs.filter(job => job.job_type?.job_type_label === 'Callback').length;
  const todayRepairJobs = allTodaysJobs.filter(job => job.job_type?.job_type_label === 'Repair').length;

  const metrics = [
    { 
      icon: ClipboardList,
      label: 'Job Requests',
      value: jobs.filter(job => job.job_phase?.job_phase_label === 'Job Request').length.toString(),
      trend: { value: 12, isPositive: true },
      color: 'blue'
    },
    {
      icon: FileText,
      label: 'Work Orders',
      value: jobs.filter(job => 
        job.job_phase?.job_phase_label === 'Work Order' || 
        job.job_phase?.job_phase_label === 'Pending Work Order'
      ).length.toString(),
      trend: { value: 15, isPositive: true },
      color: 'orange'
    },
    {
      icon: Clock,
      label: 'Pending Work Orders',
      value: jobs.filter(job => 
        job.job_phase?.job_phase_label === 'Pending Work Order'
      ).length.toString(),
      trend: { value: 5, isPositive: false },
      color: phaseColors['Pending Work Order'] || 'gray'
    },
    {
      icon: DollarSign,
      label: 'Jobs in Invoicing',
      value: jobs.filter(job => job.job_phase?.job_phase_label === 'Invoicing').length.toString(),
      trend: { value: 18, isPositive: true },
      color: 'emerald'
    },
    {
      icon: CheckCircle,
      label: 'Completed Jobs',
      value: jobs.filter(job => job.job_phase?.job_phase_label === 'Completed').length.toString(),
      trend: { value: 24, isPositive: true },
      color: 'red'
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
    <div className="p-6 bg-background dark:bg-background-dark min-h-screen">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <Link 
            key={index} 
            to={
              metric.label === 'Pending Work Orders' 
                ? '/dashboard/jobs/work-orders' 
                : `/dashboard/jobs/${metric.label.toLowerCase().replace(' ', '-')}`
            } 
            className="block"
          >
            <MetricTile
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              trend={metric.trend}
              color={metric.color}
            />
          </Link>
        ))}
      </div>

      {/* Main Content Grid - First Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Job Requests */}
        <DashboardCard 
          title="Job Requests" 
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
          className="min-h-[400px]"
          phaseColor={phaseColors['Job Request'] || '#3B82F6'}
        >
          <div className="space-y-4">
            {jobRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No job requests found
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Unit #</th>
                    <th className="pb-2">Work Date</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300 text-sm">
                  {jobRequests.map(job => (
                    <tr key={job.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {job.property?.property_name || 'Unknown Property'}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {job.unit_number || 'N/A'}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {new Date(job.scheduled_date).toLocaleDateString()}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DashboardCard>

        {/* Work Orders */}
        <DashboardCard 
          title="Work Orders" 
          viewAllLink="/dashboard/jobs/work-orders"
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[400px]"
          phaseColor={phaseColors['Work Order'] || '#F97316'}
        >
          <div className="space-y-4">
            {workOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No work orders found
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300 text-sm">
                  {workOrders.map(job => (
                    <tr key={job.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          <span className="flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2`} style={{ backgroundColor: job.job_phase?.color_dark_mode || 'gray' }}></span>
                            {`WO-${String(job.work_order_num).padStart(6, '0')}`}
                          </span>
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {job.property?.property_name || 'Unknown Property'}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          <span 
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`}
                            style={{
                              backgroundColor: job.job_phase?.color_dark_mode ? `${job.job_phase.color_dark_mode}26` : 'rgba(128, 128, 128, 0.1)', // Add 10% opacity
                              color: job.job_phase?.color_dark_mode || 'gray', 
                            }}
                          >
                            {job.job_phase?.job_phase_label || 'Unknown'}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DashboardCard>

        {/* Today's Agenda */}
        <DashboardCard 
          title="Today's Agenda" 
          actionButton={
            <Link 
              to="/dashboard/calendar"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              View Calendar
            </Link>
          }
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[400px]"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 mb-2">
              <span>Today's Jobs: {todaysJobs.length} Total</span>
              <div className="flex space-x-4">
                <span className="text-blue-500">Paint: {todayPaintJobs}</span>
                <span className="text-orange-500">Callback: {todayCallbackJobs}</span>
                <span className="text-red-500">Repair: {todayRepairJobs}</span>
              </div>
            </div>
            
            {todaysJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No jobs scheduled for today
              </div>
            ) : (
              todaysJobs.map(job => (
                <Link 
                  key={job.id} 
                  to={`/dashboard/jobs/${job.id}`}
                  className="block"
                >
                  <div 
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: job.job_phase?.color_dark_mode ? `${job.job_phase.color_dark_mode}1A` : 'rgba(128, 128, 128, 0.1)', // Use fetched color with 10% opacity
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-gray-900 dark:text-white flex items-center">
                          {job.property?.property_name || 'Unknown Property'}
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            Unit {job.unit_number}
                          </span>
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Assigned: {job.assigned_to?.full_name || 'Unassigned'}
                        </p>
                      </div>
                      <span className="text-sm px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {job.job_type?.job_type_label || 'Unknown Type'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </DashboardCard>
      </div>

      {/* Main Content Grid - Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoicing */}
        <DashboardCard 
          title="Invoicing" 
          viewAllLink="/dashboard/jobs/invoicing"
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[300px]"
          phaseColor={phaseColors['Invoicing'] || '#10B981'}
        >
          <div className="space-y-4">
            {invoicingJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No jobs in invoicing
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300 text-sm">
                  {invoicingJobs.map(job => (
                    <tr key={job.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {`WO-${String(job.work_order_num).padStart(6, '0')}`}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {job.property?.property_name || 'Unknown Property'}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {job.total_billing_amount ? `$${job.total_billing_amount.toFixed(2)}` : '$0.00'}
                          </span>
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
          viewAllLink="/dashboard/jobs/completed"
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[300px]"
          phaseColor={phaseColors['Completed'] || '#EF4444'}
        >
          <div className="space-y-4">
            {completedJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No completed jobs
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300 text-sm">
                  {completedJobs.map(job => (
                    <tr key={job.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {`WO-${String(job.work_order_num).padStart(6, '0')}`}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {job.property?.property_name || 'Unknown Property'}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/dashboard/jobs/${job.id}`} className="block">
                          {new Date(job.scheduled_date).toLocaleDateString()}
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
          title="Activity Pulse" 
          titleColor="text-gray-900 dark:text-white"
          className="min-h-[300px]"
          actionButton={
            <Link 
              to="/dashboard/activity"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              View All
            </Link>
          }
        >
          <div className="space-y-4">
            {error && (
              <div className="text-red-500 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
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
    </div>
  );
}