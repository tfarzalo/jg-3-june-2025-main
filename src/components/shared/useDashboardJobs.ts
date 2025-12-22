import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import { formatInTimeZone } from 'date-fns-tz';

interface DashboardJob {
  id: string;
  work_order_num: number;
  unit_number: string;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
  total_billing_amount: number;
  invoice_sent?: boolean;
  invoice_paid?: boolean;
  invoice_sent_date?: string;
  invoice_paid_date?: string;
  property: {
    property_name: string;
  }[];
  job_phase: {
    job_phase_label: string;
    color_dark_mode: string;
  }[];
  job_type: {
    job_type_label: string;
  }[];
  assigned_to: {
    full_name: string;
  }[] | {
    full_name: string;
  } | null;
}

interface UseDashboardJobsResult {
  jobRequests: DashboardJob[];
  workOrders: DashboardJob[];
  invoicingJobs: DashboardJob[];
  todaysJobs: DashboardJob[];
  loading: boolean;
  error: string | null;
  refreshJobs: () => Promise<void>;
}

export function useDashboardJobs(): UseDashboardJobsResult {
  const [jobRequests, setJobRequests] = useState<DashboardJob[]>([]);
  const [workOrders, setWorkOrders] = useState<DashboardJob[]>([]);
  const [invoicingJobs, setInvoicingJobs] = useState<DashboardJob[]>([]);
  const [todaysJobs, setTodaysJobs] = useState<DashboardJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseMap, setPhaseMap] = useState<Record<string, string>>({});
  
  // Use refs to store the latest data for subscription updates
  const phaseMapRef = useRef<Record<string, string>>({});
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum time between fetches in milliseconds
  const initialLoadDoneRef = useRef<boolean>(false);

  const fetchJobs = useCallback(async (options?: { silent?: boolean }) => {
    if (!isMountedRef.current) return;
    
    // Prevent fetching too frequently
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    try {
      // Only show loading during the very first load (no flicker afterwards)
      if (!initialLoadDoneRef.current && !options?.silent) {
        setLoading(true);
      }
      setError(null); // Clear previous errors
      
      // Get phase IDs with retry logic
      let { data: phases, error: phaseError } = await supabase
        .from('job_phases')
        .select('id, job_phase_label');

      if (phaseError) {
        console.error('Phase fetch error:', phaseError);
        // If 401, retry once after a short delay
        if (phaseError.code === '401' || phaseError.message?.includes('401')) {
          console.log('401 error detected, retrying phases query...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResult = await supabase
            .from('job_phases')
            .select('id, job_phase_label');
          
          if (retryResult.error) {
            console.error('Retry phases fetch failed:', retryResult.error);
            throw phaseError;
          }
          
          phases = retryResult.data;
          console.log('Retry phases fetch successful');
        } else {
          throw phaseError;
        }
      }

      if (!phases) {
        throw new Error('No phases data received');
      }

      console.log('Fetched phases:', phases);

      const phaseMapData = phases.reduce((acc, phase) => ({
        ...acc,
        [phase.job_phase_label]: phase.id
      }), {} as Record<string, string>);
      
      console.log('Phase map data:', phaseMapData);
      console.log('Available phase names:', Object.keys(phaseMapData));
      console.log('Looking for Invoicing phase ID:', phaseMapData['Invoicing']);
      console.log('Looking for Invoice phase ID:', phaseMapData['Invoice']);
      console.log('Looking for Billing phase ID:', phaseMapData['Billing']);
      
      setPhaseMap(phaseMapData);
      phaseMapRef.current = phaseMapData;

      // Get today's date range in Eastern Time
      const today = new Date();
      const startOfToday = formatInTimeZone(
        today, 
        'America/New_York', 
        "yyyy-MM-dd'T'00:00:00XXX"
      );
      
      const endOfToday = formatInTimeZone(
        today, 
        'America/New_York', 
        "yyyy-MM-dd'T'23:59:59XXX"
      );

      // Use Promise.all to fetch all job types in parallel
      const [
        requestJobsResult,
        workOrderJobsResult,
        pendingWorkOrderJobsResult,
        invoicingJobsResult,
        todayJobsResult
      ] = await Promise.all([
        // Job Requests - sorted by creation date (newest first)
        supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            created_at,
            updated_at,
            total_billing_amount,
            property:properties (
              property_name
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_dark_mode
            ),
            job_type:job_types (
              job_type_label
            ),
            assigned_to:profiles (
              full_name
            )
          `)
          .eq('current_phase_id', phaseMapData['Job Request'])
          .neq('current_phase_id', phaseMapData['Cancelled'] || 'never-match')
          .order('created_at', { ascending: false })
          .limit(4),

        // Work Orders - sorted by updated_at (most recently modified first)
        supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            created_at,
            updated_at,
            total_billing_amount,
            property:properties (
              property_name
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_dark_mode
            ),
            job_type:job_types (
              job_type_label
            ),
            assigned_to:profiles (
              full_name
            )
          `)
          .eq('current_phase_id', phaseMapData['Work Order'])
          .neq('current_phase_id', phaseMapData['Cancelled'] || 'never-match')
          .order('updated_at', { ascending: false })
          .limit(4),
          
        // Pending Work Orders - sorted by updated_at (most recently modified first)
        supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            created_at,
            updated_at,
            total_billing_amount,
            property:properties (
              property_name
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_dark_mode
            ),
            job_type:job_types (
              job_type_label
            ),
            assigned_to:profiles (
              full_name
            )
          `)
          .eq('current_phase_id', phaseMapData['Pending Work Order'])
          .neq('current_phase_id', phaseMapData['Cancelled'] || 'never-match')
          .order('updated_at', { ascending: false })
          .limit(4),

        // Invoicing Jobs - sorted by updated_at (most recently modified first)
        supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            created_at,
            updated_at,
            total_billing_amount,
            invoice_sent,
            invoice_paid,
            invoice_sent_date,
            invoice_paid_date,
            property:properties (
              property_name
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_dark_mode
            ),
            job_type:job_types (
              job_type_label
            ),
            assigned_to:profiles (
              full_name
            )
          `)
          .eq('current_phase_id', phaseMapData['Invoicing'] || phaseMapData['Invoice'] || phaseMapData['Billing'])
          .neq('current_phase_id', phaseMapData['Cancelled'] || 'never-match')
          .order('updated_at', { ascending: false })
          .limit(4),
          
        // Today's jobs
        supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            created_at,
            updated_at,
            total_billing_amount,
            property:properties (
              property_name
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_dark_mode
            ),
            job_type:job_types (
              job_type_label
            ),
            assigned_to:profiles (
              full_name
            )
          `)
          .in('current_phase_id', [
            phaseMapData['Job Request'],
            phaseMapData['Work Order'],
            phaseMapData['Pending Work Order']
          ].filter(Boolean))
          .not('current_phase_id', 'eq', phaseMapData['Cancelled'] || 'never-match')
          .gte('scheduled_date', startOfToday)
          .lte('scheduled_date', endOfToday)
          .order('scheduled_date', { ascending: true })
      ]);

      // Handle errors
      if (requestJobsResult.error) throw requestJobsResult.error;
      if (workOrderJobsResult.error) throw workOrderJobsResult.error;
      if (pendingWorkOrderJobsResult.error) throw pendingWorkOrderJobsResult.error;
      if (invoicingJobsResult.error) throw invoicingJobsResult.error;
      if (todayJobsResult.error) throw todayJobsResult.error;

      console.log('Job Requests:', requestJobsResult.data);
      console.log('Work Orders:', workOrderJobsResult.data);
      console.log('Pending Work Orders:', pendingWorkOrderJobsResult.data);
      console.log('Invoicing Jobs:', invoicingJobsResult.data);
      console.log('Today\'s Jobs:', todayJobsResult.data);

      // Set phase-specific jobs
      if (isMountedRef.current) {
        setJobRequests(requestJobsResult.data || []);
        
        // Combine Work Order and Pending Work Order jobs
        const combinedWorkOrders = [
          ...(workOrderJobsResult.data || []),
          ...(pendingWorkOrderJobsResult.data || [])
        ].sort((a, b) => {
          // Sort by updated_at (most recently modified first)
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }).slice(0, 4); // Limit to 4 items
        
        setWorkOrders(combinedWorkOrders);
        setInvoicingJobs(invoicingJobsResult.data || []);
        setTodaysJobs(todayJobsResult.data || []);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      }
    } finally {
      if (isMountedRef.current) {
        // Mark initial load as done to avoid future loading flickers
        if (!initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
        }
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchJobs();

    // Set up real-time subscriptions with debounce
    let debounceTimeout: NodeJS.Timeout | null = null;
    const handleChange = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        if (isMountedRef.current) {
          console.log('Jobs table changed, refreshing data...');
          // Silent refresh to avoid UI flicker
          fetchJobs({ silent: true });
        }
      }, 1000); // 1 second debounce
    };

    // Set up comprehensive real-time subscriptions with optimistic updates
    const jobsSubscription = supabase
      .channel('dashboard-jobs-changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'jobs' 
        }, 
        async (payload) => {
          console.log('New job added:', payload.new);
          // Optimistic update - add new job immediately
          if (isMountedRef.current) {
            // Fetch complete job data in background
            const { data: newJob, error } = await supabase
              .from('jobs')
              .select(`
                id,
                work_order_num,
                unit_number,
                scheduled_date,
                created_at,
                updated_at,
                total_billing_amount,
                property:properties (property_name),
                job_phase:current_phase_id (job_phase_label, color_dark_mode),
                job_type:job_types (job_type_label),
                assigned_to:profiles (full_name)
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (!error && newJob) {
              // Update relevant state based on job phase
              const phaseLabel = newJob.job_phase?.[0]?.job_phase_label;
              if (phaseLabel === 'Job Request') {
                setJobRequests(prev => [newJob, ...prev].slice(0, 4));
              } else if (phaseLabel === 'Work Order' || phaseLabel === 'Pending Work Order') {
                setWorkOrders(prev => [newJob, ...prev].slice(0, 4));
              } else if (phaseLabel === 'Invoicing') {
                setInvoicingJobs(prev => [newJob, ...prev].slice(0, 4));
              }
              
              // Update today's jobs if scheduled for today
              const today = new Date();
              const jobDate = new Date(newJob.scheduled_date);
              if (jobDate.toDateString() === today.toDateString()) {
                setTodaysJobs(prev => [newJob, ...prev].slice(0, 4));
              }
            }
          }
        }
      )
      .on('postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'jobs' 
        }, 
        async (payload) => {
          console.log('Job updated:', payload.new);
          if (isMountedRef.current) {
            // Fetch complete updated job data
            const { data: updatedJob, error } = await supabase
              .from('jobs')
              .select(`
                id,
                work_order_num,
                unit_number,
                scheduled_date,
                created_at,
                updated_at,
                total_billing_amount,
                property:properties (property_name),
                job_phase:current_phase_id (job_phase_label, color_dark_mode),
                job_type:job_types (job_type_label),
                assigned_to:profiles (full_name)
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (!error && updatedJob) {
              const phaseLabel = updatedJob.job_phase?.[0]?.job_phase_label;
              
              // Update job requests
              setJobRequests(prev => 
                prev.map(job => job.id === updatedJob.id ? updatedJob : job)
              );
              
              // Update work orders
              setWorkOrders(prev => 
                prev.map(job => job.id === updatedJob.id ? updatedJob : job)
              );
              
              // Update invoicing jobs
              setInvoicingJobs(prev => 
                prev.map(job => job.id === updatedJob.id ? updatedJob : job)
              );
              
              // Update today's jobs
              setTodaysJobs(prev => 
                prev.map(job => job.id === updatedJob.id ? updatedJob : job)
              );
            }
          }
        }
      )
      .on('postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'jobs' 
        }, 
        (payload) => {
          console.log('Job deleted:', payload.old);
          if (isMountedRef.current) {
            const deletedJobId = payload.old.id;
            
            // Remove from all state arrays
            setJobRequests(prev => prev.filter(job => job.id !== deletedJobId));
            setWorkOrders(prev => prev.filter(job => job.id !== deletedJobId));
            setInvoicingJobs(prev => prev.filter(job => job.id !== deletedJobId));
            setTodaysJobs(prev => prev.filter(job => job.id !== deletedJobId));
          }
        }
      )
      .subscribe();

    const phaseChangesSubscription = supabase
      .channel('dashboard-phase-changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'job_phase_changes' 
        }, 
        async (payload) => {
          console.log('Phase change detected:', payload.new);
          if (isMountedRef.current) {
            // Fetch the updated job to see its new phase
            const { data: updatedJob, error } = await supabase
              .from('jobs')
              .select(`
                id,
                work_order_num,
                unit_number,
                scheduled_date,
                created_at,
                updated_at,
                total_billing_amount,
                property:properties (property_name),
                job_phase:current_phase_id (job_phase_label, color_dark_mode),
                job_type:job_types (job_type_label),
                assigned_to:profiles (full_name)
              `)
              .eq('id', payload.new.job_id)
              .single();
            
            if (!error && updatedJob) {
              const newPhaseLabel = updatedJob.job_phase?.[0]?.job_phase_label;
              const oldPhaseLabel = payload.new.from_phase_id ? 
                (await supabase.from('job_phases').select('job_phase_label').eq('id', payload.new.from_phase_id).single())?.data?.job_phase_label : null;
              
              // Remove job from old phase arrays
              if (oldPhaseLabel === 'Job Request') {
                setJobRequests(prev => prev.filter(job => job.id !== updatedJob.id));
              } else if (oldPhaseLabel === 'Work Order' || oldPhaseLabel === 'Pending Work Order') {
                setWorkOrders(prev => prev.filter(job => job.id !== updatedJob.id));
              } else if (oldPhaseLabel === 'Invoicing') {
                setInvoicingJobs(prev => prev.filter(job => job.id !== updatedJob.id));
              }
              
              // Add job to new phase arrays
              if (newPhaseLabel === 'Job Request') {
                setJobRequests(prev => [updatedJob, ...prev].slice(0, 4));
              } else if (newPhaseLabel === 'Work Order' || newPhaseLabel === 'Pending Work Order') {
                setWorkOrders(prev => [updatedJob, ...prev].slice(0, 4));
              } else if (newPhaseLabel === 'Invoicing') {
                setInvoicingJobs(prev => [updatedJob, ...prev].slice(0, 4));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      jobsSubscription.unsubscribe();
      phaseChangesSubscription.unsubscribe();
    };
  }, [fetchJobs]);

  return { 
    jobRequests, 
    workOrders, 
    invoicingJobs, 
    todaysJobs,
    loading, 
    error,
    refreshJobs: () => fetchJobs({ silent: true })
  };
}