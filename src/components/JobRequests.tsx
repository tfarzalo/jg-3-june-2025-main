import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function JobRequests() {
  const { jobs, loading, error } = useJobFetch({ 
    phaseLabel: ['Job Request'] 
  });

  return (
    <JobListingPage
      title="Job Requests"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel={['Job Request']}
      showAddButton={true}
      hideAmountColumn={true}
    />
  );
}