import { Activity, CheckCircle, ClipboardCheck, ClipboardList, Clock, FileText, Minus, Plus, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { OPERATIONS_PHASES, type OperationsPhase, useLiveOperationsPulse } from '../../hooks/useLiveOperationsPulse';
import { UserActivityPulseCard } from './UserActivityPulseCard';

const APP_TIME_ZONE = 'America/New_York';

const icons = {
  'Job Request': ClipboardList,
  'Work Order': FileText,
  'Pending Work Order': Clock,
  'Completed Work Orders': CheckCircle,
  'Quality Control': ClipboardCheck,
} satisfies Record<OperationsPhase, typeof Activity>;

function colorWithAlpha(color: string, alphaHex: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alphaHex}` : color;
}

function eventTitle(event: ReturnType<typeof useLiveOperationsPulse>['data'][OperationsPhase]['events'][number]) {
  const workOrder = event.workOrderNumber
    ? `WO-${String(event.workOrderNumber).padStart(6, '0')}`
    : 'Job request';
  const timestamp = formatInTimeZone(new Date(event.timestamp), APP_TIME_ZONE, 'MMM d, yyyy h:mm a zzz');
  return [
    event.activityType === 'pending_outcome'
      ? `${workOrder} ${event.outcome}`
      : event.activityType === 'work_order_submitted'
      ? `${workOrder} submitted`
      : `${workOrder} ${event.direction} ${event.phase}`,
    `${event.propertyName}${event.unitNumber ? ` • Unit ${event.unitNumber}` : ''}`,
    `Assigned: ${event.assignedWorker}`,
    `Activity by: ${event.actorName}`,
    timestamp,
  ].join('\n');
}

function eventHeading(event: ReturnType<typeof useLiveOperationsPulse>['data'][OperationsPhase]['events'][number]) {
  const workOrder = event.workOrderNumber
    ? `WO-${String(event.workOrderNumber).padStart(6, '0')}`
    : 'Job request';
  const action = event.activityType === 'pending_outcome'
    ? event.outcome === 'approved' ? 'Approved' : event.outcome === 'declined' ? 'Declined' : 'Bypassed'
    : event.activityType === 'work_order_submitted'
      ? 'Submitted'
      : event.direction === 'entered' ? `Entered ${event.phase}` : `Left ${event.phase}`;
  return { workOrder, action };
}

function periodBoundsMs(period: ReturnType<typeof useLiveOperationsPulse>['period']) {
  const now = new Date();
  if (period === 'today' || period === 'yesterday') {
    const selectedDay = period === 'yesterday' ? subDays(now, 1) : now;
    return {
      start: new Date(formatInTimeZone(selectedDay, APP_TIME_ZONE, "yyyy-MM-dd'T'07:00:00XXX")).getTime(),
      end: new Date(formatInTimeZone(selectedDay, APP_TIME_ZONE, "yyyy-MM-dd'T'18:00:00XXX")).getTime(),
    };
  }
  const todayStart = new Date(formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd'T'00:00:00XXX")).getTime();
  const days = period === '7d' ? 7 : 30;
  return { start: todayStart - (days - 1) * 24 * 60 * 60 * 1000, end: now.getTime() };
}

function eventPosition(timestamp: string, period: ReturnType<typeof useLiveOperationsPulse>['period']) {
  const { start, end } = periodBoundsMs(period);
  return Math.max(4, Math.min(96, ((new Date(timestamp).getTime() - start) / Math.max(1, end - start)) * 92 + 4));
}

function defaultTimelineScale(period: ReturnType<typeof useLiveOperationsPulse>['period']) {
  if (period === 'today' || period === 'yesterday') {
    return 11 / 9;
  }
  return 1;
}

function timelineScaleForStep(period: ReturnType<typeof useLiveOperationsPulse>['period'], step: number) {
  if (step === 0) return defaultTimelineScale(period);
  const { start, end } = periodBoundsMs(period);
  const visibleHours = step === 1 ? 4 : 2;
  return (end - start) / (visibleHours * 60 * 60 * 1000);
}

function orderedEvents(events: ReturnType<typeof useLiveOperationsPulse>['data'][OperationsPhase]['events']) {
  return [...events].sort((left, right) => (
    new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  ));
}

function eventPeakY(
  event: ReturnType<typeof useLiveOperationsPulse>['data'][OperationsPhase]['events'][number],
  events: ReturnType<typeof useLiveOperationsPulse>['data'][OperationsPhase]['events'],
) {
  const index = Math.max(0, orderedEvents(events).findIndex((candidate) => candidate.id === event.id));
  return 7 + (index % 3) * 3;
}

function updateVisibleRange(
  timeline: HTMLDivElement,
  period: ReturnType<typeof useLiveOperationsPulse>['period'],
) {
  const { start, end } = periodBoundsMs(period);
  const duration = end - start;
  const startFraction = timeline.scrollWidth > 0 ? timeline.scrollLeft / timeline.scrollWidth : 0;
  const endFraction = timeline.scrollWidth > 0 ? (timeline.scrollLeft + timeline.clientWidth) / timeline.scrollWidth : 1;
  const labelFormat = period === 'today' || period === 'yesterday' ? 'h:mm a' : 'MMM d';
  const range = timeline.parentElement;
  const startLabel = range?.querySelector<HTMLElement>('[data-range-start]');
  const endLabel = range?.querySelector<HTMLElement>('[data-range-end]');
  if (startLabel) startLabel.textContent = formatInTimeZone(new Date(start + duration * startFraction), APP_TIME_ZONE, labelFormat);
  if (endLabel) endLabel.textContent = formatInTimeZone(new Date(start + duration * Math.min(1, endFraction)), APP_TIME_ZONE, labelFormat);
}

function buildActivityPath(
  events: ReturnType<typeof useLiveOperationsPulse>['data'][OperationsPhase]['events'],
  period: ReturnType<typeof useLiveOperationsPulse>['period'],
  phaseIndex: number,
) {
  if (!events.length) {
    const center = 92 + phaseIndex * 47;
    const lift = 16 + (phaseIndex % 3) * 3;
    return `M0 26 H${center - 18} L${center - 10} 24 L${center - 4} 26 L${center} ${lift} L${center + 8} 26 H440`;
  }

  const ordered = orderedEvents(events);
  const segments = ['M0 26'];
  ordered.forEach((event) => {
    const x = (eventPosition(event.timestamp, period) / 100) * 440;
    const peakY = eventPeakY(event, ordered);
    segments.push(`H${x - 12} L${x - 7} 23 L${x - 3} 26 L${x} ${peakY} L${x + 8} 26`);
  });
  segments.push('H440');
  return segments.join(' ');
}

export function LiveOperationsPulse() {
  const navigate = useNavigate();
  const pulse = useLiveOperationsPulse();
  const timelineRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRef = useRef<{
    element: HTMLDivElement;
    pointerId: number;
    startX: number;
    startScrollLeft: number;
  } | null>(null);
  const zoomAnchorsRef = useRef<Record<string, { contentFraction: number; pointerFraction: number } | null>>({});
  const zoomResetTimersRef = useRef<Record<string, number>>({});
  const [zoomSteps, setZoomSteps] = useState<Record<string, number>>({});
  const [tooltip, setTooltip] = useState<{
    event: ReturnType<typeof useLiveOperationsPulse>['data'][OperationsPhase]['events'][number];
    left: number;
    top: number;
  } | null>(null);

  const showEventTooltip = (
    element: HTMLButtonElement,
    event: ReturnType<typeof useLiveOperationsPulse>['data'][OperationsPhase]['events'][number],
  ) => {
    const bounds = element.getBoundingClientRect();
    setTooltip({
      event,
      left: Math.max(120, Math.min(window.innerWidth - 120, bounds.left + bounds.width / 2)),
      top: bounds.top - 8,
    });
  };

  const startTimelineDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || (event.target as HTMLElement).closest('button')) return;
    dragRef.current = {
      element: event.currentTarget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('pulse-wave-scroll--dragging');
    setTooltip(null);
  };

  const moveTimelineDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.element.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX);
  };

  const adjustTimelineZoom = (phase: OperationsPhase, direction: 'in' | 'out') => {
    const timeline = timelineRefs.current[phase];
    if (!timeline) return;
    const pointerFraction = 0.5;
    zoomAnchorsRef.current[phase] = {
      contentFraction: (timeline.scrollLeft + pointerFraction * timeline.clientWidth) / Math.max(1, timeline.scrollWidth),
      pointerFraction,
    };
    setZoomSteps((current) => {
      const currentStep = current[phase] || 0;
      return { ...current, [phase]: direction === 'in' ? Math.min(2, currentStep + 1) : Math.max(0, currentStep - 1) };
    });
  };

  const cancelZoomReset = (phase: OperationsPhase) => {
    window.clearTimeout(zoomResetTimersRef.current[phase]);
    delete zoomResetTimersRef.current[phase];
  };

  const scheduleZoomReset = (phase: OperationsPhase) => {
    cancelZoomReset(phase);
    zoomResetTimersRef.current[phase] = window.setTimeout(() => {
      zoomAnchorsRef.current[phase] = null;
      setZoomSteps((current) => ({ ...current, [phase]: 0 }));
      requestAnimationFrame(() => {
        const timeline = timelineRefs.current[phase];
        if (!timeline) return;
        timeline.scrollLeft = pulse.period === 'today' || pulse.period === 'yesterday' ? timeline.scrollWidth / 11 : 0;
        updateVisibleRange(timeline, pulse.period);
      });
    }, 5000);
  };

  const endTimelineDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.element.classList.remove('pulse-wave-scroll--dragging');
    if (drag.element.hasPointerCapture(event.pointerId)) drag.element.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  useEffect(() => {
    zoomAnchorsRef.current = {};
    setZoomSteps({});
    requestAnimationFrame(() => {
      Object.values(timelineRefs.current).forEach((timeline) => {
        if (!timeline) return;
        timeline.scrollLeft = pulse.period === 'today' || pulse.period === 'yesterday' ? timeline.scrollWidth / 11 : 0;
        updateVisibleRange(timeline, pulse.period);
      });
    });
  }, [pulse.period, pulse.propertyId, pulse.workerId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      Object.entries(timelineRefs.current).forEach(([phase, timeline]) => {
        if (!timeline) return;
        const anchor = zoomAnchorsRef.current[phase];
        if (anchor) {
          timeline.scrollLeft = anchor.contentFraction * timeline.scrollWidth - anchor.pointerFraction * timeline.clientWidth;
        } else if ((zoomSteps[phase] || 0) === 0) {
          timeline.scrollLeft = pulse.period === 'today' || pulse.period === 'yesterday' ? timeline.scrollWidth / 11 : 0;
        }
        updateVisibleRange(timeline, pulse.period);
        zoomAnchorsRef.current[phase] = null;
      });
    });
  }, [zoomSteps, pulse.period, pulse.lastSyncedAt]);

  useEffect(() => () => {
    Object.values(zoomResetTimersRef.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <section className="operations-pulse mb-4 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg dark:border-slate-700/80 dark:bg-[#111C2F] sm:p-4" aria-labelledby="live-operations-heading">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-500" />
            <h2 id="live-operations-heading" className="text-base font-bold text-gray-950 dark:text-white">Live Operations Pulse</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                pulse.connectionStatus === 'live'
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : pulse.connectionStatus === 'offline'
                    ? 'border-red-400/30 bg-red-500/10 text-red-600 dark:text-red-300'
                    : 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }`}
            >
              {pulse.connectionStatus === 'offline' ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
              {pulse.connectionStatus === 'live' ? 'Live' : pulse.connectionStatus === 'offline' ? 'Offline' : pulse.connectionStatus === 'reconnecting' ? 'Reconnecting' : 'Connecting'}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Current totals and live activity for {pulse.periodLabel}.
            {pulse.lastSyncedAt && (
              <> Last synced {formatInTimeZone(pulse.lastSyncedAt, APP_TIME_ZONE, 'h:mm:ss a zzz')}.</>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:w-auto" aria-label="Pulse filters">
          <label className="sr-only" htmlFor="pulse-period">Activity period</label>
          <select
            id="pulse-period"
            value={pulse.period}
            onChange={(event) => pulse.setPeriod(event.target.value as typeof pulse.period)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>

          <label className="sr-only" htmlFor="pulse-property">Property</label>
          <select
            id="pulse-property"
            value={pulse.propertyId}
            onChange={(event) => pulse.setPropertyId(event.target.value)}
            className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All properties</option>
            {pulse.properties.map((property) => <option key={property.id} value={property.id}>{property.label}</option>)}
          </select>

          <label className="sr-only" htmlFor="pulse-worker">Assigned worker</label>
          <select
            id="pulse-worker"
            value={pulse.workerId}
            onChange={(event) => pulse.setWorkerId(event.target.value)}
            className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All assigned workers</option>
            {pulse.workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.label}</option>)}
          </select>
        </div>
      </div>

      {pulse.error && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          Live pulse data could not be refreshed. The existing dashboard information below remains available.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        {OPERATIONS_PHASES.map((definition, phaseIndex) => {
          if (definition.phase === 'Quality Control') {
            return <UserActivityPulseCard key="user-activity" />;
          }
          const Icon = icons[definition.phase];
          const phaseData = pulse.data[definition.phase];
          const showsSubmissions = definition.phase === 'Work Order';
          const showsPendingOutcomes = definition.phase === 'Pending Work Order';
          const color = pulse.phaseColors[definition.phase] || '#64748B';
          const zoomStep = zoomSteps[definition.phase] || 0;
          const timelineZoom = timelineScaleForStep(pulse.period, zoomStep);
          const activityPath = buildActivityPath(phaseData.events, pulse.period, phaseIndex);
          const animationSeconds = 5;
          return (
            <article
              key={definition.phase}
              className="group relative min-h-[150px] overflow-hidden rounded-xl border bg-gray-50/70 p-3 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950/35"
              style={{
                borderColor: colorWithAlpha(color, '70'),
                backgroundImage: `linear-gradient(145deg, ${colorWithAlpha(color, '17')}, transparent 58%)`,
              }}
            >
              <button
                type="button"
                onClick={() => navigate(definition.route, {
                  state: {
                    pulseFilters: {
                      propertyId: pulse.propertyId || null,
                      workerId: pulse.workerId || null,
                      period: pulse.period,
                    },
                  },
                })}
                className="flex w-full items-start justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={`Open ${definition.label}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ color, borderColor: colorWithAlpha(color, '55'), backgroundColor: colorWithAlpha(color, '18') }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-bold text-gray-800 dark:text-slate-100">{definition.label}</h3>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-500">Current total</p>
                  </div>
                </div>
                <span className="text-2xl font-black leading-none text-gray-950 dark:text-white">
                  {pulse.loading ? '–' : phaseData.total}
                </span>
              </button>

              <div
                key={phaseData.accentKey}
                className={`pulse-wave-frame mt-3 ${phaseData.accentKey ? 'pulse-wave--accent' : ''}`}
                onMouseEnter={() => cancelZoomReset(definition.phase)}
                onMouseLeave={() => scheduleZoomReset(definition.phase)}
                style={{
                  color,
                  '--pulse-duration': `${animationSeconds}s`,
                  '--pulse-delay': `${-phaseIndex * 2.2}s`,
                } as CSSProperties}
              >
                <div
                  ref={(element) => { timelineRefs.current[definition.phase] = element; }}
                  className="pulse-wave-scroll"
                  onScroll={(event) => updateVisibleRange(event.currentTarget, pulse.period)}
                  onPointerDown={startTimelineDrag}
                  onPointerMove={moveTimelineDrag}
                  onPointerUp={endTimelineDrag}
                  onPointerCancel={endTimelineDrag}
                  tabIndex={0}
                  title="Drag left or right to move through time"
                  aria-label={showsSubmissions
                    ? `${definition.label} scrollable activity timeline: ${phaseData.entered} submitted during ${pulse.periodLabel}`
                    : showsPendingOutcomes
                      ? `${definition.label} scrollable activity timeline: ${phaseData.approved} approvals, ${phaseData.declined} declines, and ${phaseData.skipped} bypassed during ${pulse.periodLabel}`
                      : `${definition.label} scrollable activity timeline: ${phaseData.entered} entered and ${phaseData.left} left during ${pulse.periodLabel}`}
                >
                  <div className="pulse-wave" style={{ width: `${timelineZoom * 100}%` }}>
                    <svg viewBox="0 0 440 52" preserveAspectRatio="none" className="pulse-wave__svg" aria-hidden="true">
                      <path className="pulse-wave__trail" d={activityPath} />
                      <path className="pulse-wave__line" pathLength="100" d={activityPath} />
                      <circle className="pulse-wave__moving-dot" r="2.5">
                        <animateMotion
                          dur={`${animationSeconds}s`}
                          begin={`${-phaseIndex * 2.2}s`}
                          repeatCount="indefinite"
                          keyPoints="0;1;1"
                          keyTimes="0;0.2;1"
                          calcMode="linear"
                          path={activityPath}
                        />
                        <animate
                          attributeName="opacity"
                          values="0.72;0.72;0;0"
                          keyTimes="0;0.2;0.23;1"
                          dur={`${animationSeconds}s`}
                          begin={`${-phaseIndex * 2.2}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    </svg>
                    {phaseData.events.map((event) => (
                      <div
                        key={`${event.id}-${event.direction}`}
                        className="pulse-wave__event-wrap"
                        style={{
                          left: `${eventPosition(event.timestamp, pulse.period)}%`,
                          top: `${(eventPeakY(event, phaseData.events) / 52) * 100}%`,
                        }}
                      >
                        <button
                          type="button"
                          className="pulse-wave__event"
                          style={{ backgroundColor: color }}
                          aria-label={eventTitle(event)}
                          aria-describedby={tooltip?.event.id === event.id ? 'pulse-event-tooltip' : undefined}
                          onMouseEnter={(pointerEvent) => showEventTooltip(pointerEvent.currentTarget, event)}
                          onMouseLeave={() => setTooltip(null)}
                          onFocus={(focusEvent) => showEventTooltip(focusEvent.currentTarget, event)}
                          onBlur={() => setTooltip(null)}
                          onClick={() => navigate(`/dashboard/jobs/${event.jobId}`)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pulse-wave__zoom" aria-label="Timeline zoom controls">
                  <button
                    type="button"
                    className="pulse-wave__zoom-button"
                    onClick={() => adjustTimelineZoom(definition.phase, 'out')}
                    disabled={zoomStep === 0}
                    aria-label={`Zoom out ${definition.label} timeline`}
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="pulse-wave__zoom-button"
                    onClick={() => adjustTimelineZoom(definition.phase, 'in')}
                    disabled={zoomStep === 2}
                    aria-label={`Zoom in ${definition.label} timeline`}
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
                <div className="pulse-wave__range" aria-hidden="true">
                  <span data-range-start />
                  <span className="pulse-wave__range-line" />
                  <span data-range-end />
                </div>
              </div>

              {showsPendingOutcomes ? (
                <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] font-semibold">
                  <span className="text-emerald-600 dark:text-emerald-400">{phaseData.approved} Approvals</span>
                  <span className="text-red-600 dark:text-red-400">{phaseData.declined} Declines</span>
                  <span className="text-gray-500 dark:text-slate-400">{phaseData.skipped} Bypassed</span>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="font-semibold" style={{ color }}><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: color }} />{phaseData.entered} {showsSubmissions ? 'submitted' : 'entered'}</span>
                  <span className="text-gray-500 dark:text-slate-400">{showsSubmissions ? pulse.periodLabel : `${phaseData.left} left • ${pulse.periodLabel}`}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {tooltip && typeof document !== 'undefined' && createPortal((() => {
        const heading = eventHeading(tooltip.event);
        return (
          <div
            id="pulse-event-tooltip"
            role="tooltip"
            className="pointer-events-none fixed z-[100] w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-gray-200 bg-white/95 p-2.5 text-left shadow-xl backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/95"
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5 dark:border-slate-700">
              <span className="truncate text-[11px] font-bold text-gray-950 dark:text-white">{heading.workOrder}</span>
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-600 dark:bg-slate-800 dark:text-slate-300">{heading.action}</span>
            </div>
            <dl className="mt-1.5 space-y-1 text-[10px] leading-tight">
              <div className="flex gap-2"><dt className="w-12 shrink-0 text-gray-400 dark:text-slate-500">Property</dt><dd className="font-medium text-gray-700 dark:text-slate-200">{tooltip.event.propertyName}{tooltip.event.unitNumber ? ` · Unit ${tooltip.event.unitNumber}` : ''}</dd></div>
              <div className="flex gap-2"><dt className="w-12 shrink-0 text-gray-400 dark:text-slate-500">Assigned</dt><dd className="font-medium text-gray-700 dark:text-slate-200">{tooltip.event.assignedWorker}</dd></div>
              <div className="flex gap-2"><dt className="w-12 shrink-0 text-gray-400 dark:text-slate-500">Activity</dt><dd className="font-medium text-gray-700 dark:text-slate-200">{tooltip.event.actorName}</dd></div>
              <div className="flex gap-2"><dt className="w-12 shrink-0 text-gray-400 dark:text-slate-500">When</dt><dd className="font-medium text-gray-700 dark:text-slate-200">{formatInTimeZone(new Date(tooltip.event.timestamp), APP_TIME_ZONE, 'MMM d, yyyy · h:mm a zzz')}</dd></div>
              {tooltip.event.reason && <div className="flex gap-2"><dt className="w-12 shrink-0 text-gray-400 dark:text-slate-500">Note</dt><dd className="line-clamp-2 font-medium text-gray-700 dark:text-slate-200">{tooltip.event.reason}</dd></div>}
            </dl>
            <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-slate-600 dark:bg-slate-900" />
          </div>
        );
      })(), document.body)}
    </section>
  );
}
