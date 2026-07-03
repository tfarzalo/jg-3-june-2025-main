import { type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDays,
  addMonths,
  differenceInMilliseconds,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Clock,
  ExternalLink,
  Filter,
  GripVertical,
  Mail,
  CalendarPlus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../../utils/supabase';
import { listCalendarEvents } from '../../services/calendarEvents';
import type { CalendarEvent } from '../../types/calendar';
import { getRecurringEventsForDay } from '../../utils/recurringEvents';
import { formatDisplayDate } from '../../lib/dateUtils';
import { dispatchSmsNotification } from '../../lib/sms/dispatchSmsNotification';
import { useUserRole } from '../../contexts/UserRoleContext';
import EventModal from '../calendar/EventModal';

const TZ = 'America/New_York';
const VISIBILITY_KEY = 'jg-dev-calendar-3-visibility';
const VIEW_MODE_KEY = 'jg-dev-calendar-3-view-mode';
const VIEW_MODE_PREF_KEY = 'jg-calendar-view-mode-preference';
const LOCAL_ORDER_KEY = 'jg-dev-calendar-3-local-order';
const ASSIGNMENT_DECISION_URL = 'https://portal.jgpaintingprosinc.com/assignment/decision';
const SUBCONTRACTOR_DASHBOARD_URL = 'https://portal.jgpaintingprosinc.com/dashboard/subcontractor';

type SourceType = 'job' | 'event';
type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';
const CALENDAR_VIEW_MODES: CalendarViewMode[] = ['month', 'week', 'day', 'agenda'];

interface JobPhase {
  id: string;
  job_phase_label: string;
  color_dark_mode: string;
  sort_order?: number | null;
}

interface CalendarJob {
  id: string;
  work_order_num: number;
  property_id: string;
  property_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  unit_number: string;
  unit_size_label: string | null;
  description: string | null;
  purchase_order: string | null;
  scheduled_date: string;
  job_phase: JobPhase;
  job_type_label: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_at: string | null;
  assignment_status: string | null;
  assignment_deadline: string | null;
  assignment_decision_at: string | null;
  declined_reason_code: string | null;
  declined_reason_text: string | null;
}

interface Subcontractor {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
}

interface CalendarItem {
  id: string;
  sourceId: string;
  type: SourceType;
  title: string;
  date: string;
  allDay: boolean;
  color: string;
  status?: string | null;
  customerName?: string | null;
  address?: string | null;
  assignedSubcontractor?: string | null;
  raw: CalendarJob | CalendarEvent;
}

interface VisibilityState {
  allJobs: boolean;
  allEvents: boolean;
  statuses: Record<string, boolean>;
}

interface ViewModePreference {
  viewMode: CalendarViewMode;
  updatedAt: number;
}

interface PendingNotification {
  subcontractor: Subcontractor;
  jobs: CalendarJob[];
}

interface AddChoice {
  date: string;
  open: boolean;
}

interface SubscriptionTarget {
  label: string;
  scope: 'events' | 'events_and_job_requests' | 'completed_jobs';
  description: string;
  limitation?: string;
}

function getEasternNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

function dateOnlyFromJob(value: string | null | undefined) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value.includes('T')) return value.split('T')[0];
  return value;
}

function dateOnlyFromDate(date: Date) {
  return formatInTimeZone(date, TZ, 'yyyy-MM-dd');
}

function eventStartDate(event: CalendarEvent) {
  return formatInTimeZone(parseISO(event.start_at), TZ, 'yyyy-MM-dd');
}

function parseDateOnly(date: string) {
  return new Date(`${date}T00:00:00`);
}

