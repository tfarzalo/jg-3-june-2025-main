import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthProvider';
import { getCurrentDateInEastern } from '../lib/dateUtils';

// Types
interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  scheduled_date: string;
  total_billing_amount: number | null;
  created_at: string;
  updated_at: string;
  assigned_to?: string | null;
  invoice_sent?: boolean;
  invoice_paid?: boolean;
  invoice_sent_date?: string;
  invoice_paid_date?: string;
  purchase_order?: string | null;
  property: {
    id: string;
    property_name: string;
    address: string;
    city: string;
    state: string;
  };
  unit_size: {
    unit_size_label: string;
  };
  job_type: {
    job_type_label: string;
  };
  job_phase: {
    job_phase_label: string;
    color_light_mode: string;
    color_dark_mode: string;
  };
}

interface JobDataState {
  jobsByPhase: Record<string, Job[]>;
  loadingStates: Record<string, boolean>;
  errorStates: Record<string, string | null>;
  lastFetched: Record<string, number>;
  phaseIds: Record<string, string[]>;
}

type JobDataAction =
  | { type: 'SET_LOADING'; phase: string; loading: boolean }
  | { type: 'SET_ERROR'; phase: string; error: string | null }
  | { type: 'SET_JOBS'; phase: string; jobs: Job[] }
  | { type: 'SET_PHASE_IDS'; phase: string; ids: string[] }
  | { type: 'UPDATE_JOB'; job: Job }
  | { type: 'ADD_JOB'; job: Job }
  | { type: 'REMOVE_JOB'; jobId: string }
  | { type: 'SET_LAST_FETCHED'; phase: string; timestamp: number };

const initialState: JobDataState = {
  jobsByPhase: {},
  loadingStates: {},
  errorStates: {},
  lastFetched: {},
  phaseIds: {},
};

function jobDataReducer(state: JobDataState, action: JobDataAction): JobDataState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loadingStates: { ...state.loadingStates, [action.phase]: action.loading }
      };
    case 'SET_ERROR':
      return {
        ...state,
        errorStates: { ...state.errorStates, [action.phase]: action.error }
      };
    case 'SET_JOBS':
      return {
        ...state,
        jobsByPhase: { ...state.jobsByPhase, [action.phase]: action.jobs }
      };
    case 'SET_PHASE_IDS':
      return {
        ...state,
        phaseIds: { ...state.phaseIds, [action.phase]: action.ids }
      };
    case 'UPDATE_JOB':
      return {
        ...state,
        jobsByPhase: Object.fromEntries(
          Object.entries(state.jobsByPhase).map(([phase, jobs]) => [
            phase,
            jobs.map(job => job.id === action.job.id ? action.job : job)
          ])
        )
      };
    case 'ADD_JOB':
      return {
        ...state,
        jobsByPhase: Object.fromEntries(
          Object.entries(state.jobsByPhase).map(([phase, jobs]) => [
            phase,
            phase === action.job.job_phase.job_phase_label ? [action.job, ...jobs] : jobs
          ])
        )
      };
    case 'REMOVE_JOB':
      return {
        ...state,
        jobsByPhase: Object.fromEntries(
          Object.entries(state.jobsByPhase).map(([phase, jobs]) => [
            phase,
            jobs.filter(job => job.id !== action.jobId)
          ])
        )
      };
    case 'SET_LAST_FETCHED':
      return {
        ...state,
        lastFetched: { ...state.lastFetched, [action.phase]: action.timestamp }
      };
    default:
      return state;
  }
}

interface JobDataContextType {
  state: JobDataState;
  fetchJobs: (phaseLabel: string | string[], forceRefresh?: boolean) => Promise<void>;
  getJobs: (phaseLabel: string) => Job[];
  getTodaysJobs: () => Job[];
  isLoading: (phaseLabel: string) => boolean;
  getError: (phaseLabel: string) => string | null;
  updateJob: (job: Job) => void;
  addJob: (job: Job) => void;
  removeJob: (jobId: string) => void;
  preloadCommonPhases: () => Promise<void>;
}

const JobDataContext = createContext<JobDataContextType | undefined>(undefined);

