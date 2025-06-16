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

  const fetchJobs = useCallback(async () => {
    // Prevent fetching too frequently
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
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
      let orderDirection: 'asc' | 'desc' = 'desc';
      
      // For Job Requests, sort by creation date (newest first)
      if (phaseLabel === 'Job Request' || (Array.isArray(phaseLabel) && phaseLabel.includes('Job Request'))) {
        orderColumn = 'created_at';
        orderDirection = 'desc';
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
        orderDirection = 'desc';
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
        .order(orderColumn, { ascending: orderDirection === 'asc' });

      if (error) throw error;
      
      if (isMountedRef.current) {
        setJobs(data || []);
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

    // Set up real-time subscription for job changes
    const subscription = supabase
      .channel('jobs-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: phaseIds.length > 0 ? `current_phase_id=in.(${phaseIds.join(',')})` : undefined
      }, () => {
        if (isMountedRef.current) {
          console.log('Jobs changed, refreshing data...');
          fetchJobs();
        }
      })
      .subscribe();

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchJobs, phaseIds]);

  return { 
    jobs, 
    loading, 
    error,
    refetch: fetchJobs
  };
}