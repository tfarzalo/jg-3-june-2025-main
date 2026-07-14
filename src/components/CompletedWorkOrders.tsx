import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function CompletedWorkOrders() {
  const { jobs, loading, error } = useJobFetch({ phaseLabel: 'Completed Work Orders' });

  return (
    <JobListingPage
      title="Completed Work Orders"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel="Completed Work Orders"
      showAddButton={false}
      hideAmountColumn={false}
    />
  );
}
