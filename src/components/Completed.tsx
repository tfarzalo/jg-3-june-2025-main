import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function Completed() {
  const { jobs, loading, error } = useJobFetch({ phaseLabel: 'Completed' });

  return (
    <JobListingPage
      title="Completed Jobs"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel="Completed"
    />
  );
}
