import React from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

export function Archives() {
  const { jobs, loading, error, refetch } = useJobFetch({ phaseLabel: 'Archived' });

  return (
    <JobListingPage
      title="Archived Jobs"
      jobs={jobs}
      loading={loading}
      error={error}
      refetch={refetch}
      isArchive={true}
      hideAmountColumn={true}
    />
  );
}

export default Archives;