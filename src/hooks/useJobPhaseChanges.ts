import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { debounce } from '../lib/utils/debounce';

interface JobPhaseChange {
  id: string;
  job_id: string;
  changed_by: string;
  changed_by_name: string;
  changed_by_email: string;
  from_phase_id: string | null;
  to_phase_id: string;
  change_reason: string;
  changed_at: string;
  from_phase_label: string | null;
  from_phase_color: string | null;
  to_phase_label: string;
  to_phase_color: string;
}

export function useJobPhaseChanges(jobId: string | undefined) {
  const [phaseChanges, setPhaseChanges] = useState<JobPhaseChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum time between fetches in milliseconds

  const fetchPhaseChanges = useCallback(async () => {
    if (!jobId) {
      setPhaseChanges([]);
      setLoading(false);
      return;
    }

    // Prevent fetching too frequently
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTimeRef.current = now;

    try {
      const { data, error } = await supabase
        .rpc('get_job_phase_changes', { input_job_id: jobId });

      if (error) throw error;
      
      if (isMountedRef.current) {
        setPhaseChanges(data || []);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching phase changes:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch phase changes');
        setPhaseChanges([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [jobId]);

  // Create a debounced version of fetchPhaseChanges
  const debouncedFetchPhaseChanges = useCallback(
    debounce(() => {
      if (isMountedRef.current) {
        fetchPhaseChanges();
      }
    }, 1000),
    [fetchPhaseChanges]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchPhaseChanges();

    // Subscribe to phase changes
    const channel = supabase
      .channel(`job-${jobId}-phase-changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_phase_changes',
        filter: `job_id=eq.${jobId}`
      }, () => {
        if (isMountedRef.current) {
          debouncedFetchPhaseChanges();
        }
      })
      .subscribe();

    return () => {
      isMountedRef.current = false;
      channel.unsubscribe();
    };
  }, [jobId, fetchPhaseChanges, debouncedFetchPhaseChanges]);

  return {
    phaseChanges,
    loading,
    error,
    refetch: fetchPhaseChanges
  };
}