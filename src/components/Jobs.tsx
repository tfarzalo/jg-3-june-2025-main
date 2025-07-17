import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';
import { useSessionValidation } from '../hooks/useSessionValidation';

export function Jobs() {
  // Validate session when component mounts (handles expired sessions)
  useSessionValidation();
  
  const { jobs, loading, error } = useJobFetch({ 
    phaseLabel: ['Job Request', 'Work Order', 'Pending Work Order', 'Invoicing', 'Completed', 'Cancelled'] 
  });

  // Only show amount column for Invoicing and Completed jobs
  const hideAmountColumn = !jobs.some(job => 
    job.job_phase?.job_phase_label === 'Invoicing' || 
    job.job_phase?.job_phase_label === 'Completed'
  ) || jobs.some(job => 
    job.job_phase?.job_phase_label === 'Cancelled'
  );

  return (
    <JobListingPage
      title="All Jobs"
      jobs={jobs}
      loading={loading}
      error={error}
      showAddButton={true}
      hideAmountColumn={hideAmountColumn}
    />
  );
}