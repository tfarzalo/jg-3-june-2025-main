import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '../utils/supabase';
import { fetchActiveSubcontractors } from '../lib/users/activeSubcontractors';

export const OPERATIONS_PHASES = [
  { label: 'New Job Request', phase: 'Job Request', route: '/dashboard/jobs/requests' },
  { label: 'Work Orders', phase: 'Work Order', route: '/dashboard/jobs/work-orders' },
  { label: 'Pending Work Orders', phase: 'Pending Work Order', route: '/dashboard/jobs/pending-work-orders' },
  { label: 'Completed Work Orders', phase: 'Completed Work Orders', route: '/dashboard/jobs/completed-work-orders' },
  { label: 'Quality Control', phase: 'Quality Control', route: '/dashboard/jobs/quality-control' },
] as const;

export type OperationsPhase = typeof OPERATIONS_PHASES[number]['phase'];
export type PulsePeriod = 'today' | 'yesterday' | '7d' | '30d';
export type PulseConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface PulseEvent {
  id: string;
  jobId: string;
  phase: OperationsPhase;
  direction: 'entered' | 'left';
  activityType: 'job_created' | 'phase_change' | 'work_order_submitted' | 'pending_outcome';
  outcome?: 'approved' | 'declined' | 'skipped';
  timestamp: string;
  workOrderNumber: number | null;
  unitNumber: string | null;
  propertyName: string;
  assignedWorker: string;
  actorName: string;
  reason: string | null;
}

interface SelectOption {
  id: string;
  label: string;
}

interface PhasePulseData {
  total: number;
  remaining: number;
  entered: number;
  left: number;
  approved: number;
  declined: number;
  skipped: number;
  events: PulseEvent[];
  accentKey: number;
}

type PulseDataMap = Record<OperationsPhase, PhasePulseData>;

const APP_TIME_ZONE = 'America/New_York';
const phaseNames = OPERATIONS_PHASES.map((item) => item.phase);

const emptyPulseData = (): PulseDataMap => Object.fromEntries(
  phaseNames.map((phase) => [phase, { total: 0, remaining: 0, entered: 0, left: 0, approved: 0, declined: 0, skipped: 0, events: [], accentKey: 0 }]),
) as PulseDataMap;

