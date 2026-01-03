import React from 'react';
import { useLocation } from 'react-router-dom';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function PendingWorkOrders() {
  const location = useLocation();
  const { sortField, sortDirection } = location.state || {};

  const { jobs, loading, error } = useJobFetch({
    phaseLabel: 'Pending Work Order'
  });

  return (
    <JobListingPage
      title="Pending Work Orders"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel="Pending Work Order"
      showAddButton={false}
      hideAmountColumn={true}
      initialSortConfig={sortField ? { field: sortField, direction: sortDirection } : undefined}
    />
  );
}

