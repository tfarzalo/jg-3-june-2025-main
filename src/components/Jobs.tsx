import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function Jobs() {
  const { jobs, loading, error } = useJobFetch({ 
    phaseLabel: ['Job Request', 'Work Order', 'Pending Work Order', 'Invoicing', 'Completed', 'Cancelled'] 
  });

  return (
    <JobListingPage
      title="All Jobs"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel={['Job Request', 'Work Order', 'Pending Work Order', 'Invoicing', 'Completed', 'Cancelled']}
      showAddButton={true}
      hideAmountColumn={false}
      showArchivesButton={true}
    />
  );
}
