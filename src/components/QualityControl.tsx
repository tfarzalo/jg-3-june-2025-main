import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ClipboardCheck } from 'lucide-react';
import { JobListingPage, type Job } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';
import { supabase } from '../utils/supabase';

type SubmittedQcJobRecord = Omit<Job, 'property' | 'unit_size' | 'job_type' | 'job_phase' | 'assigned_to_profile'> & {
  property: Job['property'] | Job['property'][] | null;
  unit_size: Job['unit_size'] | Job['unit_size'][] | null;
  job_type: Job['job_type'] | Job['job_type'][] | null;
  job_phase: Job['job_phase'] | NonNullable<Job['job_phase']>[] | null;
  assigned_to_profile?: Job['assigned_to_profile'] | NonNullable<Job['assigned_to_profile']>[] | null;
};

interface SubmittedQcRow {
  job_id?: string | null;
  job?: SubmittedQcJobRecord | SubmittedQcJobRecord[] | null;
}

function firstRelatedRecord<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function normalizeSubmittedQcJob(row: SubmittedQcRow): Job | null {
  const job = firstRelatedRecord(row.job);
  if (!job) return null;
  const property = firstRelatedRecord(job.property);
  const unitSize = firstRelatedRecord(job.unit_size);
  const jobType = firstRelatedRecord(job.job_type);

  if (!property || !unitSize || !jobType) return null;

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
    property,
    unit_size: unitSize,
    job_type: jobType,
    job_phase: firstRelatedRecord(job.job_phase),
    assigned_to_profile: firstRelatedRecord(job.assigned_to_profile),
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
      const submissionSelect = `
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
      `;

      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      const rows: SubmittedQcRow[] = [];

      while (hasMore) {
        const { data, error: qcError } = await supabase
          .from('job_quality_control_submissions')
          .select(submissionSelect)
          .order('updated_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (qcError) throw qcError;

        const pageRows = (data || []) as SubmittedQcRow[];
        rows.push(...pageRows);
        hasMore = pageRows.length === pageSize;
        from += pageSize;
      }

      const found = new Set<string>();
      const uniqueSubmittedJobs: Job[] = [];

      rows.forEach((row) => {
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
