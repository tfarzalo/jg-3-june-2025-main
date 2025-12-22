import { JobListingPage } from './shared/JobListingPage';
import { useJobDataHook } from './shared/useJobDataHook';

export function Invoicing() {
  const { jobs, loading, error } = useJobDataHook('Invoicing');

  return (
    <JobListingPage
      title="Invoicing"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel="Invoicing"
      showInvoiceColumns={true}
    />
  );
}
