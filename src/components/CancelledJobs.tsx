import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function CancelledJobs() {
  const { jobs, loading, error } = useJobFetch({ 
    phaseLabel: ['Cancelled'] 
  });

  return (
    <JobListingPage
      title="Cancelled Jobs"
      jobs={jobs}
      loading={loading}
      error={error}
      showAddButton={false}
      hideAmountColumn={true}
    />
  );
} 