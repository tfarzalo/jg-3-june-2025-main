import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

const JOB_REQUEST_PHASES = ['Job Request'];

export function JobRequests() {
  const { jobs, loading, error, refetch } = useJobFetch({
    phaseLabel: JOB_REQUEST_PHASES
  });

  return (
    <JobListingPage
      title="Job Requests"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel={JOB_REQUEST_PHASES}
      showAddButton={true}
      hideAmountColumn={true}
      refetch={refetch}
    />
  );
}
