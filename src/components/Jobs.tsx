import { useCallback, useMemo, useState } from 'react';
import { JobListingPage } from './shared/JobListingPage';
import { JobFetchQuery, useJobFetch } from './shared/useJobFetch';

const ALL_JOB_PHASES = ['Job Request', 'Pending Work Order', 'Work Order', 'Completed Work Orders', 'Quality Control', 'Completed', 'Invoicing', 'Cancelled'];
const PAGE_SIZE = 150;

export function Jobs() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Omit<JobFetchQuery, 'page' | 'pageSize'>>({
    sortField: 'scheduled_date',
    sortDirection: 'desc'
  });
  const query = useMemo<JobFetchQuery>(() => ({ ...filters, page, pageSize: PAGE_SIZE }), [filters, page]);
  const { jobs, loading, error, totalCount, refetch } = useJobFetch({ phaseLabel: ALL_JOB_PHASES, query });

  const handleQueryChange = useCallback((nextFilters: Omit<JobFetchQuery, 'page' | 'pageSize'>) => {
    setFilters(current => {
      const unchanged = JSON.stringify(current) === JSON.stringify(nextFilters);
      return unchanged ? current : nextFilters;
    });
    setPage(1);
  }, []);
  const pagination = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    totalCount,
    onPageChange: setPage,
    onQueryChange: handleQueryChange
  }), [page, totalCount, handleQueryChange]);

  return (
    <JobListingPage
      title="All Jobs"
      jobs={jobs}
      loading={loading}
      error={error}
      phaseLabel={ALL_JOB_PHASES}
      showAddButton={true}
      hideAmountColumn={false}
      showArchivesButton={true}
      refetch={refetch}
      pagination={pagination}
    />
  );
}
