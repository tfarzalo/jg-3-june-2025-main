import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function Invoicing() {
  const { jobs, loading, error } = useJobFetch({ phaseLabel: 'Invoicing' });

  return (
    <JobListingPage
      title="Invoicing"
      jobs={jobs}
      loading={loading}
      error={error}
    />
  );
}