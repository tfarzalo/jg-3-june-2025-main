import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { debounce } from '../lib/utils/debounce';
import { formatJobPhaseLabel } from '../lib/jobPhaseLabels';
import { formatCurrency } from '../lib/utils/formatUtils';
import { getMiscAdditionalCostAmounts } from '../lib/miscAdditionalCosts';

export type JobActivityCategory =
  | 'phase'
  | 'email'
  | 'approval'
  | 'note'
  | 'work_order'
  | 'file'
  | 'edit'
  | 'system';

export interface JobActivityLogItem {
  id: string;
  source: string;
  category: JobActivityCategory;
  title: string;
  description: string;
  actorName: string;
  actorEmail?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface JobActivityWorkOrderSnapshot {
  id?: string | null;
  submission_date?: string | null;
  created_at?: string | null;
  submitted_by_name?: string | null;
  misc_additional_cost_items?: Array<{
    id?: string;
    description?: string;
    price?: number | string | null;
    subPay?: number | string | null;
  }> | null;
}

interface UseJobActivityLogOptions {
  jobId?: string;
  workOrder?: JobActivityWorkOrderSnapshot | null;
  includeInternalNotes?: boolean;
  includePainterNotes?: boolean;
}

type ProfileMap = Record<string, { full_name?: string | null; email?: string | null }>;

interface PhaseChangeRow {
  id: string;
  changed_by?: string | null;
  changed_by_name?: string | null;
  changed_by_email?: string | null;
  from_phase_label?: string | null;
  to_phase_label: string;
  change_reason?: string | null;
  changed_at: string;
}

interface ActivityLogRow {
  id: string;
  entity_type: string;
  action: string;
  description: string;
  changed_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface ApprovalTokenRow {
  id: string;
  approval_type?: string | null;
  approver_email?: string | null;
  approver_name?: string | null;
  extra_charges_data?: {
    total?: number | string | null;
    billing_total?: number | string | null;
  } | null;
  created_at: string;
  expires_at?: string | null;
  decision?: string | null;
  decision_at?: string | null;
  decline_reason?: string | null;
}

interface NoteRow {
  id: string;
  topic: string;
  note_content?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface FileRow {
  id: string;
  name?: string | null;
  category?: string | null;
  type?: string | null;
  uploaded_by?: string | null;
  created_at: string;
}

const UNKNOWN_ACTOR = 'Unknown';

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function actorFromProfile(id: string | null | undefined, profiles: ProfileMap) {
  if (!id) return { actorName: 'System', actorEmail: null };
  const profile = profiles[id];
  return {
    actorName: profile?.full_name || profile?.email || UNKNOWN_ACTOR,
    actorEmail: profile?.email || null,
  };
}

function approvalDecisionActorFromChange(
  change: PhaseChangeRow,
  approvalTokens: ApprovalTokenRow[]
) {
  const reason = (change.change_reason || '').toLowerCase();
  const decision = reason.includes('extra charges approved')
    ? 'approved'
    : reason.includes('extra charges declined') || reason.includes('extra charges rejected')
      ? 'declined'
      : null;

  if (!decision) return null;

  const changeTime = new Date(change.changed_at).getTime();
  const matchingToken = approvalTokens.find((token) => {
    if (token.decision !== decision || !token.decision_at) return false;
    const decisionTime = new Date(token.decision_at).getTime();
    return Number.isFinite(decisionTime) && Math.abs(decisionTime - changeTime) <= 5000;
  });

  if (matchingToken?.approver_name || matchingToken?.approver_email) {
    return {
      actorName: matchingToken.approver_name || matchingToken.approver_email || UNKNOWN_ACTOR,
      actorEmail: matchingToken.approver_email || null,
    };
  }

  const parsedName = change.change_reason?.match(/extra charges (?:approved|declined|rejected)(?: manually)? by ([^.;-]+)/i)?.[1]?.trim();
  if (parsedName) {
    return {
      actorName: parsedName,
      actorEmail: null,
    };
  }

  return null;
}

function getActivityCategory(eventType?: string, action?: string): JobActivityCategory {
  const normalized = `${eventType || ''} ${action || ''}`.toLowerCase();
  if (normalized.includes('email')) return 'email';
  if (normalized.includes('approval') || normalized.includes('approved') || normalized.includes('declined') || normalized.includes('rejected')) return 'approval';
  if (normalized.includes('note')) return 'note';
  if (normalized.includes('work_order') || normalized.includes('work order')) return 'work_order';
  if (normalized.includes('file') || normalized.includes('image') || normalized.includes('upload')) return 'file';
  if (normalized.includes('phase')) return 'phase';
  if (normalized.includes('edit') || normalized.includes('update') || normalized.includes('assigned')) return 'edit';
  return 'system';
}

function notePreview(note: string | null | undefined) {
  const trimmed = (note || '').trim();
  if (!trimmed) return '';
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

function normalizeFileCategory(category: string | null | undefined, name: string | null | undefined) {
  const value = (category || '').toLowerCase();
  if (name?.includes('_sprinkler_form_') || value.includes('sprinkler_form')) return 'Sprinkler Form Photo';
  if (value.includes('sprinkler')) return 'Sprinkler Photo';
  if (value.includes('before')) return 'Before Photo';
  if (value.includes('after')) return 'After Photo';
  if (value.includes('other')) return 'Other File';
  return 'File';
}

export function useJobActivityLog({
  jobId,
  workOrder,
  includeInternalNotes = false,
  includePainterNotes = false,
}: UseJobActivityLogOptions) {
  const [activityItems, setActivityItems] = useState<JobActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const workOrderId = workOrder?.id || null;

  const fetchActivityLog = useCallback(async () => {
    if (!jobId) {
      setActivityItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        supabase.rpc('get_job_phase_changes', { input_job_id: jobId }),
        supabase
          .from('activity_log')
          .select('id, entity_type, entity_id, action, description, changed_by, metadata, created_at')
          .eq('entity_type', 'job')
          .eq('entity_id', jobId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('activity_log')
          .select('id, entity_type, entity_id, action, description, changed_by, metadata, created_at')
          .contains('metadata', { job_id: jobId })
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('approval_tokens')
          .select('id, approval_type, approver_email, approver_name, extra_charges_data, created_at, expires_at, used_at, decision, decision_at, decline_reason')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(50),
        includeInternalNotes
          ? supabase
              .from('job_notes')
              .select('id, topic, note_content, created_by, created_at, updated_at')
              .eq('job_id', jobId)
              .order('created_at', { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
        includePainterNotes
          ? supabase
              .from('job_painter_notes')
              .select('id, topic, note_content, created_by, created_at, updated_at')
              .eq('job_id', jobId)
              .order('created_at', { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('files')
          .select('id, name, category, type, uploaded_by, created_at, job_id, work_order_id')
          .or(workOrderId ? `job_id.eq.${jobId},work_order_id.eq.${workOrderId}` : `job_id.eq.${jobId}`)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const readResult = <T,>(index: number): T[] => {
        const result = results[index];
        if (result.status === 'rejected') {
          console.warn('Job activity source failed:', result.reason);
          return [];
        }
        const value = result.value as { data?: T[] | null; error?: unknown };
        if (value.error) {
          console.warn('Job activity source failed:', value.error);
          return [];
        }
        return value.data || [];
      };

      const phaseChanges = readResult<PhaseChangeRow>(0);
      const directActivity = readResult<ActivityLogRow>(1);
      const metadataActivity = readResult<ActivityLogRow>(2);
      const approvalTokens = readResult<ApprovalTokenRow>(3);
      const jobNotes = readResult<NoteRow>(4);
      const painterNotes = readResult<NoteRow>(5);
      const files = readResult<FileRow>(6);

      const allUserIds = uniqueIds([
        ...phaseChanges.map((item) => item.changed_by),
        ...directActivity.map((item) => item.changed_by),
        ...metadataActivity.map((item) => item.changed_by),
        ...jobNotes.map((item) => item.created_by),
        ...painterNotes.map((item) => item.created_by),
        ...files.map((item) => item.uploaded_by),
      ]);

      let profiles: ProfileMap = {};
      if (allUserIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', allUserIds);

        if (!profileError && profileData) {
          profiles = profileData.reduce((acc, profile: { id: string; full_name?: string | null; email?: string | null }) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as ProfileMap);
        }
      }

      const items: JobActivityLogItem[] = [];

      phaseChanges.forEach((change) => {
        const actor = actorFromProfile(change.changed_by, profiles);
        const approvalActor = approvalDecisionActorFromChange(change, approvalTokens);
        const fromPhase = change.from_phase_label ? formatJobPhaseLabel(change.from_phase_label) : 'None';
        const toPhase = formatJobPhaseLabel(change.to_phase_label);
        items.push({
          id: `phase-${change.id}`,
          source: 'job_phase_changes',
          category: 'phase',
          title: `Phase changed to ${toPhase}`,
          description: change.change_reason || `Moved from ${fromPhase} to ${toPhase}`,
          actorName: approvalActor?.actorName || change.changed_by_name || actor.actorName,
          actorEmail: approvalActor?.actorEmail || change.changed_by_email || actor.actorEmail,
          timestamp: change.changed_at,
          metadata: {
            from_phase: fromPhase,
            to_phase: toPhase,
          },
        });
      });

      const seenActivityIds = new Set<string>();
      [...directActivity, ...metadataActivity].forEach((activity) => {
        if (seenActivityIds.has(activity.id)) return;
        seenActivityIds.add(activity.id);
        if (activity.entity_type === 'job_phase_change') return;

        const metadata = (activity.metadata || {}) as Record<string, unknown>;
        const eventType = typeof metadata.event_type === 'string' ? metadata.event_type : activity.action;
        const title = typeof metadata.title === 'string' ? metadata.title : activity.description;
        const actor = actorFromProfile(activity.changed_by, profiles);
        items.push({
          id: `activity-${activity.id}`,
          source: 'activity_log',
          category: getActivityCategory(eventType, activity.action),
          title,
          description: activity.description,
          actorName: actor.actorName,
          actorEmail: actor.actorEmail,
          timestamp: activity.created_at,
          metadata,
        });
      });

      approvalTokens.forEach((token) => {
        const approvalAmount = Number(token.extra_charges_data?.total ?? token.extra_charges_data?.billing_total ?? 0);
        const amountText = approvalAmount > 0 ? ` for ${formatCurrency(approvalAmount)}` : '';
        const recipient = token.approver_name || token.approver_email || 'approval recipient';
        const isPreviewToken = token.approval_type === 'extra_charges_preview';

        items.push({
          id: `approval-request-${token.id}`,
          source: 'approval_tokens',
          category: 'email',
          title: isPreviewToken ? 'Extra charge approval preview opened' : 'Extra charge approval link created',
          description: isPreviewToken
            ? `Preview approval link created for ${recipient}${amountText}`
            : `Approval link created for ${recipient}${amountText}`,
          actorName: 'System',
          actorEmail: token.approver_email,
          timestamp: token.created_at,
          metadata: {
            approval_type: token.approval_type,
            approver_email: token.approver_email,
            expires_at: token.expires_at,
          },
        });

        if (token.decision && token.decision_at) {
          const approved = token.decision === 'approved';
          items.push({
            id: `approval-decision-${token.id}`,
            source: 'approval_tokens',
            category: 'approval',
            title: approved ? 'Extra charges approved' : 'Extra charges declined',
            description: approved
              ? `Approved by ${recipient}${amountText}`
              : `Declined by ${recipient}${token.decline_reason ? `: ${token.decline_reason}` : ''}`,
            actorName: recipient,
            actorEmail: token.approver_email,
            timestamp: token.decision_at,
            metadata: {
              approval_type: token.approval_type,
              decision: token.decision,
              decline_reason: token.decline_reason,
            },
          });
        }
      });

      jobNotes.forEach((note) => {
        const actor = actorFromProfile(note.created_by, profiles);
        items.push({
          id: `job-note-${note.id}`,
          source: 'job_notes',
          category: 'note',
          title: `Job note added: ${note.topic}`,
          description: notePreview(note.note_content),
          actorName: actor.actorName,
          actorEmail: actor.actorEmail,
          timestamp: note.created_at,
        });

        if (note.updated_at && note.updated_at !== note.created_at) {
          items.push({
            id: `job-note-updated-${note.id}`,
            source: 'job_notes',
            category: 'note',
            title: `Job note updated: ${note.topic}`,
            description: notePreview(note.note_content),
            actorName: actor.actorName,
            actorEmail: actor.actorEmail,
            timestamp: note.updated_at,
          });
        }
      });

      painterNotes.forEach((note) => {
        const actor = actorFromProfile(note.created_by, profiles);
        items.push({
          id: `painter-note-${note.id}`,
          source: 'job_painter_notes',
          category: 'note',
          title: `Painter note added: ${note.topic}`,
          description: notePreview(note.note_content),
          actorName: actor.actorName,
          actorEmail: actor.actorEmail,
          timestamp: note.created_at,
        });
      });

      files.forEach((file) => {
        const actor = actorFromProfile(file.uploaded_by, profiles);
        const fileCategory = normalizeFileCategory(file.category, file.name);
        items.push({
          id: `file-${file.id}`,
          source: 'files',
          category: 'file',
          title: `${fileCategory} uploaded`,
          description: file.name || 'File uploaded',
          actorName: actor.actorName,
          actorEmail: actor.actorEmail,
          timestamp: file.created_at,
          metadata: {
            category: file.category,
            type: file.type,
          },
        });
      });

      if (workOrder?.id && (workOrder.submission_date || workOrder.created_at)) {
        items.push({
          id: `work-order-${workOrder.id}`,
          source: 'work_order_snapshot',
          category: 'work_order',
          title: 'Work order submitted',
          description: 'Subcontractor work order details were submitted for this job',
          actorName: workOrder.submitted_by_name || 'Unknown',
          timestamp: workOrder.submission_date || workOrder.created_at || new Date().toISOString(),
        });
      }

      const miscItems = workOrder?.misc_additional_cost_items || [];
      miscItems.forEach((item) => {
        const { billAmount: price, subPayAmount } = getMiscAdditionalCostAmounts(item);
        const subPay = subPayAmount ?? 0;
        if (!item.description && price <= 0 && subPay <= 0) return;
        items.push({
          id: `misc-current-${item.id || item.description || price || subPay}`,
          source: 'work_order_snapshot',
          category: 'work_order',
          title: 'Miscellaneous additional cost item on work order',
          description: `${item.description || 'No description'}${price > 0 ? ` • Bill ${formatCurrency(price)}` : ''}${subPay > 0 ? ` • Sub pay ${formatCurrency(subPay)}` : ''}`,
          actorName: 'Current work order',
          timestamp: workOrder?.submission_date || workOrder?.created_at || new Date().toISOString(),
        });
      });

      const sortedItems = items
        .filter((item) => item.timestamp)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (isMountedRef.current) {
        setActivityItems(sortedItems);
      }
    } catch (error) {
      console.error('Error fetching job activity log:', error);
      if (isMountedRef.current) {
        setError(error instanceof Error ? error.message : 'Failed to load job activity log');
        setActivityItems([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [includeInternalNotes, includePainterNotes, jobId, workOrder, workOrderId]);

  const debouncedFetchActivityLog = useMemo(
    () => debounce(fetchActivityLog, 1000),
    [fetchActivityLog]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchActivityLog();

    if (!jobId) return undefined;

    const channel = supabase
      .channel(`job-${jobId}-activity-log`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_phase_changes', filter: `job_id=eq.${jobId}` }, debouncedFetchActivityLog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, debouncedFetchActivityLog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_tokens', filter: `job_id=eq.${jobId}` }, debouncedFetchActivityLog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_notes', filter: `job_id=eq.${jobId}` }, debouncedFetchActivityLog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_painter_notes', filter: `job_id=eq.${jobId}` }, debouncedFetchActivityLog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, debouncedFetchActivityLog)
      .subscribe();

    return () => {
      isMountedRef.current = false;
      channel.unsubscribe();
    };
  }, [debouncedFetchActivityLog, fetchActivityLog, jobId]);

  return {
    activityItems,
    loading,
    error,
    refetch: fetchActivityLog,
  };
}
