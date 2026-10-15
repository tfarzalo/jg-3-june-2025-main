import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboardSource = readFileSync(new URL('../src/components/DashboardHome.tsx', import.meta.url), 'utf8');
const pulseSource = readFileSync(new URL('../src/components/dashboard/LiveOperationsPulse.tsx', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../src/hooks/useLiveOperationsPulse.ts', import.meta.url), 'utf8');
const userActivitySource = readFileSync(new URL('../src/components/dashboard/UserActivityPulseCard.tsx', import.meta.url), 'utf8');
const usePresenceSource = readFileSync(new URL('../src/hooks/usePresence.ts', import.meta.url), 'utf8');
const presenceSource = readFileSync(new URL('../src/lib/presence.ts', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

describe('Live Operations Pulse dashboard contract', () => {
  it('uses the five real workflow phases in the requested order', () => {
    const order = [
      "phase: 'Job Request'",
      "phase: 'Work Order'",
      "phase: 'Pending Work Order'",
      "phase: 'Completed Work Orders'",
      "phase: 'Quality Control'",
    ];
    let previous = -1;
    order.forEach((needle) => {
      const position = hookSource.indexOf(needle);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    });
  });

  it('uses shared database colors and preserves phase-specific routes', () => {
    expect(hookSource).toContain(".select('id, job_phase_label, color_dark_mode')");
    expect(pulseSource).toContain('pulse.phaseColors[definition.phase]');
    expect(hookSource).toContain("route: '/dashboard/jobs/quality-control'");
  });

  it('keeps the existing dashboard content and installs only the replacement pulse panel', () => {
    expect(dashboardSource).toContain('<LiveOperationsPulse />');
    expect(dashboardSource).toContain('title="Today\'s Agenda"');
    expect(dashboardSource).toContain('title="Recent Activity"');
    expect(dashboardSource).toContain('title="Pending Work Orders"');
    expect(dashboardSource).toContain('title="Completed Work Orders"');
  });

  it('subscribes, reconciles, deduplicates, and cleans up realtime state', () => {
    expect(hookSource).toContain("table: 'job_phase_changes'");
    expect(hookSource).toContain("table: 'jobs'");
    expect(hookSource).toContain("table: 'job_phases'");
    expect(hookSource).toContain("table: 'work_orders'");
    expect(hookSource).toContain("filter: 'entity_type=eq.work_order'");
    expect(hookSource).toContain('seenEventIdsRef.current.has(row.id)');
    expect(hookSource).toContain("setConnectionStatus('live')");
    expect(hookSource).toContain('void supabase.removeChannel(channel)');
  });

  it('plots submitted work orders independently from the current Work Order phase total', () => {
    expect(hookSource).toContain(".from('work_orders')");
    expect(hookSource).toContain(".gte('submission_date', periodBounds.start)");
    expect(hookSource).toContain("activityType: 'work_order_submitted'");
    expect(hookSource).toContain("toPhase !== 'Work Order'");
    expect(pulseSource).toContain("showsSubmissions ? 'submitted' : 'entered'");
  });

  it('draws quick, paused phase-specific timelines from saved entered and left events', () => {
    expect(pulseSource).toContain('function buildActivityPath(');
    expect(pulseSource).toContain("event.direction === 'entered'");
    expect(pulseSource).toContain('eventPosition(event.timestamp, pulse.period)');
    expect(pulseSource).toContain('const animationSeconds = 7');
    expect(pulseSource).toContain('className="pulse-wave__moving-dot"');
    expect(pulseSource).toContain('path={activityPath}');
    expect(pulseSource).toContain('<animateMotion');
    expect(pulseSource).toContain('keyTimes="0;0.143;1"');
    expect(pulseSource).toContain('values="0.72;0.72;0;0"');
    expect(pulseSource).toContain("'--pulse-delay': '0s'");
  });

  it('supports yesterday and labels points by time or date for the selected period', () => {
    expect(hookSource).toContain("PulsePeriod = 'today' | 'yesterday' | '7d' | '30d'");
    expect(pulseSource).toContain('<option value="yesterday">Yesterday</option>');
    expect(pulseSource).toContain("period === 'today' || period === 'yesterday' ? 'h:mm a' : 'MMM d'");
    expect(pulseSource).toContain('onScroll={(event) => updateVisibleRange(event.currentTarget, pulse.period)}');
  });

  it('limits the property filter to active properties with activity in the selected period', () => {
    expect(hookSource).toContain(".gte('created_at', periodBounds.start)");
    expect(hookSource).toContain(".lt('created_at', periodBounds.end)");
    expect(hookSource).toContain(".in('id', activePropertyIds)");
    expect(hookSource).toContain(".eq('is_active', true)");
    expect(hookSource).toContain(".eq('is_archived', false)");
    expect(hookSource).toContain('activityJobsResult.data');
    expect(hookSource).toContain('createdJobsResult.data');
  });

  it('uses a hidden-scrollbar timeline with the full 8 AM to 5 PM business view', () => {
    expect(pulseSource).toContain('return 11 / 9');
    expect(pulseSource).toContain('className="pulse-wave-scroll"');
    expect(pulseSource).toContain('timeline.scrollWidth / 11');
    expect(pulseSource).toContain('timelineZoom * 100');
  });

  it('supports independent centered button zoom down to two hours', () => {
    expect(pulseSource).toContain('function timelineScaleForStep(');
    expect(pulseSource).toContain('const visibleHours = step === 1 ? 4 : 2');
    expect(pulseSource).toContain('function centeredZoomTarget(');
    expect(pulseSource).toContain('const visibleEvents = eventFractions.filter');
    expect(pulseSource).toContain('candidateCount > bestCount');
    expect(pulseSource).not.toContain('synchronizeTimelines');
    expect(pulseSource).toContain('zoomAnchorsRef.current[phase]');
    expect(pulseSource).toContain('pointerFraction = 0.5');
    expect(pulseSource).not.toContain('onWheel=');
    expect(pulseSource).toContain("onClick={() => adjustTimelineZoom(definition.phase, 'out', phaseData.events)}");
    expect(pulseSource).toContain("onClick={() => adjustTimelineZoom(definition.phase, 'in', phaseData.events)}");
    expect(pulseSource).toContain('Drag left or right to move through time');
    expect(pulseSource).toContain('onMouseLeave={() => scheduleZoomReset(definition.phase)}');
    expect(pulseSource).toContain('}, 5000)');
  });

  it('keeps point details on hover and replaces permanent labels with a visible range', () => {
    expect(pulseSource).toContain('role="tooltip"');
    expect(pulseSource).toContain('createPortal');
    expect(pulseSource).toContain('onMouseEnter={(pointerEvent) => showEventTooltip');
    expect(pulseSource).not.toContain('title={eventTitle(event)}');
    expect(pulseSource).not.toContain('eventPointLabel(');
    expect(pulseSource).toContain('data-range-start');
    expect(pulseSource).toContain('data-range-end');
  });

  it('shows Pending Work Order decisions and manual skips instead of phase entry and exit totals', () => {
    expect(hookSource).toContain(".from('approval_tokens')");
    expect(hookSource).toContain("next['Pending Work Order'].skipped += 1");
    expect(hookSource).toContain("activityType: 'pending_outcome'");
    expect(pulseSource).toContain('{phaseData.approved} Approvals');
    expect(pulseSource).toContain('{phaseData.declined} Declines');
    expect(pulseSource).toContain('{phaseData.skipped} Bypassed');
  });

  it('keeps all five pulse cards on one row outside the mobile layout', () => {
    expect(pulseSource).toContain('grid grid-cols-1 gap-2 md:grid-cols-5');
    expect(pulseSource).not.toContain('lg:grid-cols-3');
  });

  it('anchors every event point to its exact waveform peak or trough', () => {
    expect(pulseSource).toContain('function eventPeakY(');
    expect(pulseSource).toContain('const x = (eventPosition(event.timestamp, period) / 100) * 440');
    expect(pulseSource).toContain('top: `${(eventPeakY(event, phaseData.events) / 52) * 100}%`');
    expect(pulseSource).not.toContain('previousX + 24');
  });

  it('keeps every activity point above the center line', () => {
    expect(pulseSource).toContain('return 7 + (index % 3) * 3');
    expect(pulseSource).not.toContain("event.direction === 'entered' ? 7");
  });

  it('supports click-and-drag timeline scrolling without intercepting point buttons', () => {
    expect(pulseSource).toContain("event.pointerType !== 'mouse'");
    expect(pulseSource).toContain("closest('button')");
    expect(pulseSource).toContain('onPointerDown={startTimelineDrag}');
    expect(pulseSource).toContain('onPointerMove={moveTimelineDrag}');
    expect(pulseSource).toContain('drag.element.scrollLeft = drag.startScrollLeft');
  });

  it('returns each variable pulse peak directly to the center line', () => {
    expect(pulseSource).toContain('L${x + 8} 26');
    expect(pulseSource).not.toContain('L${x + 7} 36');
    expect(pulseSource).not.toContain('L${center + 7} 34');
  });

  it('replaces the Quality Control card with live admin and subcontractor activity', () => {
    expect(pulseSource).toContain("definition.phase === 'Quality Control'");
    expect(pulseSource).toContain('<UserActivityPulseCard key="user-activity" />');
    expect(userActivitySource).toContain('User Activity');
    expect(userActivitySource).toContain('Live Only');
    expect(userActivitySource).toContain('admins.length');
    expect(userActivitySource).toContain('subcontractors.length');
    expect(userActivitySource).toContain("user.role === 'subcontractor' ? SUBCONTRACTOR_COLOR : ADMIN_COLOR");
    expect(userActivitySource).toContain('function userLabel(user: ActivityUser)');
    expect(userActivitySource).toContain('user.display_name || user.email || `User ${user.user_id.slice(0, 8)}`');
    expect(userActivitySource).not.toContain('Name unavailable');
    expect(userActivitySource).toContain(".select('id, full_name, email')");
    expect(userActivitySource).toContain(".in('id', userIds)");
    expect(userActivitySource).toContain('profileLabels.get(user.user_id) || user.display_name');
    expect(usePresenceSource.replace(/\s/g, '')).toContain(".select('role,full_name')");
    expect(usePresenceSource).toContain('profileData?.full_name || user.user_metadata?.full_name || user.email');
    expect(userActivitySource).toContain('{subcontractors.length} Subs <span');
    expect(userActivitySource).toContain('activity_level');
    expect(userActivitySource).toContain('role="tooltip"');
    expect(presenceSource).toContain('last_activity_at');
    expect(presenceSource).toContain('activity_level');
    expect(presenceSource).toContain('private engagementScore = 0.18');
    expect(presenceSource).toContain('this.engagementScore + 0.1');
    expect(presenceSource).toContain('this.engagementScore - 0.08');
    expect(presenceSource).toContain('this.engagementScore * freshness');
    expect(presenceSource).toContain('this.trackActivity(false, true)');
    expect(presenceSource).toContain("context_type: (jobMatch");
    expect(presenceSource).toContain('setInterval(() => void this.trackActivity(true), 15000)');
    expect(presenceSource).toContain('this.listeners.forEach((listener)');
    expect(userActivitySource).toContain('className="pulse-wave__trail"');
    expect(userActivitySource).toContain('className="pulse-wave__line"');
    expect(userActivitySource).toContain('className="pulse-wave__moving-dot"');
    expect(userActivitySource).toContain('path={buildPresenceLine(users, 28)}');
    expect(userActivitySource).not.toContain('path={buildPresenceLine(admins, 20)}');
    expect(userActivitySource).not.toContain('path={buildPresenceLine(subcontractors, 45)}');
    expect(userActivitySource).toContain('className="pulse-wave__event absolute');
    expect(styleSource).toContain('@keyframes operations-pulse-trace');
    expect(styleSource).toContain('stroke-dashoffset: 18');
    expect(styleSource).toContain('stroke-dashoffset: -82');
    expect(styleSource).toContain('17%, 100%');
    expect(styleSource).toContain('stroke-width: 1.2');
    expect(styleSource).toContain('opacity: 0.24');
  });

  it('uses the 7 AM through 6 PM operating window for Today and Yesterday', () => {
    expect(hookSource).toContain("yyyy-MM-dd'T'07:00:00XXX");
    expect(hookSource).toContain("yyyy-MM-dd'T'18:00:00XXX");
    expect(pulseSource).toContain("yyyy-MM-dd'T'07:00:00XXX");
    expect(pulseSource).toContain("yyyy-MM-dd'T'18:00:00XXX");
    expect(pulseSource).toContain("? timeline.scrollWidth / 11 : 0");
  });

  it('distinguishes current phase totals from period activity', () => {
    expect(pulseSource).toContain('Current phase totals as of now; activity shown for {pulse.periodLabel}.');
    expect(pulseSource).toContain('return "Today\'s activity"');
    expect(pulseSource).toContain('return "Yesterday\'s activity"');
    expect(pulseSource).toContain("return '7-day activity'");
    expect(pulseSource).toContain("return '30-day activity'");
  });
});