function webcalUrl(icsUrl: string) {
  return icsUrl.replace(/^https:\/\//, 'webcal://').replace(/^http:\/\//, 'webcal://');
}

function googleCalendarLink(icsUrl: string) {
  return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icsUrl)}`;
}

function formatWorkOrderNumber(num: number) {
  return `WO-${String(num).padStart(6, '0')}`;
}

function formatAddress(job: CalendarJob) {
  return [job.address, [job.city, job.state].filter(Boolean).join(', '), job.zip]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Visibility/order preferences are non-critical.
  }
}

function isCalendarViewMode(value: unknown): value is CalendarViewMode {
  return typeof value === 'string' && CALENDAR_VIEW_MODES.includes(value as CalendarViewMode);
}

function viewModePreferenceKey(userId?: string | null) {
  return userId ? `${VIEW_MODE_PREF_KEY}-${userId}` : VIEW_MODE_PREF_KEY;
}

function readViewModePreference(userId?: string | null): ViewModePreference | null {
  const saved = readJson<Partial<ViewModePreference> | string | null>(viewModePreferenceKey(userId), null);
  if (saved && typeof saved === 'object' && isCalendarViewMode(saved.viewMode)) {
    return {
      viewMode: saved.viewMode,
      updatedAt: Number(saved.updatedAt) || 0,
    };
  }

  const legacyKey = userId ? `${VIEW_MODE_KEY}-${userId}` : VIEW_MODE_KEY;
  const legacy = readJson<unknown>(legacyKey, null);
  return isCalendarViewMode(legacy) ? { viewMode: legacy, updatedAt: 0 } : null;
}

function latestViewModePreference(userId?: string | null) {
  const generic = readViewModePreference(null);
  const user = userId ? readViewModePreference(userId) : null;
  if (generic && user) return generic.updatedAt >= user.updatedAt ? generic : user;
  return user || generic;
}

function writeViewModePreference(viewMode: CalendarViewMode, userId?: string | null) {
  const preference: ViewModePreference = { viewMode, updatedAt: Date.now() };
  writeJson(VIEW_MODE_KEY, viewMode);
  writeJson(VIEW_MODE_PREF_KEY, preference);

  if (userId) {
    writeJson(`${VIEW_MODE_KEY}-${userId}`, viewMode);
    writeJson(viewModePreferenceKey(userId), preference);
  }
}

function defaultVisibility(phases: JobPhase[]): VisibilityState {
  return {
    allJobs: true,
    allEvents: true,
    statuses: Object.fromEntries(phases.map((phase) => [phase.job_phase_label, true])),
  };
}

function normalizeJob(job: CalendarJob): CalendarItem {
  const workOrder = formatWorkOrderNumber(job.work_order_num);
  const unit = job.unit_number ? `Unit ${job.unit_number}` : 'Unit not set';
  const jobType = job.job_type_label || 'Job type not set';
  const subcontractor = job.assigned_to_name || 'Unassigned';
  const isUnassignedJobRequest = !job.assigned_to && job.job_phase?.job_phase_label === 'Job Request';
  return {
    id: `job-${job.id}`,
    sourceId: job.id,
    type: 'job',
    title: `${workOrder} · ${job.property_name} · ${unit} · ${jobType} · ${subcontractor}`,
    date: dateOnlyFromJob(job.scheduled_date),
    allDay: true,
    color: isUnassignedJobRequest ? '#60a5fa' : job.job_phase?.color_dark_mode || '#64748b',
    status: job.job_phase?.job_phase_label || 'Unknown',
    customerName: job.property_name,
    address: formatAddress(job),
    assignedSubcontractor: job.assigned_to_name,
    raw: job,
  };
}

function normalizeEvent(event: CalendarEvent): CalendarItem {
  return {
    id: `event-${event.id}`,
    sourceId: event.id,
    type: 'event',
    title: event.title,
    date: eventStartDate(event),
    allDay: event.is_all_day,
    color: event.color || '#2563eb',
    status: 'Event',
    raw: event,
  };
}

function isDailyAgendaEvent(event: CalendarEvent) {
  return event.title.includes('Paint') && event.title.includes('Callback') && event.title.includes('Repair');
}

export default function DevCalendar3Page() {
  const { role, isAdmin, isJGManagement } = useUserRole();
  const canManage = isAdmin || isJGManagement || role === 'is_super_admin';
  const [currentDate, setCurrentDate] = useState(getEasternNow());
  const [selectedDate, setSelectedDate] = useState(dateOnlyFromDate(getEasternNow()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => latestViewModePreference()?.viewMode || 'month');
  const [jobs, setJobs] = useState<CalendarJob[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [phases, setPhases] = useState<JobPhase[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({ allJobs: true, allEvents: true, statuses: {} });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [viewPreferenceHydrated, setViewPreferenceHydrated] = useState(false);
  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>(() => readJson(LOCAL_ORDER_KEY, {}));
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [calendarListCollapsed, setCalendarListCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<CalendarItem | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentSubId, setAssignmentSubId] = useState('');
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([]);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [addChoice, setAddChoice] = useState<AddChoice>({ date: '', open: false });
  const [subscriptionTarget, setSubscriptionTarget] = useState<SubscriptionTarget | null>(null);
  const [calendarToken, setCalendarToken] = useState('');
  const [subscriptionCopied, setSubscriptionCopied] = useState(false);
  const lastDragMonthScrollAt = useRef(0);
  const lastMonthWheelAt = useRef(0);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tbwtfimnbmvbgesidbxh.supabase.co';
  const calendarFeedBase = `${supabaseUrl}/functions/v1/calendar-feed`;
  const visibilityStorageKey = currentUserId ? `${VISIBILITY_KEY}-${currentUserId}` : VISIBILITY_KEY;

  const monthRange = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return { start, end };
  }, [currentDate]);

  const visibleRange = useMemo(() => {
    if (viewMode === 'week') {
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
    }

    if (viewMode === 'day') {
      return { start: currentDate, end: currentDate };
    }

    return monthRange;
  }, [currentDate, monthRange, viewMode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rangeStart = formatInTimeZone(visibleRange.start, TZ, "yyyy-MM-dd'T'00:00:00XXX");
      const rangeEnd = formatInTimeZone(visibleRange.end, TZ, "yyyy-MM-dd'T'23:59:59XXX");

      const [phaseResult, jobResult, eventResult, subResult] = await Promise.all([
        supabase.from('job_phases').select('id, job_phase_label, color_dark_mode, sort_order').neq('job_phase_label', 'Grading').order('sort_order'),
        supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            unit_number,
            description,
            purchase_order,
            scheduled_date,
            assigned_to,
            assigned_at,
            assignment_status,
            assignment_deadline,
            assignment_decision_at,
            declined_reason_code,
            declined_reason_text,
            property:properties (
              id,
              property_name,
              address,
              city,
              state,
              zip
            ),
            unit_size:unit_sizes (
              unit_size_label
            ),
            job_phase:current_phase_id (
              id,
              job_phase_label,
              color_dark_mode,
              sort_order
            ),
            job_type:job_types (
              job_type_label
            ),
            profiles:assigned_to (
              full_name,
              email
            )
          `)
          .gte('scheduled_date', rangeStart)
          .lte('scheduled_date', rangeEnd)
          .order('scheduled_date', { ascending: true }),
        listCalendarEvents(rangeStart, rangeEnd),
        supabase.from('profiles').select('id, full_name, email, phone').eq('role', 'subcontractor').order('full_name'),
      ]);

      if (phaseResult.error) throw phaseResult.error;
      if (jobResult.error) throw jobResult.error;
      if (subResult.error) throw subResult.error;

      const loadedPhases = (phaseResult.data || []) as JobPhase[];
      setPhases(loadedPhases);
      setVisibility((prev) => {
        const merged = {
          ...defaultVisibility(loadedPhases),
          ...prev,
          statuses: {
            ...defaultVisibility(loadedPhases).statuses,
            ...(prev.statuses || {}),
          },
        };
        return merged;
      });

      setJobs((jobResult.data || []).map((job: any) => {
        const property = Array.isArray(job.property) ? job.property[0] : job.property;
        const unitSize = Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size;
        const phase = Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase;
        const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
        const profile = Array.isArray(job.profiles) ? job.profiles[0] : job.profiles;
        return {
          id: job.id,
          work_order_num: job.work_order_num,
          property_id: property?.id || '',
          property_name: property?.property_name || 'Property',
          address: property?.address || null,
          city: property?.city || null,
          state: property?.state || null,
          zip: property?.zip || null,
          unit_number: job.unit_number,
          unit_size_label: unitSize?.unit_size_label || null,
          description: job.description,
          purchase_order: job.purchase_order || null,
          scheduled_date: job.scheduled_date,
          job_phase: phase || { id: 'unknown', job_phase_label: 'Unknown', color_dark_mode: '#64748b' },
          job_type_label: jobType?.job_type_label || null,
          assigned_to: job.assigned_to || null,
          assigned_to_name: profile?.full_name || null,
          assigned_to_email: profile?.email || null,
          assigned_at: job.assigned_at || null,
          assignment_status: job.assignment_status || null,
          assignment_deadline: job.assignment_deadline || null,
          assignment_decision_at: job.assignment_decision_at || null,
          declined_reason_code: job.declined_reason_code || null,
          declined_reason_text: job.declined_reason_text || null,
        };
      }));

      setEvents((eventResult || []).filter((event) => !isDailyAgendaEvent(event)));
      setSubcontractors((subResult.data || []) as Subcontractor[]);
    } catch (error) {
      console.error('Calendar load failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [visibleRange.end, visibleRange.start]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!authLoaded || phases.length === 0) return;

    const saved = readJson<Partial<VisibilityState>>(visibilityStorageKey, {});
    const defaultState = defaultVisibility(phases);

    setVisibility((prev) => ({
      ...defaultState,
      ...prev,
      ...saved,
      statuses: {
        ...defaultState.statuses,
        ...(prev.statuses || {}),
        ...(saved.statuses || {}),
      },
    }));

    setPreferencesHydrated(true);
  }, [authLoaded, phases, visibilityStorageKey]);

  useEffect(() => {
    if (!authLoaded) return;

    const today = getEasternNow();
    setCurrentDate(today);
    setSelectedDate(dateOnlyFromDate(today));

    const savedViewMode = latestViewModePreference(currentUserId);
    if (savedViewMode) {
      setViewMode(savedViewMode.viewMode);
      writeViewModePreference(savedViewMode.viewMode, currentUserId);
    }

    setViewPreferenceHydrated(true);
  }, [authLoaded, currentUserId]);

  useEffect(() => {
    if (!preferencesHydrated) return;
    writeJson(visibilityStorageKey, visibility);
  }, [preferencesHydrated, visibility, visibilityStorageKey]);

  useEffect(() => {
    if (!viewPreferenceHydrated) return;
    writeViewModePreference(viewMode, currentUserId);
  }, [currentUserId, viewMode, viewPreferenceHydrated]);

  useEffect(() => {
    writeJson(LOCAL_ORDER_KEY, localOrder);
  }, [localOrder]);

  const updateViewMode = (nextViewMode: CalendarViewMode) => {
    setViewMode(nextViewMode);
    writeViewModePreference(nextViewMode, currentUserId);
  };

  useEffect(() => {
    if (selectedItem?.type !== 'job') return;
    const job = selectedItem.raw as CalendarJob;
    setAssignmentSubId(job.assigned_to || '');
  }, [selectedItem]);

  const allItems = useMemo(() => {
    const normalizedJobs = jobs.map(normalizeJob);
    const normalizedEvents = events.flatMap((event) => {
      if (event.parent_event_id) return [];
      if (event.is_recurring && event.recurrence_type) {
        const days: CalendarEvent[] = [];
        for (let day = visibleRange.start; day <= visibleRange.end; day = addDays(day, 1)) {
          days.push(...getRecurringEventsForDay([event], day, TZ));
        }
        return days.map(normalizeEvent);
      }
      return [normalizeEvent(event)];
    });
    return [...normalizedJobs, ...normalizedEvents];
  }, [events, jobs, visibleRange.end, visibleRange.start]);

  const visibleItems = useMemo(() => {
    return allItems.filter((item) => {
      if (item.type === 'event') return visibility.allEvents;
      return visibility.statuses[item.status || ''] !== false;
    });
  }, [allItems, visibility]);

  const itemsByDate = useMemo(() => {
    const grouped: Record<string, CalendarItem[]> = {};
    visibleItems.forEach((item) => {
      grouped[item.date] ||= [];
      grouped[item.date].push(item);
    });

    Object.entries(grouped).forEach(([date, items]) => {
      const order = localOrder[date] || [];
      grouped[date] = [...items].sort((a, b) => {
        const aIdx = order.indexOf(a.id);
        const bIdx = order.indexOf(b.id);
        if (aIdx !== -1 || bIdx !== -1) return (aIdx === -1 ? 9999 : aIdx) - (bIdx === -1 ? 9999 : bIdx);
        if (a.type !== b.type) return a.type === 'job' ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
    });

    return grouped;
  }, [localOrder, visibleItems]);

  const days = useMemo(() => {
    const output: Date[] = [];
    for (let day = monthRange.start; day <= monthRange.end; day = addDays(day, 1)) {
      output.push(day);
    }
    return output;
  }, [monthRange.end, monthRange.start]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [currentDate]);

  const agendaDays = useMemo(() => {
    const output: Date[] = [];
    for (let day = visibleRange.start; day <= visibleRange.end; day = addDays(day, 1)) {
      output.push(day);
    }
    return output;
  }, [visibleRange.end, visibleRange.start]);

  const selectedDayItems = itemsByDate[selectedDate] || [];

  const moveCalendar = (direction: -1 | 1) => {
    const nextDate = viewMode === 'month' || viewMode === 'agenda'
      ? (direction === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
      : addDays(currentDate, direction * (viewMode === 'week' ? 7 : 1));

    setCurrentDate(nextDate);
    setSelectedDate(dateOnlyFromDate(nextDate));
  };

  const calendarHeading = useMemo(() => {
    if (viewMode === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }

    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    }

    return format(currentDate, 'MMMM yyyy');
  }, [currentDate, viewMode, weekDays]);

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id || null))
      .catch(() => setCurrentUserId(null))
      .finally(() => setAuthLoaded(true));
  }, []);

  useEffect(() => {
    if (!draggingItemId) return;

    const handleDragWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 20) return;
      const now = Date.now();
      if (now - lastDragMonthScrollAt.current < 700) return;

      event.preventDefault();
      lastDragMonthScrollAt.current = now;
      setCurrentDate((date) => event.deltaY > 0 ? addMonths(date, 1) : subMonths(date, 1));
    };

    window.addEventListener('wheel', handleDragWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleDragWheel);
  }, [draggingItemId]);

  const handleMonthWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (viewMode !== 'month') return;
    if (draggingItemId) return;
    if (Math.abs(event.deltaY) < 35) return;

    const now = Date.now();
    if (now - lastMonthWheelAt.current < 550) return;

    event.preventDefault();
    lastMonthWheelAt.current = now;
    const nextDate = event.deltaY > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    setCurrentDate(nextDate);
    setSelectedDate(dateOnlyFromDate(nextDate));
  };

  const updateVisibility = (next: VisibilityState) => {
    setVisibility(next);
    writeJson(visibilityStorageKey, next);
  };

  const toggleAllJobs = () => {
    const nextChecked = !visibility.allJobs;
    updateVisibility({
      ...visibility,
      allJobs: nextChecked,
      statuses: {
        ...visibility.statuses,
        ...Object.fromEntries(phases.map((phase) => [phase.job_phase_label, nextChecked])),
      },
    });
  };

  const toggleStatus = (status: string) => {
    const nextStatuses = {
      ...visibility.statuses,
      [status]: visibility.statuses[status] === false,
    };
    const allStatusesVisible = phases.every((phase) => nextStatuses[phase.job_phase_label] !== false);

    updateVisibility({
      ...visibility,
      allJobs: allStatusesVisible,
      statuses: nextStatuses,
    });
  };

  const getOrCreateCalendarToken = async () => {
    try {
      const { data } = await supabase.rpc('ensure_calendar_token');
      if (data) return data as string;
    } catch {
      // Fall through to direct calendar_tokens lookup used by the existing subscribe modal.
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) throw new Error('Not signed in');

    const { data: existing, error: existingError } = await supabase
      .from('calendar_tokens')
      .select('token')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.token) return existing.token as string;

    const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { error } = await supabase.from('calendar_tokens').insert({ user_id: user.id, token });
    if (error) throw error;
    return token;
  };

  const openSubscription = async (target: SubscriptionTarget) => {
    setSubscriptionTarget(target);
    setSubscriptionCopied(false);
    try {
      const token = calendarToken || await getOrCreateCalendarToken();
      setCalendarToken(token);
    } catch (error) {
      console.error('Calendar feed token failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not prepare calendar feed');
    }
  };

  const subscriptionUrl = subscriptionTarget && calendarToken
    ? `${calendarFeedBase}?scope=${subscriptionTarget.scope}&token=${calendarToken}`
    : '';

  const copySubscriptionUrl = async () => {
    if (!subscriptionUrl) return;
    try {
      await navigator.clipboard.writeText(subscriptionUrl);
      setSubscriptionCopied(true);
      setTimeout(() => setSubscriptionCopied(false), 1800);
    } catch {
      toast.error('Could not copy calendar URL');
    }
  };

  const getPhaseSubscriptionTarget = (phase: JobPhase): SubscriptionTarget => {
    const isCompleted = phase.job_phase_label.toLowerCase().includes('complete');
    return {
      label: phase.job_phase_label,
      scope: isCompleted ? 'completed_jobs' : 'events_and_job_requests',
      description: isCompleted
        ? 'Subscribe to the completed jobs calendar feed.'
        : 'Subscribe to the existing jobs calendar feed.',
      limitation: isCompleted
        ? undefined
        : 'The current calendar-feed backend does not support status-specific ICS filtering yet, so this uses the shared jobs feed.',
    };
  };

  const SubscribeIconButton = ({ target }: { target: SubscriptionTarget }) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        openSubscription(target);
      }}
      className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-[#0F172A] dark:hover:text-blue-300"
      title={`Subscribe to ${target.label}`}
      aria-label={`Subscribe to ${target.label}`}
    >
      <CalendarPlus className="h-4 w-4" />
    </button>
  );

  const handleDropOnDate = async (targetDate: string) => {
    if (!draggingItemId) return;
    const item = draggingItem || allItems.find((candidate) => candidate.id === draggingItemId);
    setDraggingItemId(null);
    setDraggingItem(null);
    if (!item) return;

    if (item.date === targetDate) {
      const ids = (itemsByDate[targetDate] || []).map((candidate) => candidate.id);
      const fromIndex = ids.indexOf(item.id);
      if (fromIndex >= 0) {
        const reordered = [...ids];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.push(moved);
        setLocalOrder((prev) => ({ ...prev, [targetDate]: reordered }));
      }
      toast.info('Same-day order is saved locally for this test page');
      return;
    }

    if (item.type === 'job') {
      const previousJobs = jobs;
      const draggedJob = item.raw as CalendarJob;
      setJobs((prev) => {
        const exists = prev.some((job) => job.id === item.sourceId);
        if (exists) {
          return prev.map((job) => (job.id === item.sourceId ? { ...job, scheduled_date: targetDate } : job));
        }
        return [...prev, { ...draggedJob, scheduled_date: targetDate }];
      });
      try {
        const { error } = await supabase.from('jobs').update({ scheduled_date: targetDate }).eq('id', item.sourceId);
        if (error) throw error;
        toast.success(`Moved ${item.title} to ${formatDisplayDate(targetDate)}`);
      } catch (error) {
        setJobs(previousJobs);
        console.error('Job reschedule failed:', error);
        toast.error(error instanceof Error ? error.message : 'Could not move job');
      }
      return;
    }

    const event = item.raw as CalendarEvent;
    const previousEvents = events;
    try {
      const originalStart = parseISO(event.start_at);
      const originalEnd = parseISO(event.end_at);
      const duration = differenceInMilliseconds(originalEnd, originalStart);
      const time = formatInTimeZone(originalStart, TZ, 'HH:mm:ss');
      const newStart = event.is_all_day
        ? zonedTimeToUtc(`${targetDate}T00:00:00`, TZ)
        : zonedTimeToUtc(`${targetDate}T${time}`, TZ);
      const newEnd = new Date(newStart.getTime() + duration);
      const payload = { start_at: newStart.toISOString(), end_at: newEnd.toISOString() };

      setEvents((prev) => prev.map((candidate) => (candidate.id === event.id ? { ...candidate, ...payload } : candidate)));
      const { error } = await supabase.from('calendar_events').update(payload).eq('id', event.parent_event_id || event.id);
      if (error) throw error;
      toast.success(`Moved event to ${formatDisplayDate(targetDate)}`);
    } catch (error) {
      setEvents(previousEvents);
      console.error('Event reschedule failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not move event');
    }
  };

  const handleReorder = (date: string, itemId: string, direction: -1 | 1) => {
    const ids = (itemsByDate[date] || []).map((item) => item.id);
    const index = ids.indexOf(itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    setLocalOrder((prev) => ({ ...prev, [date]: reordered }));
  };

  const handleReorderDrop = (date: string, targetItemId: string) => {
    if (!draggingItemId || draggingItemId === targetItemId) return;
    const item = draggingItem || allItems.find((candidate) => candidate.id === draggingItemId);
    if (!item || item.date !== date) return;

    const ids = (itemsByDate[date] || []).map((candidate) => candidate.id);
    const fromIndex = ids.indexOf(item.id);
    const toIndex = ids.indexOf(targetItemId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...ids];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setLocalOrder((prev) => ({ ...prev, [date]: reordered }));
    setDraggingItemId(null);
    setDraggingItem(null);
  };

  const createAssignmentDecisionToken = async (jobId: string, subcontractorId: string) => {
    const token = crypto.randomUUID ? crypto.randomUUID() : `${jobId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('assignment_tokens').insert({
      job_id: jobId,
      subcontractor_id: subcontractorId,
      token,
      expires_at: expiresAt,
      sent_at: new Date().toISOString(),
    });
    if (error) throw error;
    return token;
  };

  const generateEmailContent = (subcontractor: Subcontractor, jobsForSub: CalendarJob[], tokensByJobId: Record<string, string>) => {
    const firstName = subcontractor.full_name?.split(' ')[0] || subcontractor.full_name || 'there';
    const subject = 'New Job Assignment - Please Accept or Decline';
    const htmlItems = jobsForSub.map((job) => {
      const token = tokensByJobId[job.id];
      const decisionUrl = token
        ? `${ASSIGNMENT_DECISION_URL}?token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(job.id)}`
        : SUBCONTRACTOR_DASHBOARD_URL;
      return `
        <li style="margin-bottom:18px;padding:14px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">
          <div style="font-weight:600;color:#111827;font-size:15px;">${job.property_name}</div>
          <div style="margin-top:6px;color:#374151;font-size:14px;">
            <div><strong>Work Order:</strong> ${formatWorkOrderNumber(job.work_order_num)}</div>
            <div><strong>Scheduled Date:</strong> ${formatDisplayDate(dateOnlyFromJob(job.scheduled_date))}</div>
            <div><strong>Address:</strong> ${formatAddress(job) || 'Address on file'}</div>
          </div>
          <div style="margin-top:12px;">
            <a href="${decisionUrl}" style="display:inline-block;padding:12px 16px;background:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Review &amp; Accept / Decline</a>
          </div>
        </li>
      `;
    }).join('');
    const textItems = jobsForSub.map((job) => {
      const token = tokensByJobId[job.id];
      const decisionUrl = token ? `${ASSIGNMENT_DECISION_URL}?token=${token}&jobId=${job.id}` : SUBCONTRACTOR_DASHBOARD_URL;
      return `${job.property_name}
Work Order: ${formatWorkOrderNumber(job.work_order_num)}
Scheduled Date: ${formatDisplayDate(dateOnlyFromJob(job.scheduled_date))}
Address: ${formatAddress(job) || 'Address on file'}
Respond: ${decisionUrl}`;
    }).join('\n\n');

    return {
      subject,
      html: `<p>Hi ${firstName},</p><p>You have been assigned to the following job${jobsForSub.length > 1 ? 's' : ''}. Please review and accept or decline:</p><ul>${htmlItems}</ul><p>Thank you,<br/>JG Painting Pros Inc.</p>`,
      text: `Hi ${firstName},

You have been assigned to the following job${jobsForSub.length > 1 ? 's' : ''}. Please review and accept or decline:

${textItems}

Thank you,
JG Painting Pros Inc.`,
    };
  };

  const saveAssignment = async () => {
    if (!selectedItem || selectedItem.type !== 'job') return;
    const job = selectedItem.raw as CalendarJob;
    const newSubId = assignmentSubId || null;
    const previousSubId = job.assigned_to || null;
    if (newSubId === previousSubId) {
      toast.info('No assignment changes to save');
      return;
    }

    setAssignmentSaving(true);
    try {
      let assignedAt: string | null = null;
      let assignmentDeadline: string | null = null;
      if (newSubId) {
        assignedAt = new Date().toISOString();
        const { data, error } = await supabase.rpc('calculate_assignment_deadline', { p_assigned_at: assignedAt });
        if (error) {
          console.error('Assignment deadline calculation failed:', error);
          const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
          const fallback = new Date(etNow);
          fallback.setHours(15, 30, 0, 0);
          if (etNow.getHours() > 15 || (etNow.getHours() === 15 && etNow.getMinutes() >= 30)) fallback.setDate(fallback.getDate() + 1);
          assignmentDeadline = fallback.toISOString();
        } else {
          assignmentDeadline = data;
        }
      }

      const patch = {
        assigned_to: newSubId,
        assigned_at: assignedAt,
        assignment_deadline: assignmentDeadline,
        assignment_status: newSubId ? 'pending' : null,
        assignment_decision_at: null,
        declined_reason_code: null,
        declined_reason_text: null,
      };
      const { error } = await supabase.from('jobs').update(patch).eq('id', job.id);
      if (error) throw error;

      const subcontractor = subcontractors.find((sub) => sub.id === newSubId);
      const updatedJob: CalendarJob = {
        ...job,
        ...patch,
        assigned_to_name: subcontractor?.full_name || null,
        assigned_to_email: subcontractor?.email || null,
      };
      setJobs((prev) => prev.map((candidate) => (candidate.id === job.id ? updatedJob : candidate)));
      setSelectedItem(normalizeJob(updatedJob));
      toast.success(subcontractor ? `Assigned to ${subcontractor.full_name || subcontractor.email}` : 'Assignment cleared');

      if (subcontractor?.email) {
        setPendingNotifications([{ subcontractor, jobs: [updatedJob] }]);
      }
    } catch (error) {
      console.error('Assignment save failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not save assignment');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const sendPendingNotifications = async () => {
    setSendingNotifications(true);
    try {
      for (const notification of pendingNotifications) {
        const tokensByJobId: Record<string, string> = {};
        for (const job of notification.jobs) {
          tokensByJobId[job.id] = await createAssignmentDecisionToken(job.id, notification.subcontractor.id);
        }
        const { subject, html, text } = generateEmailContent(notification.subcontractor, notification.jobs, tokensByJobId);
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: { to: notification.subcontractor.email, subject, html, text },
        });
        if (emailError) throw new Error(emailError.message || 'Failed to send assignment email');

        dispatchSmsNotification({
          eventType: 'job_assigned',
          recipientUserId: notification.subcontractor.id,
          job_id: notification.jobs[0]?.id,
          context: {
            subcontractorName: notification.subcontractor.full_name || notification.subcontractor.email,
            jobCount: notification.jobs.length,
            jobIds: notification.jobs.map((job) => job.id),
            workOrderNums: notification.jobs.map((job) => job.work_order_num),
            workOrderNum: notification.jobs.length === 1 ? notification.jobs[0].work_order_num : undefined,
            propertyName: notification.jobs.length === 1 ? notification.jobs[0].property_name : null,
          },
        });

        const { error: logError } = await supabase.from('email_logs').insert(notification.jobs.map((job) => ({
          job_id: job.id,
          recipient_email: notification.subcontractor.email,
          subject,
          content: text,
          notification_type: 'sub_assignment',
          template_id: 'assignment_decision',
          cc_emails: null,
          bcc_emails: null,
        })));
        if (logError) console.error('Assignment email log failed:', logError);
      }
      toast.success('Assignment email sent');
      setPendingNotifications([]);
    } catch (error) {
      console.error('Assignment email failed:', error);
      toast.error(error instanceof Error ? error.message : 'Assignment saved, but email failed');
    } finally {
      setSendingNotifications(false);
    }
  };

  const viewOptions = CALENDAR_VIEW_MODES;

  const renderItemPill = (item: CalendarItem, date: string, className = '') => (
    <button
      key={item.id}
      title={item.title}
      draggable
      onDragStart={(event) => {
        event.stopPropagation();
        setDraggingItemId(item.id);
        setDraggingItem(item);
      }}
      onDragEnd={() => {
        setDraggingItemId(null);
        setDraggingItem(null);
      }}
      onClick={(event) => {
        event.stopPropagation();
        setSelectedDate(date);
        setSelectedItem(item);
      }}
      className={`group w-full rounded px-1.5 py-1 text-left text-[12px] leading-tight text-white shadow-sm flex items-center gap-1 cursor-grab active:cursor-grabbing ${draggingItemId === item.id ? 'opacity-50' : ''} ${className}`}
      style={{ backgroundColor: item.color }}
      aria-label={`${item.type === 'job' ? 'Job' : 'Event'} ${item.title}`}
    >
      <GripVertical className="h-3 w-3 shrink-0 opacity-75" />
      <span className="truncate">{item.title}</span>
    </button>
  );

  const renderWeekDayColumn = (day: Date, compact = false) => {
    const date = dateOnlyFromDate(day);
    const items = itemsByDate[date] || [];

    return (
      <div
        key={date}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => handleDropOnDate(date)}
        onClick={() => setSelectedDate(date)}
        className={`min-h-[420px] border-r border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B] p-3 transition-colors ${selectedDate === date ? 'ring-2 ring-inset ring-blue-500' : ''}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={(event) => {
              event.stopPropagation();
              setSelectedDate(date);
              setAddChoice({ date, open: true });
            }}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#0F172A]'}`}
            aria-label={`Add item on ${date}`}
          >
            <span className="hidden sm:inline">{format(day, compact ? 'EEE ' : 'EEE, MMM ')}</span>
            {format(day, 'd')}
          </button>
          <span className="text-xs text-gray-400">{items.length || ''}</span>
        </div>
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 dark:border-[#2D3B4E] py-8 text-center text-xs text-gray-400">
              Drop jobs or events here
            </div>
          ) : (
            items.map((item) => renderItemPill(item, date, 'py-2 text-sm'))
          )}
        </div>
      </div>
    );
  };

  const renderMonthView = () => (
    <section className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B] overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#2D3B4E] bg-gray-50 dark:bg-[#111827]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const date = dateOnlyFromDate(day);
          const items = itemsByDate[date] || [];
          const previewItems = items.slice(0, 4);
          const overflow = Math.max(items.length - previewItems.length, 0);
          return (
            <div
              key={date}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDropOnDate(date)}
              onClick={() => setSelectedDate(date)}
              className={`min-h-[132px] border-b border-r border-gray-200 dark:border-[#2D3B4E] p-2 transition-colors ${
                isSameMonth(day, currentDate) ? 'bg-white dark:bg-[#1E293B]' : 'bg-gray-50 dark:bg-[#111827] opacity-60'
              } ${selectedDate === date ? 'ring-2 ring-inset ring-blue-500' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedDate(date);
                    setAddChoice({ date, open: true });
                  }}
                  className={`h-7 min-w-7 rounded-full px-2 text-sm font-medium ${isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#0F172A]'}`}
                  aria-label={`Add item on ${date}`}
                >
                  {format(day, 'd')}
                </button>
                <span className="text-[11px] text-gray-400">{items.length ? items.length : ''}</span>
              </div>
              <div className="space-y-1">
                {previewItems.map((item) => renderItemPill(item, date))}
                {overflow > 0 && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedDate(date);
                      setExpandedDate(date);
                    }}
                    className="w-full rounded px-1.5 py-1 text-left text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderWeekView = () => (
    <section className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B] overflow-x-auto shadow-sm">
      <div className="grid min-w-[860px] grid-cols-7">
        {weekDays.map((day) => renderWeekDayColumn(day))}
      </div>
    </section>
  );

  const renderDayView = () => {
    const date = dateOnlyFromDate(currentDate);
    const items = itemsByDate[date] || [];

    return (
      <section
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => handleDropOnDate(date)}
        className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B] shadow-sm"
      >
        <div className="border-b border-gray-200 dark:border-[#2D3B4E] p-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{formatDisplayDate(date)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{items.length} all-day item{items.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={() => setAddChoice({ date, open: true })} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        <div className="min-h-[520px] p-3">
          {items.length === 0 ? (
            <div className="h-80 rounded-lg border border-dashed border-gray-200 dark:border-[#2D3B4E] flex items-center justify-center text-sm text-gray-400">
              Drop jobs or events here
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  onDragOver={(event) => {
                    if (draggingItemId && draggingItemId !== item.id) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleReorderDrop(date, item.id);
                  }}
                >
                  {renderItemPill(item, date, 'py-1.5 px-2 text-[11px] leading-snug')}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderAgendaView = () => (
    <section className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B] shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
        {agendaDays.map((day) => {
          const date = dateOnlyFromDate(day);
          const items = itemsByDate[date] || [];
          return (
            <div
              key={date}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDropOnDate(date)}
              className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[180px_minmax(0,1fr)]"
            >
              <button
                onClick={() => {
                  setSelectedDate(date);
                  setCurrentDate(day);
                  updateViewMode('day');
                }}
                className="text-left"
              >
                <div className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold ${isToday(day) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900 dark:bg-[#0F172A] dark:text-white'}`}>
                  {format(day, 'd')}
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{format(day, 'EEEE')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{format(day, 'MMM d, yyyy')}</p>
              </button>
              <div className="min-h-[56px] rounded-lg border border-dashed border-gray-200 dark:border-[#2D3B4E] p-2">
                {items.length === 0 ? (
                  <p className="py-3 text-sm text-gray-400">No scheduled items. Drop a job or event here.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => renderItemPill(item, date, 'py-2 text-sm'))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const sidebar = (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-gray-200 bg-white dark:border-[#2D3B4E] dark:bg-[#111827] lg:h-screen lg:w-72">
      <div className="shrink-0 p-4 border-b border-gray-200 dark:border-[#2D3B4E]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Calendars
          </h2>
          <button className="hidden lg:inline-flex text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setCalendarListCollapsed(true)} aria-label="Collapse calendar list">
            <PanelLeftClose className="h-5 w-5" />
          </button>
          <button className="lg:hidden text-gray-500" onClick={() => setMobileSidebarOpen(false)} aria-label="Close calendar filters">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4 space-y-5 overflow-y-auto">
        <section>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleAllJobs}
              className="min-w-0 flex-1 flex items-center gap-3 text-left text-sm font-medium text-gray-900 dark:text-white"
              aria-label="Toggle all jobs"
            >
              <span className={`h-4 w-4 rounded border flex items-center justify-center ${visibility.allJobs ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                {visibility.allJobs && <Check className="h-3 w-3" />}
              </span>
              <span className="truncate">All Jobs</span>
            </button>
            <SubscribeIconButton
              target={{
                label: 'All Jobs',
                scope: 'events_and_job_requests',
                description: 'Subscribe to the existing jobs calendar feed.',
                limitation: 'The current calendar-feed scope for jobs is named Events & Job Requests and may include events with job requests.',
              }}
            />
          </div>
          <div className="mt-3 space-y-2 pl-2">
            {phases.map((phase) => (
              <div key={phase.id} className="flex items-center gap-1">
                <button
                  onClick={() => toggleStatus(phase.job_phase_label)}
                  className="min-w-0 flex-1 flex items-center gap-3 text-left text-sm text-gray-700 dark:text-gray-300"
                  aria-label={`Toggle ${phase.job_phase_label}`}
                >
                  <span className={`h-4 w-4 rounded border flex items-center justify-center ${visibility.statuses[phase.job_phase_label] !== false ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900' : 'border-gray-300'}`}>
                    {visibility.statuses[phase.job_phase_label] !== false && <Check className="h-3 w-3" />}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: phase.color_dark_mode }} />
                  <span className="truncate">{phase.job_phase_label}</span>
                </button>
                <SubscribeIconButton target={getPhaseSubscriptionTarget(phase)} />
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateVisibility({ ...visibility, allEvents: !visibility.allEvents })}
              className="min-w-0 flex-1 flex items-center gap-3 text-left text-sm font-medium text-gray-900 dark:text-white"
              aria-label="Toggle all events"
            >
              <span className={`h-4 w-4 rounded border flex items-center justify-center ${visibility.allEvents ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                {visibility.allEvents && <Check className="h-3 w-3" />}
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              <span className="truncate">All Events</span>
            </button>
            <SubscribeIconButton
              target={{
                label: 'All Events',
                scope: 'events',
                description: 'Subscribe to the events calendar feed.',
              }}
            />
          </div>
        </section>
        <section className="rounded-lg bg-gray-50 dark:bg-[#0F172A] p-3 text-xs text-gray-600 dark:text-gray-400">
          Same-day ordering on this test page is visual and saved locally. Persistent cross-user ordering needs a job order field.
        </section>
      </div>
    </aside>
  );

  return (
    <div className="h-screen overflow-hidden bg-gray-100 text-gray-900 dark:bg-[#0F172A] dark:text-white">
      <div className="flex h-screen overflow-hidden">
        {!calendarListCollapsed && <div className="hidden shrink-0 lg:block">{sidebar}</div>}
        {calendarListCollapsed && (
          <div className="hidden w-14 shrink-0 border-r border-gray-200 bg-white dark:border-[#2D3B4E] dark:bg-[#111827] lg:flex lg:h-screen lg:items-start lg:justify-center lg:pt-4">
            <button
              onClick={() => setCalendarListCollapsed(false)}
              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-[#2D3B4E] dark:text-gray-300 dark:hover:bg-[#1E293B] dark:hover:text-white"
              aria-label="Open calendar list"
              title="Open calendar list"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          </div>
        )}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 lg:hidden">
            <div className="h-full max-w-xs bg-white dark:bg-[#111827]">{sidebar}</div>
          </div>
        )}

        <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-20 shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-[#2D3B4E] dark:bg-[#111827]/95">
            <div className="px-4 lg:px-6 py-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden p-2 rounded-lg border border-gray-200 dark:border-[#2D3B4E]" aria-label="Open calendar filters">
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
                <CalendarDays className="h-7 w-7 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-semibold">Calendar</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Jobs and events schedule</p>
                </div>
                <button onClick={loadData} className="p-2 rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B]" aria-label="Refresh calendar">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 items-center gap-3 xl:grid-cols-[1fr_auto_1fr]">
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-gray-100 dark:bg-[#0F172A] p-1">
                  {viewOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => updateViewMode(option)}
                      className={`px-3 py-1.5 text-sm font-medium capitalize rounded-md transition-colors ${
                        viewMode === option
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-[#1E293B] dark:text-white'
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                      }`}
                      aria-pressed={viewMode === option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => moveCalendar(-1)} className="p-2 rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B]" aria-label="Previous date range">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => { const today = getEasternNow(); setCurrentDate(today); setSelectedDate(dateOnlyFromDate(today)); }} className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    Today
                  </button>
                  <h2 className="min-w-[260px] text-center text-2xl font-semibold tracking-normal lg:text-3xl">{calendarHeading}</h2>
                  <button onClick={() => moveCalendar(1)} className="p-2 rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B]" aria-label="Next date range">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="hidden justify-end gap-2 xl:flex">
                  <button onClick={() => setCalendarListCollapsed((collapsed) => !collapsed)} className="inline-flex p-2 rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B]" aria-label={calendarListCollapsed ? 'Show calendar list' : 'Collapse calendar list'} title={calendarListCollapsed ? 'Show calendar list' : 'Collapse calendar list'}>
                    {calendarListCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setRightPanelCollapsed((collapsed) => !collapsed)} className="inline-flex p-2 rounded-lg border border-gray-200 dark:border-[#2D3B4E] bg-white dark:bg-[#1E293B]" aria-label={rightPanelCollapsed ? 'Open day list' : 'Collapse day list'} title={rightPanelCollapsed ? 'Open day list' : 'Collapse day list'}>
                    {rightPanelCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden p-4 lg:p-6">
            {loading ? (
              <div className="h-[70vh] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className={`grid h-full min-h-0 grid-cols-1 gap-5 ${rightPanelCollapsed ? 'xl:grid-cols-[minmax(0,1fr)_56px]' : 'xl:grid-cols-[minmax(0,1fr)_340px]'}`}>
                <div onWheel={handleMonthWheel} className="min-h-0 overflow-y-auto pr-1">
                  {viewMode === 'month' && renderMonthView()}
                  {viewMode === 'week' && renderWeekView()}
                  {viewMode === 'day' && renderDayView()}
                  {viewMode === 'agenda' && renderAgendaView()}
                </div>

                <aside className="min-h-0">
                  {rightPanelCollapsed ? (
                    <div className="hidden h-full rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-[#2D3B4E] dark:bg-[#1E293B] xl:flex xl:items-start xl:justify-center">
                      <button
                        onClick={() => setRightPanelCollapsed(false)}
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-[#2D3B4E] dark:text-gray-300 dark:hover:bg-[#0F172A] dark:hover:text-white"
                        aria-label="Open day list"
                        title="Open day list"
                      >
                        <PanelRightOpen className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <section className="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 bg-white shadow-sm dark:border-[#2D3B4E] dark:bg-[#1E293B]">
                      <div className="shrink-0 p-4 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{formatDisplayDate(selectedDate)}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{selectedDayItems.length} item{selectedDayItems.length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setAddChoice({ date: selectedDate, open: true })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                            <Plus className="h-4 w-4" />
                            Add
                          </button>
                          <button onClick={() => setRightPanelCollapsed(true)} className="hidden rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-[#2D3B4E] dark:text-gray-300 dark:hover:bg-[#0F172A] dark:hover:text-white xl:inline-flex" aria-label="Collapse day list" title="Collapse day list">
                            <PanelRightClose className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
                        {selectedDayItems.length === 0 ? (
                          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No jobs or events scheduled.</p>
                        ) : selectedDayItems.map((item, index) => (
                          <div key={item.id} className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] p-3 bg-gray-50 dark:bg-[#0F172A]">
                            <button onClick={() => setSelectedItem(item)} className="w-full text-left" title={item.title}>
                              <div className="flex items-start gap-2">
                                <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.type === 'job' ? item.status : item.allDay ? 'All day event' : 'Timed event'}</p>
                                </div>
                              </div>
                            </button>
                            {item.type === 'job' && (
                              <div className="mt-3 flex gap-2">
                                <button disabled={index === 0} onClick={() => handleReorder(selectedDate, item.id, -1)} className="px-2 py-1 rounded border text-xs disabled:opacity-40 border-gray-200 dark:border-[#2D3B4E]">Up</button>
                                <button disabled={index === selectedDayItems.length - 1} onClick={() => handleReorder(selectedDate, item.id, 1)} className="px-2 py-1 rounded border text-xs disabled:opacity-40 border-gray-200 dark:border-[#2D3B4E]">Down</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </aside>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white dark:bg-[#111827] shadow-2xl">
            <div className="sticky top-0 z-10 bg-white dark:bg-[#111827] border-b border-gray-200 dark:border-[#2D3B4E] p-5 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">{selectedItem.type}</p>
                <h2 className="text-xl font-semibold">{selectedItem.title}</h2>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1E293B]" aria-label="Close details">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white" style={{ backgroundColor: selectedItem.color }}>
                {selectedItem.status || (selectedItem.type === 'event' ? 'Event' : 'Job')}
              </span>

              {selectedItem.type === 'job' ? (() => {
                const job = selectedItem.raw as CalendarJob;
                return (
                  <>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div><dt className="text-gray-500">Scheduled Date</dt><dd className="font-medium">{formatDisplayDate(dateOnlyFromJob(job.scheduled_date))}</dd></div>
                      {job.job_type_label && <div><dt className="text-gray-500">Job Type</dt><dd className="font-medium">{job.job_type_label}</dd></div>}
                      <div><dt className="text-gray-500">Property</dt><dd className="font-medium">{job.property_name}</dd></div>
                      <div><dt className="text-gray-500">Unit</dt><dd className="font-medium">{job.unit_number}</dd></div>
                      {job.unit_size_label && <div><dt className="text-gray-500">Unit Size</dt><dd className="font-medium">{job.unit_size_label}</dd></div>}
                      {job.purchase_order && <div><dt className="text-gray-500">Purchase Order</dt><dd className="font-medium">{job.purchase_order}</dd></div>}
                      {formatAddress(job) && <div className="sm:col-span-2"><dt className="text-gray-500">Address</dt><dd className="font-medium">{formatAddress(job)}</dd></div>}
                      {job.description && <div className="sm:col-span-2"><dt className="text-gray-500">Notes</dt><dd className="font-medium whitespace-pre-wrap">{job.description}</dd></div>}
                      {job.assignment_status && <div><dt className="text-gray-500">Assignment Status</dt><dd className="font-medium capitalize">{job.assignment_status.replace('_', ' ')}</dd></div>}
                      {job.assigned_to_name && <div><dt className="text-gray-500">Assigned Subcontractor</dt><dd className="font-medium">{job.assigned_to_name}</dd></div>}
                    </dl>

                    <div className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] p-4">
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-blue-600" />
                        Subcontractor Assignment
                      </h3>
                      {canManage ? (
                        <div className="space-y-3">
                          <select value={assignmentSubId} onChange={(event) => setAssignmentSubId(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-[#2D3B4E] bg-white dark:bg-[#0F172A] px-3 py-2">
                            <option value="">Unassigned</option>
                            {subcontractors.map((sub) => (
                              <option key={sub.id} value={sub.id}>{sub.full_name || sub.email || 'Unnamed subcontractor'}</option>
                            ))}
                          </select>
                          <button onClick={saveAssignment} disabled={assignmentSaving} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                            {assignmentSaving ? 'Saving...' : 'Save Assignment'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">You do not have permission to assign subcontractors.</p>
                      )}
                    </div>

                    <Link to={`/dashboard/jobs/${job.id}`} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900">
                      Open Full Job
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </>
                );
              })() : (() => {
                const event = selectedItem.raw as CalendarEvent;
                return (
                  <>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div><dt className="text-gray-500">Date</dt><dd className="font-medium">{formatDisplayDate(eventStartDate(event))}</dd></div>
                      <div><dt className="text-gray-500">Schedule</dt><dd className="font-medium">{event.is_all_day ? 'All day' : `${formatInTimeZone(parseISO(event.start_at), TZ, 'h:mm a')} - ${formatInTimeZone(parseISO(event.end_at), TZ, 'h:mm a')}`}</dd></div>
                      {event.details && <div className="sm:col-span-2"><dt className="text-gray-500">Notes</dt><dd className="font-medium whitespace-pre-wrap">{event.details}</dd></div>}
                    </dl>
                    <p className="text-sm text-gray-500">Use the production event modal from the existing calendar for full event editing.</p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {expandedDate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-[#111827] shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-[#2D3B4E] flex justify-between">
              <h2 className="text-lg font-semibold">{formatDisplayDate(expandedDate)}</h2>
              <button onClick={() => setExpandedDate(null)} aria-label="Close expanded day"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-2">
              {(itemsByDate[expandedDate] || []).map((item) => (
                <button key={item.id} onClick={() => { setSelectedItem(item); setExpandedDate(null); }} className="w-full rounded-lg border border-gray-200 dark:border-[#2D3B4E] p-3 text-left hover:bg-gray-50 dark:hover:bg-[#1E293B]">
                  <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                  <span className="font-medium">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {addChoice.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-white dark:bg-[#111827] p-5 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Add to {formatDisplayDate(addChoice.date)}</h2>
              </div>
              <button onClick={() => setAddChoice({ date: '', open: false })} aria-label="Close add menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <Link to="/dashboard/jobs/new" className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-[#2D3B4E] p-3 hover:bg-gray-50 dark:hover:bg-[#1E293B]">
                <Plus className="h-4 w-4" />
                Add Job
              </Link>
              <div className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] p-3">
                <EventModal
                  canCreate={canManage}
                  defaultDate={parseDateOnly(addChoice.date)}
                  onCreated={(event) => {
                    setEvents((prev) => [event, ...prev]);
                    setAddChoice({ date: '', open: false });
                    toast.success('Event created');
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {subscriptionTarget && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-lg bg-white dark:bg-[#111827] shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-[#2D3B4E] flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CalendarPlus className="h-5 w-5 text-blue-600" />
                  Subscribe to {subscriptionTarget.label}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subscriptionTarget.description}</p>
              </div>
              <button onClick={() => setSubscriptionTarget(null)} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white" aria-label="Close subscribe dialog">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {subscriptionTarget.limitation && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                  {subscriptionTarget.limitation}
                </div>
              )}

              {!subscriptionUrl ? (
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Preparing subscription links...
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ICS Feed URL</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={subscriptionUrl}
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1 px-3 py-2 border border-gray-300 dark:border-[#2D3B4E] rounded-md bg-gray-50 dark:bg-[#0F172A] text-gray-900 dark:text-white text-sm font-mono"
                      />
                      <button
                        onClick={copySubscriptionUrl}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
                      >
                        <Copy className="h-4 w-4" />
                        {subscriptionCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                      href={webcalUrl(subscriptionUrl)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Apple Calendar
                    </a>
                    <a
                      href={googleCalendarLink(subscriptionUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-[#2D3B4E] dark:text-white dark:hover:bg-[#1E293B]"
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Google Calendar
                    </a>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Apple Calendar opens through a webcal link. Google Calendar opens the From URL flow with this feed URL attached.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingNotifications.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-lg bg-white dark:bg-[#111827] shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-[#2D3B4E]">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Send Assignment Notification Email
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The assignment has been saved. Email will only send after you confirm.</p>
            </div>
            <div className="p-5 space-y-4">
              {pendingNotifications.map(({ subcontractor, jobs: jobsForSub }) => (
                <div key={subcontractor.id} className="rounded-lg border border-gray-200 dark:border-[#2D3B4E] p-4">
                  <p className="text-sm text-gray-500">Recipient</p>
                  <p className="font-medium">{subcontractor.full_name || subcontractor.email}</p>
                  {subcontractor.email && <p className="text-sm text-gray-500">{subcontractor.email}</p>}
                  <div className="mt-3 space-y-2">
                    {jobsForSub.map((job) => (
                      <div key={job.id} className="text-sm border-t border-gray-100 dark:border-[#2D3B4E] pt-2">
                        <p className="font-medium">{formatWorkOrderNumber(job.work_order_num)} · {job.property_name}</p>
                        <p className="text-gray-500">{formatDisplayDate(dateOnlyFromJob(job.scheduled_date))}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-[#2D3B4E] flex justify-end gap-3">
              <button onClick={() => setPendingNotifications([])} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#1E293B] text-sm font-medium">Not Now</button>
              <button onClick={sendPendingNotifications} disabled={sendingNotifications} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                {sendingNotifications ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
