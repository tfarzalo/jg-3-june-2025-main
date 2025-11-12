import { useJobData } from '@/contexts/JobDataContext';
import { useEffect } from 'react';

export function useJobDataHook(phaseLabel: string | string[]) {
  const { getJobs, isLoading, getError, fetchJobs } = useJobData();
  const phases = Array.isArray(phaseLabel) ? phaseLabel : [phaseLabel];
  const phaseKey = phases.join('|');
  
  const jobs = getJobs(phaseKey);
  const loading = isLoading(phaseKey);
  const error = getError(phaseKey);

  // Fetch jobs if not already loaded
  useEffect(() => {
    if (jobs.length === 0 && !loading) {
      fetchJobs(phaseLabel);
    }
  }, [jobs.length, loading, fetchJobs, phaseLabel]);

  return { jobs, loading, error, refetch: () => fetchJobs(phaseLabel, true) };
}


