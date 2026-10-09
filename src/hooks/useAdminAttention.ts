import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';
import { latestApprovalStatuses, type ApprovalListStatus } from '../lib/approvals/approvalStatus';

export type AttentionKind = 'approval_declined' | 'approval_approved' | 'approval_waiting' | 'approval_required' | 'assignment_declined';

export interface AdminAttentionItem {
  id: string;
  jobId: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  statusLabel: string;
  priority: 'urgent' | 'high' | 'normal';
  updatedAt: string;
  route: string;
  version: string;
}

interface AttentionJobRow {
  id: string;
  work_order_num: number | null;
  unit_number: string | null;
  updated_at: string | null;
  current_phase_id: string | null;
  assignment_status: string | null;
  assignment_decision_at: string | null;
  declined_reason_code: string | null;
  declined_reason_text: string | null;
  property: { property_name?: string | null } | Array<{ property_name?: string | null }> | null;
}

const relationOne = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] || null : value;

const storageKey = (userId: string) => `admin-attention-seen:${userId}`;

const readSeen = (userId: string): Record<string, string> => {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(userId)) || '{}');
  } catch {
    return {};
  }
};

export function useAdminAttention(enabled: boolean) {
  const [items, setItems] = useState<AdminAttentionItem[]>([]);
  const [seenVersions, setSeenVersions] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.id) return;
      setUserId(session.user.id);
      setSeenVersions(readSeen(session.user.id));

      const { data: phases, error: phaseError } = await supabase
        .from('job_phases')
        .select('id, job_phase_label')
        .in('job_phase_label', ['Job Request', 'Pending Work Order', 'Work Order']);
      if (phaseError) throw phaseError;
      const pendingPhaseId = phases?.find(phase => phase.job_phase_label === 'Pending Work Order')?.id;
      const actionablePhaseIds = new Set((phases || []).map(phase => phase.id));
      if (!pendingPhaseId) {
        setItems([]);
        return;
      }

      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          updated_at,
          current_phase_id,
          assignment_status,
          assignment_decision_at,
          declined_reason_code,
          declined_reason_text,
          property:properties(property_name)
        `)
        .or(`current_phase_id.eq.${pendingPhaseId},assignment_status.eq.declined`)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (jobsError) throw jobsError;

      const jobs = (jobsData || []) as unknown as AttentionJobRow[];
      const pendingJobIds = jobs.filter(job => job.current_phase_id === pendingPhaseId).map(job => job.id);
      let statuses: Record<string, ApprovalListStatus> = {};
      let approvalTimes: Record<string, string> = {};

      if (pendingJobIds.length) {
        const { data: approvals, error: approvalError } = await supabase
          .from('approval_tokens')
          .select('job_id, decision, used_at, invalidated_at, invalidation_reason, created_at')
          .eq('approval_type', 'extra_charges')
          .in('job_id', pendingJobIds)
          .order('created_at', { ascending: false });
        if (approvalError) throw approvalError;
        statuses = latestApprovalStatuses(approvals || []);
        approvalTimes = (approvals || []).reduce<Record<string, string>>((acc, row) => {
          if (!acc[row.job_id]) acc[row.job_id] = row.used_at || row.invalidated_at || row.created_at;
          return acc;
        }, {});
      }

      const nextItems: AdminAttentionItem[] = [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const isToday = (value: string) => new Date(value).getTime() >= todayStart.getTime();

      jobs.forEach(job => {
        const propertyName = relationOne(job.property)?.property_name || 'Property not listed';
        const workOrder = job.work_order_num ? `WO-${job.work_order_num}` : 'Job';
        const location = `${propertyName}${job.unit_number ? ` • Unit ${job.unit_number}` : ''}`;

        if (job.assignment_status === 'declined' && job.current_phase_id && actionablePhaseIds.has(job.current_phase_id)) {
          const updatedAt = job.assignment_decision_at || job.updated_at || new Date().toISOString();
          if (isToday(updatedAt)) {
            const reason = job.declined_reason_text || job.declined_reason_code;
            nextItems.push({
              id: `assignment:${job.id}`,
              jobId: job.id,
              kind: 'assignment_declined',
              title: `${workOrder} assignment declined`,
              detail: reason ? `${location} • ${reason}` : location,
              statusLabel: 'Reassignment needed',
              priority: 'urgent',
              updatedAt,
              route: `/dashboard/jobs/${job.id}`,
              version: `assignment:${job.id}:${updatedAt}`,
            });
          }
        }

        if (job.current_phase_id !== pendingPhaseId) return;
        const status = statuses[job.id] || 'not_sent';
        const updatedAt = approvalTimes[job.id] || job.updated_at || new Date().toISOString();
        if (!isToday(updatedAt)) return;
        const presentation: Record<ApprovalListStatus, Pick<AdminAttentionItem, 'kind' | 'title' | 'statusLabel' | 'priority'>> = {
          declined: { kind: 'approval_declined', title: `${workOrder} approval declined`, statusLabel: 'Action required', priority: 'urgent' },
          approved: { kind: 'approval_approved', title: `${workOrder} approval approved`, statusLabel: 'Ready to advance', priority: 'high' },
          sent: { kind: 'approval_waiting', title: `${workOrder} awaiting approval`, statusLabel: 'Response pending', priority: 'normal' },
          modified: { kind: 'approval_required', title: `${workOrder} charges changed`, statusLabel: 'Resend approval', priority: 'high' },
          not_sent: { kind: 'approval_required', title: `${workOrder} needs approval notice`, statusLabel: 'Notice not sent', priority: 'high' },
        };
        const meta = presentation[status];
        nextItems.push({
          id: `approval:${job.id}`,
          jobId: job.id,
          ...meta,
          detail: location,
          updatedAt,
          route: `/dashboard/jobs/${job.id}`,
          version: `approval:${job.id}:${status}:${updatedAt}`,
        });
      });

      nextItems.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setItems(nextItems);
      setError(null);
    } catch (err) {
      console.error('Unable to load admin attention queue:', err);
      setError(err instanceof Error ? err.message : 'Unable to load attention items');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchItems();
    const channel = supabase
      .channel('admin-attention-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => void fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_tokens' }, () => void fetchItems())
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, [enabled, fetchItems]);

  const acknowledge = useCallback((item: AdminAttentionItem) => {
    if (!userId) return;
    setSeenVersions(previous => {
      const next = { ...previous, [item.id]: item.version };
      window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
      return next;
    });
  }, [userId]);

  const activeItems = useMemo(
    () => items.filter(item => seenVersions[item.id] !== item.version),
    [items, seenVersions]
  );

  return { items, activeItems, loading, error, acknowledge, refetch: fetchItems };
}
