import React from 'react';
import { useLocation } from 'react-router-dom';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function WorkOrders() {
  const location = useLocation();
  const { sortField, sortDirection } = location.state || {};

  const { jobs, loading, error } = useJobFetch({ 
    phaseLabel: 'Work Order' 
  });

  return (
    <JobListingPage
      title="Work Orders"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel="Work Order"
      showAddButton={false}
      hideAmountColumn={true}
      initialSortConfig={sortField ? { field: sortField, direction: sortDirection } : undefined}
    />
  );
}
