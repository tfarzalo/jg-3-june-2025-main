import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { debounce } from '../lib/utils/debounce';

interface JobPhase {
  id: string;
  job_phase_label: string;
  color_light_mode: string;
  color_dark_mode: string;
  sort_order: number;
}

export function usePhases() {
  const [phases, setPhases] = useState<JobPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 10000; // Minimum time between fetches in milliseconds

  const fetchPhases = useCallback(async () => {
    // Prevent fetching too frequently
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTimeRef.current = now;

    try {
      const { data, error } = await supabase
        .from('job_phases')
        .select('*')
        .neq('job_phase_label', 'Grading')
        .order('sort_order');

      if (error) throw error;
      
      if (isMountedRef.current) {
        setPhases(data || []);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch phases');
        setPhases([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Create a debounced version of fetchPhases
  const debouncedFetchPhases = useCallback(
    debounce(() => {
      if (isMountedRef.current) {
        fetchPhases();
      }
    }, 1000),
    [fetchPhases]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchPhases();

    // Subscribe to phase changes
    const channel = supabase
      .channel('job_phases_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_phases'
      }, () => {
        if (isMountedRef.current) {
          debouncedFetchPhases();
        }
      })
      .subscribe();

    return () => {
      isMountedRef.current = false;
      channel.unsubscribe();
    };
  }, [fetchPhases, debouncedFetchPhases]);

  return {
    phases,
    loading,
    error,
    refetch: fetchPhases
  };
}