export function JobDataProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(jobDataReducer, initialState);
  const { initializing: authInitializing } = useAuth();
  
  // Use refs to track state without causing re-renders
  const stateRef = useRef(state);
  const loadingStatesRef = useRef<Record<string, boolean>>({});
  const lastFetchedRef = useRef<Record<string, number>>({});
  const phaseIdsRef = useRef<Record<string, string[]>>({});

  // Update refs when state changes
  useEffect(() => {
    stateRef.current = state;
    loadingStatesRef.current = state.loadingStates;
    lastFetchedRef.current = state.lastFetched;
    phaseIdsRef.current = state.phaseIds;
  }, [state]);

  // Fetch jobs for a specific phase
  const fetchJobs = useCallback(async (phaseLabel: string | string[], forceRefresh = false) => {
    console.log('JobDataProvider: fetchJobs called for:', phaseLabel, 'forceRefresh:', forceRefresh);
    const phases = Array.isArray(phaseLabel) ? phaseLabel : [phaseLabel];
    
    // Process each phase individually to ensure proper data storage
    for (const phase of phases) {
      const phaseKey = phase; // Use individual phase name as key
      const now = Date.now();
      
      const lastFetched = lastFetchedRef.current[phaseKey] || 0;
      const isLoading = loadingStatesRef.current[phaseKey];
      const shouldFetch = forceRefresh || !isLoading || (now - lastFetched > 30000); // 30 second cache

      if (!shouldFetch) {
        console.log('JobDataProvider: Skipping fetch for', phase, '- not needed');
        continue;
      }

      console.log('JobDataProvider: Fetching jobs for', phase);
      dispatch({ type: 'SET_LOADING', phase: phaseKey, loading: true });
      dispatch({ type: 'SET_ERROR', phase: phaseKey, error: null });

      try {
        // First, get phase IDs if we don't have them
        if (!phaseIdsRef.current[phaseKey]) {
          console.log('JobDataProvider: Fetching phase IDs for', phase);
          const { data: phaseData, error: phaseError } = await supabase
            .from('job_phases')
            .select('id')
            .eq('job_phase_label', phase);

          if (phaseError) throw phaseError;
          if (!phaseData?.length) throw new Error(`${phase} phase not found`);

          console.log('JobDataProvider: Phase IDs found:', phaseData.map(phase => phase.id));
          const phaseIds = phaseData.map(phase => phase.id);
          
          // Update both the ref and the state immediately
          phaseIdsRef.current[phaseKey] = phaseIds;
          dispatch({ type: 'SET_PHASE_IDS', phase: phaseKey, ids: phaseIds });
        }

        // Determine sort order based on phase
        let orderColumn = 'created_at';
        let ascending = false;
        
        if (phase === 'Job Request') {
          orderColumn = 'created_at';
          ascending = false;
        } else if (['Work Order', 'Pending Work Order', 'Grading', 'Invoicing'].includes(phase)) {
          orderColumn = 'updated_at';
          ascending = false;
        }

        // Fetch jobs
        console.log('JobDataProvider: Fetching jobs with phase IDs:', phaseIdsRef.current[phaseKey]);
        
        // Include invoice fields for invoicing phase
        const isInvoicingPhase = phaseLabel === 'Invoicing' || 
        (Array.isArray(phaseLabel) && phaseLabel.includes('Invoicing')) ||
        phases.some(phase => phase.job_phase_label === 'Invoicing');
        
        const selectFields = `
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            total_billing_amount,
            created_at,
            updated_at,
            assigned_to,
            purchase_order,
            ${isInvoicingPhase ? 'invoice_sent, invoice_paid, invoice_sent_date, invoice_paid_date,' : ''}
            property:properties (
              id,
              property_name,
              address,
              city,
              state
            ),
            unit_size:unit_sizes (
              unit_size_label
            ),
            job_type:job_types (
              job_type_label
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_light_mode,
              color_dark_mode
            )
          `;
        
        const { data, error } = await supabase
          .from('jobs')
          .select(selectFields)
          .in('current_phase_id', phaseIdsRef.current[phaseKey] || [])
          .order(orderColumn, { ascending })
          .limit(100);

        if (error) throw error;

        console.log('JobDataProvider: Jobs fetched successfully:', data?.length || 0, 'jobs');
        if (data && data.length > 0) {
          console.log('JobDataProvider: Sample job data:', data[0]);
          console.log('JobDataProvider: Sample job scheduled_date:', data[0]?.scheduled_date);
          console.log('JobDataProvider: Sample job phase info:', data[0]?.job_phase);
        } else {
          console.log('JobDataProvider: No jobs found for phase:', phase);
        }

        // Transform data to match Job interface
        const transformedJobs: Job[] = (data || []).map(job => ({
          id: job.id,
          work_order_num: job.work_order_num,
          unit_number: job.unit_number,
          scheduled_date: job.scheduled_date,
          total_billing_amount: job.total_billing_amount,
          created_at: job.created_at,
          updated_at: job.updated_at,
          assigned_to: job.assigned_to,
          purchase_order: job.purchase_order,
          invoice_sent: job.invoice_sent,
          invoice_paid: job.invoice_paid,
          invoice_sent_date: job.invoice_sent_date,
          invoice_paid_date: job.invoice_paid_date,
          property: Array.isArray(job.property) ? job.property[0] : job.property,
          unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
          job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
          job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase,
        }));


        dispatch({ type: 'SET_JOBS', phase: phaseKey, jobs: transformedJobs });
        dispatch({ type: 'SET_LAST_FETCHED', phase: phaseKey, timestamp: now });
      } catch (error) {
        console.error(`JobDataProvider: Error fetching jobs for ${phase}:`, error);
        dispatch({ 
          type: 'SET_ERROR', 
          phase: phaseKey, 
          error: error instanceof Error ? error.message : 'Failed to fetch jobs' 
        });
      } finally {
        dispatch({ type: 'SET_LOADING', phase: phaseKey, loading: false });
      }
    }
  }, []); // No dependencies - using refs instead

  // Get jobs for a specific phase
  const getJobs = useCallback((phaseLabel: string) => {
    return state.jobsByPhase[phaseLabel] || [];
  }, [state.jobsByPhase]);

  // Get today's jobs across all phases
  const getTodaysJobs = useCallback(() => {
    const todayString = getCurrentDateInEastern(); // YYYY-MM-DD
    
    const allJobs = Object.values(state.jobsByPhase).flat();
    return allJobs.filter(job => {
      if (!job.scheduled_date) return false;
      // Extract date portion from timestamptz: "2026-01-23T00:00:00-05:00" → "2026-01-23"
      const jobDateOnly = job.scheduled_date.split('T')[0];
      return jobDateOnly === todayString;
    });
  }, [state.jobsByPhase]);

  // Check if a phase is loading
  const isLoading = useCallback((phaseLabel: string) => {
    return state.loadingStates[phaseLabel] || false;
  }, [state.loadingStates]);

  // Get error for a specific phase
  const getError = useCallback((phaseLabel: string) => {
    return state.errorStates[phaseLabel] || null;
  }, [state.errorStates]);

  // Update a job (for real-time updates)
  const updateJob = useCallback((job: Job) => {
    dispatch({ type: 'UPDATE_JOB', job });
  }, []);

  // Add a new job (for real-time updates)
  const addJob = useCallback((job: Job) => {
    dispatch({ type: 'ADD_JOB', job });
  }, []);

  // Remove a job (for real-time updates)
  const removeJob = useCallback((jobId: string) => {
    dispatch({ type: 'REMOVE_JOB', jobId });
  }, []);

  // Preload common phases for faster navigation
  const preloadCommonPhases = useCallback(async () => {
    console.log('JobDataProvider: Preloading common phases...');
    const commonPhases = ['Job Request', 'Pending Work Order', 'Work Order', 'Completed', 'Invoicing'];
    
    // Debug each phase individually
    for (const phase of commonPhases) {
      console.log(`JobDataProvider: Testing phase: ${phase}`);
      try {
        await fetchJobs(phase);
        console.log(`JobDataProvider: Successfully fetched ${phase}`);
      } catch (error) {
        console.error(`JobDataProvider: Failed to fetch ${phase}:`, error);
      }
    }
  }, [fetchJobs]);

  // Set up real-time subscriptions for all phases
  useEffect(() => {
    if (authInitializing) {
      return;
    }
    console.log('JobDataProvider: Setting up real-time subscriptions...');
    const subscription = supabase
      .channel('job-data-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs'
      }, async (payload) => {
        console.log('JobDataProvider: New job inserted:', payload.new);
        // Fetch the complete job data
        const { data: newJob, error } = await supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            total_billing_amount,
            created_at,
            updated_at,
            assigned_to,
            property:properties (
              id,
              property_name,
              address,
              city,
              state
            ),
            unit_size:unit_sizes (
              unit_size_label
            ),
            job_type:job_types (
              job_type_label
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_light_mode,
              color_dark_mode
            ),
            profiles:assigned_to (
              full_name
            )
          `)
          .eq('id', payload.new.id)
          .single();
          
        if (!error && newJob) {
          const transformedJob: Job = {
            id: newJob.id,
            work_order_num: newJob.work_order_num,
            unit_number: newJob.unit_number,
            scheduled_date: newJob.scheduled_date,
            total_billing_amount: newJob.total_billing_amount,
            created_at: newJob.created_at,
            updated_at: newJob.updated_at,
            assigned_to: newJob.assigned_to,
            property: Array.isArray(newJob.property) ? newJob.property[0] : newJob.property,
            unit_size: Array.isArray(newJob.unit_size) ? newJob.unit_size[0] : newJob.unit_size,
            job_type: Array.isArray(newJob.job_type) ? newJob.job_type[0] : newJob.job_type,
            job_phase: Array.isArray(newJob.job_phase) ? newJob.job_phase[0] : newJob.job_phase,
          };
          addJob(transformedJob);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs'
      }, async (payload) => {
        console.log('JobDataProvider: Job updated:', payload.new);
        // Refetch the updated job
        const { data: updatedJob, error } = await supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            total_billing_amount,
            created_at,
            updated_at,
            assigned_to,
            property:properties (
              id,
              property_name,
              address,
              city,
              state
            ),
            unit_size:unit_sizes (
              unit_size_label
            ),
            job_type:job_types (
              job_type_label
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_light_mode,
              color_dark_mode
            ),
            profiles:assigned_to (
              full_name
            )
          `)
          .eq('id', payload.new.id)
          .single();
          
        if (!error && updatedJob) {
          const transformedJob: Job = {
            id: updatedJob.id,
            work_order_num: updatedJob.work_order_num,
            unit_number: updatedJob.unit_number,
            scheduled_date: updatedJob.scheduled_date,
            total_billing_amount: updatedJob.total_billing_amount,
            created_at: updatedJob.created_at,
            updated_at: updatedJob.updated_at,
            assigned_to: updatedJob.assigned_to,
            property: Array.isArray(updatedJob.property) ? updatedJob.property[0] : updatedJob.property,
            unit_size: Array.isArray(updatedJob.unit_size) ? updatedJob.unit_size[0] : updatedJob.unit_size,
            job_type: Array.isArray(updatedJob.job_type) ? updatedJob.job_type[0] : updatedJob.job_type,
            job_phase: Array.isArray(updatedJob.job_phase) ? updatedJob.job_phase[0] : updatedJob.job_phase,
          };
          updateJob(transformedJob);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'jobs'
      }, (payload) => {
        console.log('JobDataProvider: Job deleted:', payload.old);
        removeJob(payload.old.id);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'job_phase_changes'
      }, async (payload) => {
        console.log('JobDataProvider: Phase change detected:', payload.new);
        // Refetch jobs for affected phases
        const { data: phaseChange, error } = await supabase
          .from('job_phase_changes')
          .select(`
            from_phase:from_phase_id(job_phase_label),
            to_phase:to_phase_id(job_phase_label)
          `)
          .eq('id', payload.new.id)
          .single();
          
        if (!error && phaseChange) {
          const fromPhase = Array.isArray(phaseChange.from_phase) ? phaseChange.from_phase[0] : phaseChange.from_phase;
          const toPhase = Array.isArray(phaseChange.to_phase) ? phaseChange.to_phase[0] : phaseChange.to_phase;
          
          if (fromPhase?.job_phase_label) {
            console.log('JobDataProvider: Refetching from phase:', fromPhase.job_phase_label);
            fetchJobs(fromPhase.job_phase_label, true);
          }
          if (toPhase?.job_phase_label) {
            console.log('JobDataProvider: Refetching to phase:', toPhase.job_phase_label);
            fetchJobs(toPhase.job_phase_label, true);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles'
      }, async (payload) => {
        console.log('JobDataProvider: Profile updated:', payload.new);
        // Refetch all jobs to update assigned_to names
        const commonPhases = ['Job Request', 'Pending Work Order', 'Work Order', 'Completed', 'Invoicing'];
        for (const phase of commonPhases) {
          fetchJobs(phase, true);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs'
      }, async (payload) => {
        // Check if assigned_to field changed
        if (payload.old?.assigned_to !== payload.new?.assigned_to) {
          console.log('JobDataProvider: Job assignment changed:', {
            jobId: payload.new.id,
            oldAssignedTo: payload.old?.assigned_to,
            newAssignedTo: payload.new?.assigned_to
          });
          // Refetch jobs for all phases to update assignment display
          const commonPhases = ['Job Request', 'Pending Work Order', 'Work Order', 'Completed', 'Invoicing'];
          for (const phase of commonPhases) {
            fetchJobs(phase, true);
          }
        }
      })
      .subscribe((status) => {
        console.log('JobDataProvider: Real-time subscription status:', status);
      });

    return () => {
      console.log('JobDataProvider: Cleaning up real-time subscriptions');
      subscription.unsubscribe();
    };
  }, [addJob, updateJob, removeJob, fetchJobs, authInitializing]);

  // Preload common phases on mount
  useEffect(() => {
    if (authInitializing) {
      return;
    }
    console.log('JobDataProvider: Preloading common phases...');
    console.log('JobDataProvider: Current state:', state);
    
    // Test database connection first
    const testConnection = async () => {
      try {
        console.log('JobDataProvider: Testing database connection...');
        
        // Test 1: Check if we can access the job_phases table
        const { data: phasesTest, error: phasesError } = await supabase
          .from('job_phases')
          .select('id, job_phase_label')
          .limit(5);
        
        if (phasesError) {
          console.error('JobDataProvider: Error accessing job_phases table:', phasesError);
        } else {
          console.log('JobDataProvider: Successfully accessed job_phases table:', phasesTest);
        }
        
        // Test 2: Check if we can access the jobs table
        const { data: jobsTest, error: jobsError } = await supabase
          .from('jobs')
          .select('id, work_order_num')
          .limit(5);
        
        if (jobsError) {
          console.error('JobDataProvider: Error accessing jobs table:', jobsError);
        } else {
          console.log('JobDataProvider: Successfully accessed jobs table:', jobsTest);
        }
        
        // Test 3: Check if we can access the properties table
        const { data: propertiesTest, error: propertiesError } = await supabase
          .from('properties')
          .select('id, property_name')
          .limit(5);
        
        if (propertiesError) {
          console.error('JobDataProvider: Error accessing properties table:', propertiesError);
        } else {
          console.log('JobDataProvider: Successfully accessed properties table:', propertiesTest);
        }
        
      } catch (error) {
        console.error('JobDataProvider: Database connection test failed:', error);
      }
    };
    
    testConnection();
    preloadCommonPhases();
  }, [preloadCommonPhases, authInitializing]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('JobDataProvider: State updated:', {
      jobsByPhase: Object.keys(state.jobsByPhase).map(key => ({ [key]: state.jobsByPhase[key].length })),
      loadingStates: state.loadingStates,
      errorStates: state.errorStates,
      phaseIds: state.phaseIds
    });
  }, [state]);

  const value: JobDataContextType = useMemo(() => ({
    state,
    fetchJobs,
    getJobs,
    getTodaysJobs,
    isLoading,
    getError,
    updateJob,
    addJob,
    removeJob,
    preloadCommonPhases,
  }), [state, fetchJobs, getJobs, getTodaysJobs, isLoading, getError, updateJob, addJob, removeJob, preloadCommonPhases]);

  return (
    <JobDataContext.Provider value={value}>
      {children}
    </JobDataContext.Provider>
  );
}

export function useJobData() {
  const context = useContext(JobDataContext);
  if (context === undefined) {
    throw new Error('useJobData must be used within a JobDataProvider');
  }
  return context;
}
