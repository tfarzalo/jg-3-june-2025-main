import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function WorkOrders() {
  const { jobs, loading, error } = useJobFetch({ 
    phaseLabel: ['Work Order', 'Pending Work Order'] 
  });

  return (
    <JobListingPage
      title="Work Orders"
      jobs={jobs}
      loading={loading}
      error={error}
      showAddButton={false}
      hideAmountColumn={true}
    />
  );
}