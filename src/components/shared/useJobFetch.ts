import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import type { Job } from './JobListingPage';

interface UseJobFetchProps {
  phaseLabel: string | string[];
}

export function useJobFetch({ phaseLabel }: UseJobFetchProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseIds, setPhaseIds] = useState<string[]>([]);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum time between fetches in milliseconds

  const fetchJobs = useCallback(async (forceRefresh = false) => {
    // Prevent fetching too frequently unless forced
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .in('job_phase_label', Array.isArray(phaseLabel) ? phaseLabel : [phaseLabel]);

      if (phaseError) throw phaseError;
      if (!phaseData?.length) throw new Error(`${phaseLabel} phase not found`);

      // Store phase IDs for subscription filtering
      if (isMountedRef.current) {
        setPhaseIds(phaseData.map(phase => phase.id));
      }

      // Determine sort order based on phase
      let orderColumn = 'created_at';
      let ascending = false;
      
      // For Job Requests, sort by creation date (newest first)
      if (phaseLabel === 'Job Request' || (Array.isArray(phaseLabel) && phaseLabel.includes('Job Request'))) {
        orderColumn = 'created_at';
        ascending = false;
      } 
      // For Work Orders, Grading, Invoicing, sort by modified date (newest first)
      else if (
        phaseLabel === 'Work Order' || 
        phaseLabel === 'Pending Work Order' ||
        phaseLabel === 'Grading' || 
        phaseLabel === 'Invoicing' ||
        (Array.isArray(phaseLabel) && (
          phaseLabel.includes('Work Order') || 
          phaseLabel.includes('Pending Work Order') ||
          phaseLabel.includes('Grading') || 
          phaseLabel.includes('Invoicing')
        ))
      ) {
        orderColumn = 'updated_at';
        ascending = false;
      }

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          total_billing_amount,
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
        `)
        .in('current_phase_id', phaseData.map(phase => phase.id))
        .order(orderColumn, { ascending });

      if (error) throw error;
      
      if (isMountedRef.current) {
        // Transform the data to match the Job interface
        const transformedJobs: Job[] = (data || []).map(job => ({
          id: job.id,
          work_order_num: job.work_order_num,
          unit_number: job.unit_number,
          scheduled_date: job.scheduled_date,
          total_billing_amount: job.total_billing_amount,
          property: Array.isArray(job.property) ? job.property[0] : job.property,
          unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
          job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
          job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase,
        }));
        
        setJobs(transformedJobs);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [phaseLabel]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchJobs();

    return () => {
      isMountedRef.current = false;
      
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchJobs]);

  // Separate effect for subscription that depends on phaseIds
  useEffect(() => {
    if (phaseIds.length === 0) return;

    // Set up real-time subscription for job changes
    const subscription = supabase
      .channel('jobs-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: `current_phase_id=in.(${phaseIds.join(',')})`
      }, async (payload) => {
        if (isMountedRef.current) {
          console.log('New job added to phase:', payload.new);
          
          // Fetch the complete job data with relations
          const { data: newJob, error } = await supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              scheduled_date,
              total_billing_amount,
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
            `)
            .eq('id', payload.new.id)
            .single();
            
          if (!error && newJob) {
            // Transform the data to match the Job interface
            const transformedJob: Job = {
              id: newJob.id,
              work_order_num: newJob.work_order_num,
              unit_number: newJob.unit_number,
              scheduled_date: newJob.scheduled_date,
              total_billing_amount: newJob.total_billing_amount,
              property: Array.isArray(newJob.property) ? newJob.property[0] : newJob.property,
              unit_size: Array.isArray(newJob.unit_size) ? newJob.unit_size[0] : newJob.unit_size,
              job_type: Array.isArray(newJob.job_type) ? newJob.job_type[0] : newJob.job_type,
              job_phase: Array.isArray(newJob.job_phase) ? newJob.job_phase[0] : newJob.job_phase,
            };
            setJobs(prev => [transformedJob, ...prev]);
          } else {
            // Fallback to full refetch if individual fetch fails
            fetchJobs(true);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `current_phase_id=in.(${phaseIds.join(',')})`
      }, async (payload) => {
        if (isMountedRef.current) {
          console.log('Job updated in phase:', payload.new);
          
          // Check if the job still belongs to our phase filter
          if (phaseIds.includes(payload.new.current_phase_id)) {
            // Fetch the complete updated job data
            const { data: updatedJob, error } = await supabase
              .from('jobs')
              .select(`
                id,
                work_order_num,
                unit_number,
                scheduled_date,
                total_billing_amount,
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
              `)
              .eq('id', payload.new.id)
              .single();
              
            if (!error && updatedJob) {
              // Transform the data to match the Job interface
              const transformedJob: Job = {
                id: updatedJob.id,
                work_order_num: updatedJob.work_order_num,
                unit_number: updatedJob.unit_number,
                scheduled_date: updatedJob.scheduled_date,
                total_billing_amount: updatedJob.total_billing_amount,
                property: Array.isArray(updatedJob.property) ? updatedJob.property[0] : updatedJob.property,
                unit_size: Array.isArray(updatedJob.unit_size) ? updatedJob.unit_size[0] : updatedJob.unit_size,
                job_type: Array.isArray(updatedJob.job_type) ? updatedJob.job_type[0] : updatedJob.job_type,
                job_phase: Array.isArray(updatedJob.job_phase) ? updatedJob.job_phase[0] : updatedJob.job_phase,
              };
              setJobs(prev => prev.map(job => 
                job.id === transformedJob.id ? transformedJob : job
              ));
            } else {
              // Fallback to full refetch if individual fetch fails
              fetchJobs(true);
            }
          } else {
            // Job moved to a different phase, remove it from current list
            setJobs(prev => prev.filter(job => job.id !== payload.new.id));
          }
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'jobs'
      }, (payload) => {
        if (isMountedRef.current) {
          console.log('Job deleted:', payload.old);
          setJobs(prev => prev.filter(job => job.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [phaseIds, fetchJobs]);

  return { 
    jobs, 
    loading, 
    error,
    refetch: () => fetchJobs(true)
  };
}