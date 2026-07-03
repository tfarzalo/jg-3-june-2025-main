import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ClipboardCheck } from 'lucide-react';
import { JobListingPage, type Job } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';
import { supabase } from '../utils/supabase';

function normalizeSubmittedQcJob(row: any): Job | null {
  const job = Array.isArray(row.job) ? row.job[0] : row.job;
  if (!job) return null;

  return {
    id: job.id,
    work_order_num: job.work_order_num,
    unit_number: job.unit_number,
    scheduled_date: job.scheduled_date,
    created_at: job.created_at,
    updated_at: job.updated_at,
    total_billing_amount: job.total_billing_amount,
    historical_data_mode: job.historical_data_mode === 'snapshot' ? 'snapshot' : 'live',
    active_snapshot_id: job.active_snapshot_id ?? null,
    snapshot_frozen_at: job.snapshot_frozen_at ?? null,
    invoice_sent: job.invoice_sent,
    invoice_paid: job.invoice_paid,
    invoice_sent_date: job.invoice_sent_date,
    invoice_paid_date: job.invoice_paid_date,
    cancellation_trip_charge_added: job.cancellation_trip_charge_added,
    cancellation_trip_charge_bill_amount: job.cancellation_trip_charge_bill_amount,
    cancellation_trip_charge_sub_pay_amount: job.cancellation_trip_charge_sub_pay_amount,
    purchase_order: job.purchase_order,
    property: Array.isArray(job.property) ? job.property[0] : job.property,
    unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
    job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
    job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase,
    assigned_to_profile: Array.isArray(job.assigned_to_profile) ? job.assigned_to_profile[0] : job.assigned_to_profile,
  };
}

export function QualityControl() {
  const { jobs, loading, error, refetch } = useJobFetch({ phaseLabel: 'Quality Control' });
  const [submittedJobIds, setSubmittedJobIds] = useState<Set<string>>(() => new Set());
  const [submittedQcJobs, setSubmittedQcJobs] = useState<Job[]>([]);
  const [qcLoading, setQcLoading] = useState(false);

  const sortByScheduledDate = useCallback((items: Job[]) =>
    [...items].sort((a, b) => {
      const scheduledComparison = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
      if (scheduledComparison !== 0) return scheduledComparison;
      return a.work_order_num - b.work_order_num;
    }), []);

  const loadSubmittedQcJobs = useCallback(async () => {
    setQcLoading(true);
    try {
      const { data, error: qcError } = await supabase
        .from('job_quality_control_submissions')
        .select(`
          job_id,
          updated_at,
          created_at,
          job:jobs (
            id,
            work_order_num,
            unit_number,
            scheduled_date,
            created_at,
            updated_at,
            total_billing_amount,
            historical_data_mode,
            active_snapshot_id,
            snapshot_frozen_at,
            invoice_sent,
            invoice_paid,
            invoice_sent_date,
            invoice_paid_date,
            cancellation_trip_charge_added,
            cancellation_trip_charge_bill_amount,
            cancellation_trip_charge_sub_pay_amount,
            purchase_order,
            property:properties (
              id,
              property_name,
              address,
              city,
              state
            ),
            unit_size:unit_sizes (
              id,
              unit_size_label
            ),
            job_type:job_types (
              job_type_label
            ),
            job_phase:current_phase_id (
              job_phase_label,
              color_light_mode,
              color_dark_mode
            ),
            assigned_to_profile:assigned_to (
              full_name
            )
          )
        `)
        .order('updated_at', { ascending: false });

      if (qcError) throw qcError;

      const found = new Set<string>();
      const uniqueSubmittedJobs: Job[] = [];

      (data || []).forEach((row: any) => {
        if (!row.job_id || found.has(row.job_id)) return;
        const normalized = normalizeSubmittedQcJob(row);
        if (!normalized) return;
        found.add(row.job_id);
        uniqueSubmittedJobs.push(normalized);
      });

      setSubmittedJobIds(found);
      setSubmittedQcJobs(sortByScheduledDate(uniqueSubmittedJobs));
    } catch (err) {
      console.error('Error loading submitted Quality Control jobs:', err);
      setSubmittedJobIds(new Set());
      setSubmittedQcJobs([]);
    } finally {
      setQcLoading(false);
    }
  }, [sortByScheduledDate]);

  useEffect(() => {
    loadSubmittedQcJobs();
  }, [loadSubmittedQcJobs]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetch(),
      loadSubmittedQcJobs(),
    ]);
  }, [loadSubmittedQcJobs, refetch]);

  const pendingQcJobs = useMemo(() => {
    return sortByScheduledDate(jobs.filter((job) => !submittedJobIds.has(job.id)));
  }, [jobs, sortByScheduledDate, submittedJobIds]);

  const pageLoading = loading || qcLoading;
  const scheduledDateSort = { field: 'scheduled_date' as const, direction: 'asc' as const };

  return (
    <div className="space-y-8">
      <div className="px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-6">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-100">
          <ClipboardCheck className="h-5 w-5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">Quality Control</h1>
            <p className="text-sm opacity-80">
              Jobs in Quality Control needing QC are listed first. Submitted QC jobs from any phase remain below for review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              document.getElementById('submitted-qc-cards')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
          >
            <ArrowDown className="h-4 w-4" />
            Submitted
          </button>
        </div>
      </div>

      <JobListingPage
        title="Quality Control - Needs QC Card"
        jobs={pendingQcJobs}
        loading={pageLoading}
        error={error}
        phaseLabel="Quality Control"
        refetch={handleRefresh}
        initialSortConfig={scheduledDateSort}
      />

      <section id="submitted-qc-cards" className="scroll-mt-24">
        <JobListingPage
          title="Quality Control - Submitted QC Cards"
          jobs={submittedQcJobs}
          loading={pageLoading}
          error={error}
          refetch={handleRefresh}
          initialSortConfig={scheduledDateSort}
        />
      </section>
    </div>
  );
}
