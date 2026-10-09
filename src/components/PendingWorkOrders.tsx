import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';
import { supabase } from '../utils/supabase';
import { latestApprovalStatuses, type ApprovalListStatus } from '../lib/approvals/approvalStatus';

export function PendingWorkOrders() {
  const location = useLocation();
  const { sortField, sortDirection } = location.state || {};

  const { jobs, loading, error } = useJobFetch({
    phaseLabel: 'Pending Work Order'
  });
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalListStatus>>({});

  const fetchApprovalStatuses = useCallback(async () => {
    const jobIds = jobs.map(job => job.id);
    if (!jobIds.length) {
      setApprovalStatuses({});
      return;
    }
    const { data, error: statusError } = await supabase
      .from('approval_tokens')
      .select('job_id, decision, used_at, invalidated_at, invalidation_reason, created_at')
      .eq('approval_type', 'extra_charges')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });
    if (statusError) {
      console.error('Unable to load approval statuses:', statusError);
      return;
    }
    setApprovalStatuses(latestApprovalStatuses(data || []));
  }, [jobs]);

  useEffect(() => { void fetchApprovalStatuses(); }, [fetchApprovalStatuses]);

  useEffect(() => {
    const channel = supabase.channel('pending-work-order-approval-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_tokens' }, () => {
        void fetchApprovalStatuses();
      })
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, [fetchApprovalStatuses]);

  const prioritySortedJobs = useMemo(() => [...jobs].sort((left, right) => {
    const leftPriority = approvalStatuses[left.id] === 'declined' ? 0 : 1;
    const rightPriority = approvalStatuses[right.id] === 'declined' ? 0 : 1;
    return leftPriority - rightPriority;
  }), [jobs, approvalStatuses]);

  return (
    <JobListingPage
      title="Pending Work Orders"
      jobs={prioritySortedJobs}
      loading={loading}
      error={error}
      phaseLabel="Pending Work Order"
      showAddButton={false}
      hideAmountColumn={true}
      initialSortConfig={sortField ? { field: sortField, direction: sortDirection } : undefined}
      approvalStatuses={approvalStatuses}
    />
  );
}