function getPeriodBounds(period: PulsePeriod) {
  const now = new Date();
  if (period === 'today' || period === 'yesterday') {
    const selectedDay = period === 'yesterday' ? subDays(now, 1) : now;
    return {
      start: formatInTimeZone(selectedDay, APP_TIME_ZONE, "yyyy-MM-dd'T'07:00:00XXX"),
      end: formatInTimeZone(selectedDay, APP_TIME_ZONE, "yyyy-MM-dd'T'18:00:00XXX"),
    };
  }
  const dayOffset = period === '7d' ? 6 : 29;
  const start = formatInTimeZone(
    subDays(now, dayOffset),
    APP_TIME_ZONE,
    "yyyy-MM-dd'T'00:00:00XXX",
  );
  return { start, end: now.toISOString() };
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function useLiveOperationsPulse() {
  const [period, setPeriod] = useState<PulsePeriod>('today');
  const [propertyId, setPropertyId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [properties, setProperties] = useState<SelectOption[]>([]);
  const [workers, setWorkers] = useState<SelectOption[]>([]);
  const [phaseColors, setPhaseColors] = useState<Record<string, string>>({});
  const [data, setData] = useState<PulseDataMap>(emptyPulseData);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<PulseConnectionStatus>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const phaseIdByNameRef = useRef<Record<string, string>>({});
  const seenEventIdsRef = useRef(new Set<string>());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedOnceRef = useRef(false);

  const loadWorkerOptions = useCallback(async () => {
    const workersResult = await fetchActiveSubcontractors<{ id: string; full_name: string | null }>('id, full_name');
    if (workersResult.error) throw workersResult.error;
    if (!mountedRef.current) return;

    setWorkers((workersResult.data || []).map((worker) => ({
      id: worker.id,
      label: worker.full_name || 'Unnamed worker',
    })));
  }, []);

  const refresh = useCallback(async (options?: { silent?: boolean; accentPhase?: string }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);

      const phasesResult = await supabase
        .from('job_phases')
        .select('id, job_phase_label, color_dark_mode')
        .in('job_phase_label', phaseNames);
      if (phasesResult.error) throw phasesResult.error;

      const phaseRows = phasesResult.data || [];
      const phaseIdByName = Object.fromEntries(phaseRows.map((phase) => [phase.job_phase_label, phase.id]));
      const phaseNameById = Object.fromEntries(phaseRows.map((phase) => [phase.id, phase.job_phase_label]));
      phaseIdByNameRef.current = phaseIdByName;

      const periodBounds = getPeriodBounds(period);
      const [changesResult, workOrdersResult, approvalsResult] = await Promise.all([
        supabase
          .from('job_phase_changes')
          .select('id, job_id, changed_by, from_phase_id, to_phase_id, change_reason, changed_at')
          .gte('changed_at', periodBounds.start)
          .lt('changed_at', periodBounds.end)
          .or(`from_phase_id.in.(${phaseRows.map((phase) => phase.id).join(',')}),to_phase_id.in.(${phaseRows.map((phase) => phase.id).join(',')})`)
          .order('changed_at', { ascending: false })
          .range(0, 9999),
        supabase
          .from('work_orders')
          .select('id, job_id, prepared_by, submission_date')
          .gte('submission_date', periodBounds.start)
          .lt('submission_date', periodBounds.end)
          .order('submission_date', { ascending: false })
          .range(0, 9999),
        supabase
          .from('approval_tokens')
          .select('id, job_id, decision, decision_at, decision_maker_name, approver_name, decline_reason')
          .in('decision', ['approved', 'declined'])
          .gte('decision_at', periodBounds.start)
          .lt('decision_at', periodBounds.end)
          .order('decision_at', { ascending: false })
          .range(0, 9999),
      ]);
      const { data: changeRows, error: changesError } = changesResult;
      const { data: workOrderRows, error: workOrdersError } = workOrdersResult;
      const { data: approvalRows, error: approvalsError } = approvalsResult;
      if (changesError) throw changesError;
      if (workOrdersError) throw workOrdersError;
      if (approvalsError) throw approvalsError;

      const activityJobIds = [...new Set([
        ...(changeRows || []).map((row) => row.job_id),
        ...(workOrderRows || []).map((row) => row.job_id),
        ...(approvalRows || []).map((row) => row.job_id),
      ].filter(Boolean))];

      const [activityJobsResult, createdJobsResult] = await Promise.all([
        activityJobIds.length
          ? supabase.from('jobs').select('property_id').in('id', activityJobIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('jobs')
          .select('id, property_id, created_at, created_by')
          .gte('created_at', periodBounds.start)
          .lt('created_at', periodBounds.end)
          .order('created_at', { ascending: false })
          .range(0, 9999),
      ]);
      if (activityJobsResult.error) throw activityJobsResult.error;
      if (createdJobsResult.error) throw createdJobsResult.error;

      const activePropertyIds = [...new Set([
        ...(activityJobsResult.data || []).map((job) => job.property_id),
        ...(createdJobsResult.data || []).map((job) => job.property_id),
      ].filter(Boolean))];
      const propertiesResult = activePropertyIds.length
        ? await supabase
          .from('properties')
          .select('id, property_name')
          .in('id', activePropertyIds)
          .eq('is_active', true)
          .eq('is_archived', false)
          .order('property_name')
        : { data: [], error: null };
      if (propertiesResult.error) throw propertiesResult.error;
      if (!mountedRef.current) return;

      const nextProperties = (propertiesResult.data || []).map((property) => ({
        id: property.id,
        label: property.property_name || 'Unnamed property',
      }));
      setProperties(nextProperties);
      if (propertyId && !nextProperties.some((property) => property.id === propertyId)) {
        setPropertyId('');
      }

      const jobIds = [...new Set([
        ...activityJobIds,
        ...(createdJobsResult.data || []).map((job) => job.id),
      ])];

      const actorIds = [...new Set([
        ...(changeRows || []).map((row) => row.changed_by),
        ...(workOrderRows || []).map((row) => row.prepared_by),
        ...(createdJobsResult.data || []).map((row) => row.created_by),
      ].filter(Boolean))];

      let jobsQuery = supabase
        .from('jobs')
        .select('id, work_order_num, unit_number, property_id, assigned_to, current_phase_id, property:properties(property_name), worker:profiles(full_name)')
        .in('id', jobIds.length ? jobIds : ['00000000-0000-0000-0000-000000000000']);
      if (propertyId) jobsQuery = jobsQuery.eq('property_id', propertyId);
      if (workerId) jobsQuery = jobsQuery.eq('assigned_to', workerId);

      const [jobsResult, actorsResult] = await Promise.all([
        jobsQuery,
        actorIds.length
          ? supabase.from('profiles').select('id, full_name').in('id', actorIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (jobsResult.error) throw jobsResult.error;
      if (actorsResult.error) throw actorsResult.error;

      const jobsById = new Map((jobsResult.data || []).map((job) => [job.id, job]));
      const actorsById = new Map((actorsResult.data || []).map((actor) => [actor.id, actor.full_name || 'Unknown user']));
      const next = emptyPulseData();

      const createdCohort = (createdJobsResult.data || []).filter((row) => jobsById.has(row.id));
      const workOrderCohort = (workOrderRows || []).filter((row) => jobsById.has(row.job_id));
      const pendingJobIds = new Set((changeRows || [])
        .filter((row) => phaseNameById[row.to_phase_id] === 'Pending Work Order' && jobsById.has(row.job_id))
        .map((row) => row.job_id));
      const completedJobIds = new Set((changeRows || [])
        .filter((row) => phaseNameById[row.to_phase_id] === 'Completed Work Orders' && jobsById.has(row.job_id))
        .map((row) => row.job_id));
      const workOrderJobIds = new Set(workOrderCohort.map((row) => row.job_id));
      const createdJobIds = new Set(createdCohort.map((row) => row.id));

      next['Job Request'].total = createdJobIds.size;
      next['Job Request'].entered = createdJobIds.size;
      next['Work Order'].total = workOrderCohort.length;
      next['Work Order'].entered = workOrderCohort.length;
      next['Pending Work Order'].total = pendingJobIds.size;
      next['Pending Work Order'].entered = pendingJobIds.size;
      next['Completed Work Orders'].total = completedJobIds.size;
      next['Completed Work Orders'].entered = completedJobIds.size;

      const isStillInPhase = (jobId: string, phase: OperationsPhase) => (
        jobsById.get(jobId)?.current_phase_id === phaseIdByName[phase]
      );
      next['Job Request'].remaining = [...createdJobIds].filter((jobId) => isStillInPhase(jobId, 'Job Request')).length;
      next['Work Order'].remaining = [...workOrderJobIds].filter((jobId) => isStillInPhase(jobId, 'Work Order')).length;
      next['Completed Work Orders'].remaining = [...completedJobIds].filter((jobId) => isStillInPhase(jobId, 'Completed Work Orders')).length;

      createdCohort.forEach((row) => {
        const job = jobsById.get(row.id);
        if (!job || next['Job Request'].events.length >= 5) return;
        const property = normalizeRelation(job.property as any) as { property_name?: string } | null;
        const worker = normalizeRelation(job.worker as any) as { full_name?: string } | null;
        next['Job Request'].events.push({
          id: `created-${row.id}`,
          jobId: row.id,
          phase: 'Job Request',
          direction: 'entered',
          activityType: 'job_created',
          timestamp: row.created_at,
          workOrderNumber: job.work_order_num ?? null,
          unitNumber: job.unit_number ?? null,
          propertyName: property?.property_name || 'Unknown property',
          assignedWorker: worker?.full_name || 'Unassigned',
          actorName: actorsById.get(row.created_by) || 'System',
          reason: null,
        });
      });

      (changeRows || []).forEach((row) => {
        const job = jobsById.get(row.job_id);
        if (!job) return;
        const fromPhase = phaseNameById[row.from_phase_id] as OperationsPhase | undefined;
        const toPhase = phaseNameById[row.to_phase_id] as OperationsPhase | undefined;
        const property = normalizeRelation(job.property as any) as { property_name?: string } | null;
        const worker = normalizeRelation(job.worker as any) as { full_name?: string } | null;
        const base = {
          id: row.id,
          jobId: row.job_id,
          timestamp: row.changed_at,
          workOrderNumber: job.work_order_num ?? null,
          unitNumber: job.unit_number ?? null,
          propertyName: property?.property_name || 'Unknown property',
          assignedWorker: worker?.full_name || 'Unassigned',
          actorName: actorsById.get(row.changed_by) || 'System',
          reason: row.change_reason,
          activityType: 'phase_change' as const,
        };

        if (toPhase && toPhase !== 'Job Request' && toPhase !== 'Work Order' && toPhase !== 'Pending Work Order' && next[toPhase]) {
          if (next[toPhase].events.length < 5) next[toPhase].events.push({ ...base, phase: toPhase, direction: 'entered' });
        }
        if (fromPhase && fromPhase !== 'Work Order' && fromPhase !== 'Pending Work Order' && next[fromPhase] && fromPhase !== toPhase) {
          next[fromPhase].left += 1;
          if (next[fromPhase].events.length < 5) next[fromPhase].events.push({ ...base, phase: fromPhase, direction: 'left' });
        }
      });

      const pendingEvents: PulseEvent[] = (changeRows || []).flatMap((row) => {
        if (phaseNameById[row.to_phase_id] !== 'Pending Work Order') return [];
        const job = jobsById.get(row.job_id);
        if (!job) return [];
        const property = normalizeRelation(job.property as any) as { property_name?: string } | null;
        const worker = normalizeRelation(job.worker as any) as { full_name?: string } | null;
        return [{
          id: row.id,
          jobId: row.job_id,
          phase: 'Pending Work Order' as const,
          direction: 'entered' as const,
          activityType: 'phase_change' as const,
          timestamp: row.changed_at,
          workOrderNumber: job.work_order_num ?? null,
          unitNumber: job.unit_number ?? null,
          propertyName: property?.property_name || 'Unknown property',
          assignedWorker: worker?.full_name || 'Unassigned',
          actorName: actorsById.get(row.changed_by) || 'System',
          reason: row.change_reason,
        }];
      });
      (approvalRows || []).forEach((row) => {
        const job = jobsById.get(row.job_id);
        if (!job || !row.decision_at || (row.decision !== 'approved' && row.decision !== 'declined')) return;
        const outcome = row.decision as 'approved' | 'declined';
        const property = normalizeRelation(job.property as any) as { property_name?: string } | null;
        const worker = normalizeRelation(job.worker as any) as { full_name?: string } | null;
        next['Pending Work Order'][outcome] += 1;
        pendingEvents.push({
          id: row.id,
          jobId: row.job_id,
          phase: 'Pending Work Order',
          direction: outcome === 'approved' ? 'entered' : 'left',
          activityType: 'pending_outcome',
          outcome,
          timestamp: row.decision_at,
          workOrderNumber: job.work_order_num ?? null,
          unitNumber: job.unit_number ?? null,
          propertyName: property?.property_name || 'Unknown property',
          assignedWorker: worker?.full_name || 'Unassigned',
          actorName: row.decision_maker_name || row.approver_name || 'Unknown user',
          reason: row.decline_reason || null,
        });
      });

      (changeRows || []).forEach((row) => {
        const job = jobsById.get(row.job_id);
        const fromPhase = phaseNameById[row.from_phase_id] as OperationsPhase | undefined;
        const toPhase = phaseNameById[row.to_phase_id] as OperationsPhase | undefined;
        const isDecisionChange = /extra charges.*(?:approv|declin|reject)/i.test(row.change_reason || '');
        if (!job || fromPhase !== 'Pending Work Order' || fromPhase === toPhase || isDecisionChange) return;
        const property = normalizeRelation(job.property as any) as { property_name?: string } | null;
        const worker = normalizeRelation(job.worker as any) as { full_name?: string } | null;
        next['Pending Work Order'].skipped += 1;
        pendingEvents.push({
          id: row.id,
          jobId: row.job_id,
          phase: 'Pending Work Order',
          direction: 'left',
          activityType: 'pending_outcome',
          outcome: 'skipped',
          timestamp: row.changed_at,
          workOrderNumber: job.work_order_num ?? null,
          unitNumber: job.unit_number ?? null,
          propertyName: property?.property_name || 'Unknown property',
          assignedWorker: worker?.full_name || 'Unassigned',
          actorName: actorsById.get(row.changed_by) || 'System',
          reason: row.change_reason,
        });
      });
      next['Pending Work Order'].events = pendingEvents
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
        .slice(0, 5);

      (workOrderRows || []).forEach((row) => {
        const job = jobsById.get(row.job_id);
        if (!job) return;
        const property = normalizeRelation(job.property as any) as { property_name?: string } | null;
        const worker = normalizeRelation(job.worker as any) as { full_name?: string } | null;
        if (next['Work Order'].events.length < 5) {
          next['Work Order'].events.push({
            id: row.id,
            jobId: row.job_id,
            phase: 'Work Order',
            direction: 'entered',
            activityType: 'work_order_submitted',
            timestamp: row.submission_date,
            workOrderNumber: job.work_order_num ?? null,
            unitNumber: job.unit_number ?? null,
            propertyName: property?.property_name || 'Unknown property',
            assignedWorker: worker?.full_name || 'Unassigned',
            actorName: actorsById.get(row.prepared_by) || 'System',
            reason: null,
          });
        }
      });

      if (!mountedRef.current) return;
      setPhaseColors(Object.fromEntries(phaseRows.map((phase) => [phase.job_phase_label, phase.color_dark_mode])));
      setData((current) => {
        phaseNames.forEach((phase) => {
          next[phase].accentKey = options?.accentPhase === phase
            ? current[phase].accentKey + 1
            : current[phase].accentKey;
        });
        return next;
      });
      seenEventIdsRef.current = new Set((changeRows || []).map((row) => row.id));
      setLastSyncedAt(new Date());
    } catch (refreshError) {
      console.error('Unable to refresh Live Operations Pulse:', refreshError);
      if (mountedRef.current) setError(refreshError instanceof Error ? refreshError.message : 'Unable to load live operations data');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [period, propertyId, workerId]);

  const scheduleRefresh = useCallback((accentPhase?: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void refresh({ silent: true, accentPhase });
    }, 150);
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    void loadWorkerOptions().catch((filterError) => {
      console.error('Unable to load pulse filters:', filterError);
    });
    return () => { mountedRef.current = false; };
  }, [loadWorkerOptions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const updateOnlineStatus = () => {
      if (!navigator.onLine) setConnectionStatus('offline');
      else {
        setConnectionStatus(connectedOnceRef.current ? 'reconnecting' : 'connecting');
        scheduleRefresh();
      }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const channel = supabase
      .channel('live-operations-pulse')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_phase_changes' }, (payload) => {
        const row = payload.new as { id?: string; from_phase_id?: string; to_phase_id?: string };
        if (row.id && seenEventIdsRef.current.has(row.id)) return;
        if (row.id) seenEventIdsRef.current.add(row.id);
        const phaseById = Object.fromEntries(Object.entries(phaseIdByNameRef.current).map(([name, id]) => [id, name]));
        scheduleRefresh(phaseById[row.to_phase_id || ''] || phaseById[row.from_phase_id || '']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => scheduleRefresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_orders' }, () => scheduleRefresh('Work Order'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'approval_tokens' }, () => scheduleRefresh('Pending Work Order'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: 'entity_type=eq.work_order' }, (payload) => {
        const row = payload.new as { action?: string };
        if (row.action === 'created') scheduleRefresh('Work Order');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_phases' }, () => scheduleRefresh())
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('live');
          if (connectedOnceRef.current) scheduleRefresh();
          connectedOnceRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus(navigator.onLine ? 'reconnecting' : 'offline');
        } else if (status === 'CLOSED') {
          setConnectionStatus(navigator.onLine ? 'reconnecting' : 'offline');
        }
      });

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  const periodLabel = useMemo(() => (
    period === 'today' ? 'today' : period === 'yesterday' ? 'yesterday' : period === '7d' ? 'last 7 days' : 'last 30 days'
  ), [period]);

  return {
    data,
    phaseColors,
    loading,
    error,
    connectionStatus,
    lastSyncedAt,
    period,
    setPeriod,
    periodLabel,
    propertyId,
    setPropertyId,
    workerId,
    setWorkerId,
    properties,
    workers,
  };
}
