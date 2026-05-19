/**
 * CalendarDevPage.tsx — DEV ONLY (not the live /calendar page)
 *
 * Includes ALL features from the existing Calendar.tsx plus new ones:
 *   Existing: phase filter, calendar events (create/view/edit/delete), recurring events,
 *             subscribe modal, day popup, job type totals, real-time subscriptions
 *   New:      drag-and-drop rescheduling (HTML5, smooth), scrollable +N expand cells,
 *             week/day/agenda views (react-big-calendar), filter by subcontractor,
 *             job click modal with "Go to Job / Go to Property" buttons
 *
 * TO GO LIVE:
 *  1. Change Route path="calendar-dev" → "calendar" in Dashboard.tsx
 *  2. Remove the old Calendar Route + lazy import above it
 *  3. Delete the amber dev-banner <div> (one block, clearly commented below)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addDays,
  isSameMonth,
  isToday,
  parseISO,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import {
  X,
  User,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  CalendarDays,
  Clock,
  List,
  Filter,
  Check,
  ExternalLink,
  Building2,
  RefreshCw,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

import { supabase } from '../../utils/supabase';
import { useUserRole } from '../../contexts/UserRoleContext';
import { listCalendarEvents } from '../../services/calendarEvents';
import type { CalendarEvent } from '../../types/calendar';
import { getRecurringEventsForDay } from '../../utils/recurringEvents';
import EventModal from '../calendar/EventModal';
import EventDetailsModal from '../calendar/EventDetailsModal';
import SubscribeCalendarsModal from '../calendar/SubscribeCalendarsModal';
import { dispatchSmsNotification } from '../../lib/sms/dispatchSmsNotification';
import { formatDisplayDate } from '../../lib/dateUtils';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// ─── RBC Localizer ──────────────────────────────────────────────────────────────
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay, locales,
});
const DnDCalendar = withDragAndDrop(Calendar);

const TZ = 'America/New_York';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const INITIAL_VISIBLE = 3;

// ─── Types ───────────────────────────────────────────────────────────────────────
interface SubcontractorProfile { id: string; full_name: string | null; email: string | null; }

interface CalJob {
  id: string;
  workOrderNum: number;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  description: string | null;
  phaseName: string;
  phaseColor: string;
  jobTypeLabel: string;
  assignedTo: string | null;
  assignedToName: string | null;
  purchaseOrder: string | null;
  scheduledDateRaw: string; // "YYYY-MM-DD"
}

interface JobPhase { id: string; job_phase_label: string; color_dark_mode: string; }

interface RBCEvent {
  id: string; title: string; start: Date; end: Date; allDay: boolean; resource: CalJob | CalendarEvent; type: 'job' | 'event';
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

// ─── Helpers ─────────────────────────────────────────────────────────────────────
function dateToStr(d: Date): string { return format(d, 'yyyy-MM-dd'); }
function strToDate(s: string): Date { return new Date(`${s}T00:00:00`); }
function jobToRBC(job: CalJob): RBCEvent {
  const assignedText = job.assignedToName ? ` · ${job.assignedToName}` : ' · Unassigned';
  return {
    id: `job-${job.id}`,
    title: `WO-${String(job.workOrderNum).padStart(6, '0')} · ${job.propertyName} #${job.unitNumber}${assignedText}`,
    start: strToDate(job.scheduledDateRaw),
    end: strToDate(job.scheduledDateRaw),
    allDay: true,
    resource: job,
    type: 'job',
  };
}
function eventToRBC(event: CalendarEvent): RBCEvent {
  return {
    id: `event-${event.id}`,
    title: event.title,
    start: parseISO(event.start_at),
    end: parseISO(event.end_at),
    allDay: event.is_all_day,
    resource: event,
    type: 'event',
  };
}
function getEasternNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

// ─── Job type totals ──────────────────────────────────────────────────────────────
function getJobTypeTotals(jobs: CalJob[]) {
  let paint = 0, callback = 0, repair = 0;
  jobs.forEach((j) => {
    const t = j.jobTypeLabel.toLowerCase();
    if (t.includes('paint')) paint++;
    else if (t.includes('callback')) callback++;
    else if (t.includes('repair')) repair++;
    else paint++; // default
  });
  return { paint, callback, repair, total: paint + callback + repair };
}

// ─── Job Detail Modal ─────────────────────────────────────────────────────────────
interface JobDetailModalProps {
  job: CalJob;
  subcontractors: SubcontractorProfile[];
  onClose: () => void;
  onSaved: (updatedJob: CalJob) => void;
}
function JobDetailModal({ job, subcontractors, onClose, onSaved }: JobDetailModalProps) {
  const [selectedSubId, setSelectedSubId] = useState(job.assignedTo || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newSubId = selectedSubId || null;
    const previousSubId = job.assignedTo || null;
    const newSubName = subcontractors.find((s) => s.id === newSubId)?.full_name || null;
    const subcontractor = subcontractors.find((s) => s.id === newSubId);
    
    try {
      // Only proceed if assignment actually changed
      if (previousSubId === newSubId) {
        toast('No changes to save', { icon: 'ℹ️' });
        setSaving(false);
        return;
      }

      // Calculate assignment deadline if this is a new assignment
      let assignedAt = new Date().toISOString();
      let assignmentDeadline: string | null = null;

      if (newSubId) {
        const { data: deadlineData, error: deadlineError } = await supabase
          .rpc('calculate_assignment_deadline', { p_assigned_at: assignedAt });
        
        if (deadlineError) {
          console.error('Error calculating deadline:', deadlineError);
          // Fallback: set deadline to 3:30 PM ET today or next business day
          const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
          const deadline = new Date(etNow);
          deadline.setHours(15, 30, 0, 0); // 3:30 PM
          if (etNow.getHours() >= 15 && etNow.getMinutes() >= 30) {
            deadline.setDate(deadline.getDate() + 1);
          }
          assignmentDeadline = deadline.toISOString();
        } else {
          assignmentDeadline = deadlineData;
        }
      }

      // Update the job assignment
      const { error } = await supabase.from('jobs').update({ 
        assigned_to: newSubId,
        assigned_at: newSubId ? assignedAt : null,
        assignment_deadline: assignmentDeadline,
        assignment_status: newSubId ? 'pending' : null,
        assignment_decision_at: null,
      }).eq('id', job.id);
      
      if (error) throw error;

      // Send email and SMS notification if assigning to a new subcontractor
      if (newSubId && subcontractor) {
        await sendAssignmentNotification(job, subcontractor);
      }

      toast.success(newSubName ? `Assigned to ${newSubName}` : 'Assignment cleared');
      onSaved({ ...job, assignedTo: newSubId, assignedToName: newSubName });
    } catch (err) {
      console.error('Failed to save assignment:', err);
      toast.error('Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const sendAssignmentNotification = async (job: CalJob, subcontractor: SubcontractorProfile) => {
    try {
      // Create assignment decision token
      const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${job.id}-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const sentAt = new Date().toISOString();

      const { error: tokenError } = await supabase.from('assignment_tokens').insert({
        job_id: job.id,
        subcontractor_id: subcontractor.id,
        token,
        expires_at: expiresAt,
        sent_at: sentAt
      });

      if (tokenError) {
        console.error('Error creating assignment token:', tokenError);
      }

      // Send email notification if subcontractor has an email
      if (subcontractor.email) {
        const firstName = subcontractor.full_name?.split(' ')[0] || subcontractor.full_name || 'there';
        const subject = 'New Job Assignment – Please Accept or Decline';
        const scheduledDate = formatDisplayDate(job.scheduledDateRaw);
        const decisionUrl = token
          ? `https://portal.jgpaintingprosinc.com/assignment/decision?token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(job.id)}`
          : 'https://portal.jgpaintingprosinc.com/dashboard/subcontractor';

        const html = `
          <p>Hi ${firstName},</p>
          <p>You have been assigned to the following job. Please review and accept or decline:</p>
          <ul>
            <li style="margin-bottom: 18px; padding: 14px 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
              <div style="font-weight: 600; color: #111827; font-size: 15px;">${job.propertyName}</div>
              <div style="margin-top: 6px; color: #374151; font-size: 14px;">
                <div><strong>Work Order:</strong> WO-${String(job.workOrderNum).padStart(6, '0')}</div>
                <div><strong>Unit:</strong> #${job.unitNumber}</div>
                <div><strong>Scheduled Date:</strong> ${scheduledDate}</div>
              </div>
              <div style="margin-top: 12px;">
                <a href="${decisionUrl}" style="display: inline-block; padding: 12px 16px; background: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Review &amp; Accept / Decline
                </a>
              </div>
              <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">This link is unique to this assignment and expires in 7 days.</div>
            </li>
          </ul>
          <p style="margin-top: 16px;">You can also log in to your dashboard to review: <a href="https://portal.jgpaintingprosinc.com/dashboard/subcontractor">https://portal.jgpaintingprosinc.com/dashboard/subcontractor</a></p>
          <p>Thank you,<br/>JG Painting Pros Inc.</p>
        `;

        const text = `Hi ${firstName},

You have been assigned to the following job. Please review and accept or decline:

${job.propertyName}
Work Order: WO-${String(job.workOrderNum).padStart(6, '0')}
Unit: #${job.unitNumber}
Scheduled Date: ${scheduledDate}
Respond: ${decisionUrl}

Log in to view details: https://portal.jgpaintingprosinc.com/dashboard/subcontractor

Thank you,
JG Painting Pros Inc.`;

        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: subcontractor.email,
            subject,
            html,
            text
          }
        });

        if (emailError) {
          console.error('Error sending assignment email:', emailError);
        } else {
          // Log the email
          const { error: logError } = await supabase.from('email_logs').insert({
            job_id: job.id,
            recipient_email: subcontractor.email,
            subject,
            content: text,
            notification_type: 'sub_assignment',
            template_id: 'assignment_decision',
            cc_emails: null,
            bcc_emails: null
          });

          if (logError) {
            console.error('Error logging assignment email:', logError);
          }
        }
      }

      // Send SMS notification (best-effort)
      dispatchSmsNotification({
        eventType: 'job_assigned',
        recipientUserId: subcontractor.id,
        job_id: job.id,
        context: {
          subcontractorName: subcontractor.full_name || subcontractor.email || 'Subcontractor',
          jobCount: 1,
          jobIds: [job.id],
          workOrderNums: [job.workOrderNum],
          workOrderNum: job.workOrderNum,
          propertyName: job.propertyName,
        },
      });
    } catch (err) {
      console.error('Error sending assignment notification:', err);
      // Don't throw - notification failures shouldn't prevent assignment
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-200 dark:border-[#2D3B4E]">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              WO-{String(job.workOrderNum).padStart(6, '0')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{job.propertyName} · Unit #{job.unitNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-3 flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2 px-6 py-3 bg-gray-50 dark:bg-[#0F172A]/40 border-b border-gray-200 dark:border-[#2D3B4E]">
          <Link
            to={`/dashboard/jobs/${job.id}`}
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View Job
          </Link>
          <Link
            to={`/dashboard/properties/${job.propertyId}`}
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] hover:bg-gray-50 dark:hover:bg-[#2D3B4E] rounded-lg transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" /> View Property
          </Link>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Scheduled</p>
              <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                {format(strToDate(job.scheduledDateRaw), 'MMM d, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Phase</p>
              <span className="inline-block px-2 py-0.5 rounded-full text-white text-xs" style={{ backgroundColor: job.phaseColor }}>
                {job.phaseName}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Type</p>
              <p className="text-gray-700 dark:text-gray-300">{job.jobTypeLabel}</p>
            </div>
            {job.purchaseOrder && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">PO #</p>
                <p className="text-gray-700 dark:text-gray-300">{job.purchaseOrder}</p>
              </div>
            )}
          </div>
          {job.description && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Description</p>
              <p className="text-gray-700 dark:text-gray-300 text-xs">{job.description}</p>
            </div>
          )}

          {/* Subcontractor assignment */}
          <div className="pt-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Assign Subcontractor</label>
            <select
              value={selectedSubId}
              onChange={(e) => setSelectedSubId(e.target.value)}
              className="w-full border border-gray-300 dark:border-[#2D3B4E] rounded-lg px-3 py-2 bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">— Unassigned —</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name || s.id}</option>
              ))}
            </select>
            {job.assignedToName && (
              <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                <User className="h-3 w-3" /> Currently: {job.assignedToName}
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 px-6 pb-5 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Day Popup Modal ─────────────────────────────────────────────────────────────
interface DayPopupProps {
  date: Date;
  jobs: CalJob[];
  events: CalendarEvent[];
  onClose: () => void;
  onJobClick: (job: CalJob) => void;
  onEventClick: (evt: CalendarEvent) => void;
}
function DayPopupModal({ date, jobs, events, onClose, onJobClick, onEventClick }: DayPopupProps) {
  const totals = getJobTypeTotals(jobs);
  const filteredEvents = events.filter(
    (e) => !(e.title.includes('Paint') && e.title.includes('Callback') && e.title.includes('Repair'))
  );
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-[#2D3B4E]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isToday(date) ? "Today's Agenda" : format(date, 'EEEE, MMMM d, yyyy')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        {totals.total > 0 && (
          <div className="grid grid-cols-4 gap-4 text-center px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-[#2D3B4E]">
            {[
              { label: 'Paint', val: totals.paint, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Callback', val: totals.callback, color: 'text-orange-500 dark:text-orange-400' },
              { label: 'Repair', val: totals.repair, color: 'text-red-500 dark:text-red-400' },
              { label: 'Total', val: totals.total, color: 'text-purple-700 dark:text-purple-400' },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className={`text-xs ${color}`}>{label}</div>
              </div>
            ))}
          </div>
        )}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => onJobClick(job)}
              className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
              style={{ backgroundColor: `${job.phaseColor}0A` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">WO-{String(job.workOrderNum).padStart(6, '0')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{job.propertyName} · Unit #{job.unitNumber}</p>
                  {job.assignedToName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      <User className="h-3 w-3" /> {job.assignedToName}
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-1 rounded-full text-white" style={{ backgroundColor: job.phaseColor }}>
                  {job.phaseName}
                </span>
              </div>
            </div>
          ))}
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onEventClick(evt)}
              className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
              style={{ backgroundColor: `${evt.color}0A` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{evt.title}</p>
                  {evt.details && <p className="text-sm text-gray-500 dark:text-gray-400">{evt.details}</p>}
                </div>
                <span className="text-xs px-2 py-1 rounded-full text-white" style={{ backgroundColor: evt.color }}>Event</span>
              </div>
            </div>
          ))}
          {jobs.length === 0 && filteredEvents.length === 0 && (
            <p className="text-center text-gray-400 py-8">No jobs or events for this day</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Custom Month Day Cell ────────────────────────────────────────────────────────
interface DayCellProps {
  date: Date;
  currentMonth: Date;
  jobs: CalJob[];
  calEvents: CalendarEvent[];
  filterSubId: string;
  selectedPhases: string[];
  draggingId: string | null;
  onDragStart: (job: CalJob) => void;
  onDrop: (targetDateStr: string) => void;
  onJobClick: (job: CalJob) => void;
  onEventClick: (evt: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
  isSelected: boolean;
}

function DayCell({
  date, currentMonth, jobs, calEvents, filterSubId, selectedPhases,
  draggingId, onDragStart, onDrop, onJobClick, onEventClick, onDayClick, isSelected,
}: DayCellProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isTodays = isToday(date);

  const visibleJobs = useMemo(
    () => filterSubId === 'all' ? jobs : jobs.filter((j) => j.assignedTo === filterSubId),
    [jobs, filterSubId],
  );

  const visibleEvents = useMemo(() => {
    if (selectedPhases.length > 0 && !selectedPhases.includes('Events')) return [];
    return calEvents.filter((e) => !(e.title.includes('Paint') && e.title.includes('Callback') && e.title.includes('Repair')));
  }, [calEvents, selectedPhases]);

  const allItems = [...visibleEvents.map((e) => ({ type: 'event' as const, item: e })), ...visibleJobs.map((j) => ({ type: 'job' as const, item: j }))];
  const displayed = expanded ? allItems : allItems.slice(0, INITIAL_VISIBLE);
  const hiddenCount = allItems.length - INITIAL_VISIBLE;
  const totals = getJobTypeTotals(visibleJobs);

  return (
    <div
      className={`min-h-[110px] flex flex-col border-b border-r border-gray-200 dark:border-[#2D3B4E] transition-colors duration-100 cursor-pointer
        ${!isCurrentMonth ? 'bg-gray-50 dark:bg-[#0a1120]' : 'bg-white dark:bg-[#1E293B] hover:bg-gray-50/50 dark:hover:bg-[#1a2942]'}
        ${isTodays ? 'ring-inset ring-2 ring-blue-400 dark:ring-blue-500' : ''}
        ${isSelected ? 'ring-inset ring-2 ring-purple-400 dark:ring-purple-500' : ''}
        ${isDragOver ? '!bg-blue-50 dark:!bg-blue-900/25 ring-inset ring-2 ring-blue-400' : ''}
      `}
      onClick={() => onDayClick(date)}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onDrop(dateToStr(date)); }}
    >
      {/* Date number + totals */}
      <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5">
        <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
          ${isTodays ? 'bg-blue-500 text-white' : isCurrentMonth ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>
          {format(date, 'd')}
        </span>
        {totals.total > 0 && (
          <div className="text-[9px] font-semibold flex gap-0.5">
            {totals.paint > 0 && <span className="text-blue-600 dark:text-blue-400">{totals.paint}P</span>}
            {totals.callback > 0 && <span className="text-orange-500 dark:text-orange-400">{totals.callback}C</span>}
            {totals.repair > 0 && <span className="text-red-500 dark:text-red-400">{totals.repair}R</span>}
            <span className="text-purple-700 dark:text-purple-400">|{totals.total}</span>
          </div>
        )}
      </div>

      {/* Items — scrollable when expanded */}
      <div
        ref={scrollRef}
        className={`flex-1 px-1 pb-0.5 space-y-0.5 ${expanded ? 'overflow-y-auto max-h-44' : 'overflow-hidden'}`}
        style={{ scrollbarWidth: 'thin' }}
      >
        {displayed.map(({ type, item }) =>
          type === 'event' ? (
            <div
              key={`ev-${(item as CalendarEvent).id}`}
              onClick={(e) => { e.stopPropagation(); onEventClick(item as CalendarEvent); }}
              className="w-full rounded px-1.5 py-[3px] cursor-pointer transition-all duration-100 hover:brightness-110 hover:shadow-sm"
              style={{ backgroundColor: `${(item as CalendarEvent).color}22`, borderLeft: `3px solid ${(item as CalendarEvent).color}` }}
            >
              <div className="text-[10px] font-semibold truncate leading-tight" style={{ color: (item as CalendarEvent).color }}>
                {(item as CalendarEvent).title}
              </div>
            </div>
          ) : (
            <div
              key={`job-${(item as CalJob).id}`}
              draggable
              onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; onDragStart(item as CalJob); }}
              onClick={(e) => { e.stopPropagation(); onJobClick(item as CalJob); }}
              className={`w-full rounded px-1.5 py-[3px] cursor-grab active:cursor-grabbing transition-all duration-150 select-none
                ${draggingId === (item as CalJob).id ? 'opacity-30 scale-95' : 'hover:brightness-110 hover:shadow-sm'}`}
              style={{ backgroundColor: `${(item as CalJob).phaseColor}22`, borderLeft: `3px solid ${(item as CalJob).phaseColor}` }}
              title={`WO-${String((item as CalJob).workOrderNum).padStart(6, '0')} · ${(item as CalJob).propertyName}\nUnit: ${(item as CalJob).unitNumber}${(item as CalJob).assignedToName ? `\nAssigned: ${(item as CalJob).assignedToName}` : '\nUnassigned'}`}
            >
              <div className="text-[10px] font-semibold truncate leading-tight" style={{ color: (item as CalJob).phaseColor }}>
                WO-{String((item as CalJob).workOrderNum).padStart(6, '0')}
              </div>
              <div className="text-[10px] text-gray-600 dark:text-gray-400 truncate leading-tight">
                {(item as CalJob).propertyName} #{(item as CalJob).unitNumber}
              </div>
              <div className="text-[9px] text-gray-500 dark:text-gray-500 truncate leading-tight italic">
                {(item as CalJob).assignedToName || 'Unassigned'}
              </div>
            </div>
          )
        )}
      </div>

      {/* +N expand / collapse */}
      {hiddenCount > 0 && !expanded && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="flex items-center gap-0.5 px-2 pb-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
        >
          +{hiddenCount} more <ChevronDown className="h-2.5 w-2.5" />
        </button>
      )}
      {expanded && allItems.length > INITIAL_VISIBLE && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="flex items-center gap-0.5 px-2 pb-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────────
export function CalendarDevPage() {
  const { role } = useUserRole?.() || { role: 'user' };
  const canCreateEvents = ['admin', 'jg_management', 'is_super_admin'].includes(role);

  const [jobs, setJobs] = useState<CalJob[]>([]);
  const [allJobs, setAllJobs] = useState<CalJob[]>([]); // for totals (not phase-filtered)
  const [loading, setLoading] = useState(true);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [phases, setPhases] = useState<JobPhase[]>([]);
  const [selectedPhases, setSelectedPhases] = useState<string[]>(['Job Request', 'Work Order', 'Pending Work Order', 'Events']);
  const [showPhaseFilter, setShowPhaseFilter] = useState(false);

  const [currentDate, setCurrentDate] = useState(getEasternNow);
  const [selectedDate, setSelectedDate] = useState(getEasternNow); // For Today's Agenda sidebar
  const [view, setView] = useState<ViewMode>('month');
  const [subcontractors, setSubcontractors] = useState<SubcontractorProfile[]>([]);
  const [filterSubId, setFilterSubId] = useState<string>('all');
  const [draggingJob, setDraggingJob] = useState<CalJob | null>(null);
  const [showAgendaSidebar, setShowAgendaSidebar] = useState(true); // Toggle for Today's Agenda

  // Modals
  const [selectedJob, setSelectedJob] = useState<CalJob | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [dayPopup, setDayPopup] = useState<Date | null>(null);

  // ── Phase filter helpers ───────────────────────────────────────────────────────
  const togglePhase = (label: string) =>
    setSelectedPhases((prev) => prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label]);

  // ── Fetch phases ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('job_phases').select('id, job_phase_label, color_dark_mode').neq('job_phase_label', 'Grading').order('sort_order')
      .then(({ data }) => {
        const eventsPhase = { id: 'events-virtual', job_phase_label: 'Events', color_dark_mode: '#3b82f6' };
        setPhases([eventsPhase, ...(data || [])]);
      });
  }, []);

  // ── Fetch subcontractors ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email').eq('role', 'subcontractor').order('full_name')
      .then(({ data }) => setSubcontractors((data as SubcontractorProfile[]) || []));
  }, []);

  // ── Fetch jobs ─────────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async (date: Date, activePhases: string[]) => {
    setLoading(true);
    try {
      const start = formatInTimeZone(startOfMonth(date), TZ, "yyyy-MM-dd'T'00:00:00XXX");
      const end = formatInTimeZone(endOfMonth(date), TZ, "yyyy-MM-dd'T'23:59:59XXX");

      // All non-cancelled/archived phases for totals
      const { data: allPhaseData } = await supabase.from('job_phases').select('id')
        .not('job_phase_label', 'eq', 'Cancelled').not('job_phase_label', 'eq', 'Archived');
      const allPhaseIds = (allPhaseData || []).map((p: { id: string }) => p.id);

      // Phase-filtered for display
      let displayPhaseIds: string[] = [];
      if (activePhases.length > 0) {
        const phaseLabels = activePhases.filter((p) => p !== 'Events');
        if (phaseLabels.length > 0) {
          const { data: phaseData } = await supabase.from('job_phases').select('id').in('job_phase_label', phaseLabels);
          displayPhaseIds = (phaseData || []).map((p: { id: string }) => p.id);
        }
      } else {
        const { data: phaseData } = await supabase.from('job_phases').select('id').in('job_phase_label', ['Job Request', 'Work Order', 'Pending Work Order']);
        displayPhaseIds = (phaseData || []).map((p: { id: string }) => p.id);
      }

      const jobSelect = `
        id, work_order_num, scheduled_date, unit_number, description, purchase_order, assigned_to,
        property:properties ( id, property_name ),
        job_phase:current_phase_id ( job_phase_label, color_dark_mode ),
        job_type:job_types ( job_type_label ),
        profiles:assigned_to ( full_name )
      `;

      const mapJob = (job: any): CalJob => {
        const prop = Array.isArray(job.property) ? job.property[0] : job.property;
        const phase = Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase;
        const jtype = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
        const prof = Array.isArray(job.profiles) ? job.profiles[0] : job.profiles;
        return {
          id: job.id,
          workOrderNum: job.work_order_num,
          propertyId: prop?.id || '',
          propertyName: prop?.property_name || 'Unknown',
          unitNumber: job.unit_number,
          description: job.description || null,
          phaseName: phase?.job_phase_label || 'Unknown',
          phaseColor: phase?.color_dark_mode || '#6B7280',
          jobTypeLabel: jtype?.job_type_label || 'Unknown',
          assignedTo: job.assigned_to,
          assignedToName: prof?.full_name || null,
          purchaseOrder: job.purchase_order || null,
          scheduledDateRaw: job.scheduled_date.split('T')[0],
        };
      };

      const [displayResult, allResult] = await Promise.all([
        displayPhaseIds.length > 0
          ? supabase.from('jobs').select(jobSelect).in('current_phase_id', displayPhaseIds).gte('scheduled_date', start).lte('scheduled_date', end)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('jobs').select(jobSelect).in('current_phase_id', allPhaseIds).gte('scheduled_date', start).lte('scheduled_date', end),
      ]);

      setJobs((displayResult.data || []).map(mapJob));
      setAllJobs((allResult.data || []).map(mapJob));
    } catch (err) {
      console.error('[CalendarDev] fetch error:', err);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(currentDate, selectedPhases); }, [currentDate, selectedPhases, fetchJobs]);

  // ── Fetch calendar events ──────────────────────────────────────────────────────
  const fetchCalEvents = useCallback(async (date: Date) => {
    try {
      const startISO = formatInTimeZone(startOfMonth(date), TZ, "yyyy-MM-dd'T'00:00:00XXX");
      const endISO = formatInTimeZone(endOfMonth(date), TZ, "yyyy-MM-dd'T'23:59:59XXX");
      const evts = await listCalendarEvents(startISO, endISO);
      setCalEvents(evts);
    } catch (e) { console.error('[CalendarDev] events error:', e); }
  }, []);

  useEffect(() => { fetchCalEvents(currentDate); }, [currentDate, fetchCalEvents]);

  // ── Real-time subscriptions ────────────────────────────────────────────────────
  useEffect(() => {
    const jobSub = supabase.channel('caldev_jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchJobs(currentDate, selectedPhases))
      .subscribe();
    const evtSub = supabase.channel('caldev_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => fetchCalEvents(currentDate))
      .subscribe();
    return () => { supabase.removeChannel(jobSub); supabase.removeChannel(evtSub); };
  }, [currentDate, selectedPhases, fetchJobs, fetchCalEvents]);

  // ── Calendar event helpers (recurring) ────────────────────────────────────────
  const getEventsForDay = useCallback((date: Date): CalendarEvent[] => {
    if (selectedPhases.length > 0 && !selectedPhases.includes('Events')) return [];
    const calDate = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const result: CalendarEvent[] = [];
    calEvents.forEach((event) => {
      if (event.parent_event_id) return;
      const eventStart = parseISO(event.start_at);
      const eventEnd = parseISO(event.end_at);
      const eventStartDate = formatInTimeZone(eventStart, TZ, 'yyyy-MM-dd');
      const eventEndDate = formatInTimeZone(eventEnd, TZ, 'yyyy-MM-dd');

      if (event.is_recurring && event.recurrence_type) {
        result.push(...getRecurringEventsForDay([event], date, TZ));
      } else {
        const include = event.is_all_day
          ? calDate >= eventStartDate && calDate < eventEndDate
          : eventStartDate === calDate;
        if (include) result.push(event);
      }
    });
    return result;
  }, [calEvents, selectedPhases]);

  // ── Month grid ─────────────────────────────────────────────────────────────────
  const monthDays = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [currentDate]);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, CalJob[]>();
    // If only Events selected, show no jobs
    if (selectedPhases.length === 1 && selectedPhases.includes('Events')) return map;
    jobs.forEach((job) => {
      const d = job.scheduledDateRaw;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(job);
    });
    return map;
  }, [jobs, selectedPhases]);

  const allJobsByDate = useMemo(() => {
    const map = new Map<string, CalJob[]>();
    allJobs.forEach((job) => {
      const d = job.scheduledDateRaw;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(job);
    });
    return map;
  }, [allJobs]);

  // ── RBC events (week/day/agenda) - includes both jobs AND calendar events ─────
  const rbcEvents = useMemo(() => {
    const jobEvents = filterSubId === 'all' ? jobs : jobs.filter((j) => j.assignedTo === filterSubId);
    const rbcJobs = jobEvents.map(jobToRBC);
    
    // Include calendar events if "Events" is in the phase filter or no filter is active
    let rbcCalEvents: RBCEvent[] = [];
    if (selectedPhases.length === 0 || selectedPhases.includes('Events')) {
      // Get all calendar events within the current view's date range
      rbcCalEvents = calEvents
        .filter((e) => !e.parent_event_id) // Exclude recurring instances (handled by getEventsForDay)
        .filter((e) => !(e.title.includes('Paint') && e.title.includes('Callback') && e.title.includes('Repair')))
        .map(eventToRBC);
    }
    
    return [...rbcJobs, ...rbcCalEvents];
  }, [jobs, calEvents, filterSubId, selectedPhases]);

  // ── Month DnD ──────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((job: CalJob) => setDraggingJob(job), []);

  const handleDrop = useCallback(async (targetDateStr: string) => {
    const job = draggingJob;
    setDraggingJob(null);
    if (!job || job.scheduledDateRaw === targetDateStr) return;
    const originalDate = job.scheduledDateRaw;
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, scheduledDateRaw: targetDateStr } : j));
    setAllJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, scheduledDateRaw: targetDateStr } : j));
    try {
      const { error } = await supabase.from('jobs').update({ scheduled_date: `${targetDateStr}T00:00:00` }).eq('id', job.id);
      if (error) throw error;
      toast.success(`WO-${String(job.workOrderNum).padStart(6, '0')} → ${format(strToDate(targetDateStr), 'MMM d, yyyy')}`);
    } catch {
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, scheduledDateRaw: originalDate } : j));
      setAllJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, scheduledDateRaw: originalDate } : j));
      toast.error('Failed to reschedule — reverted.');
    }
  }, [draggingJob]);

  // ── RBC DnD (week/day) - only allow dragging jobs, not events ─────────────────
  const handleRBCEventDrop = useCallback(async ({ event, start }: { event: RBCEvent; start: Date | string }) => {
    // Only allow dragging jobs, not calendar events
    if (event.type !== 'job') return;
    
    const newDate = typeof start === 'string' ? new Date(start) : start;
    const newDateStr = dateToStr(newDate);
    const job = event.resource as CalJob;
    if (job.scheduledDateRaw === newDateStr) return;
    const originalDate = job.scheduledDateRaw;
    const update = (d: string) => {
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, scheduledDateRaw: d } : j));
      setAllJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, scheduledDateRaw: d } : j));
    };
    update(newDateStr);
    try {
      const { error } = await supabase.from('jobs').update({ scheduled_date: `${newDateStr}T00:00:00` }).eq('id', job.id);
      if (error) throw error;
      toast.success(`WO-${String(job.workOrderNum).padStart(6, '0')} → ${format(newDate, 'MMM d, yyyy')}`);
    } catch {
      update(originalDate);
      toast.error('Failed to reschedule — reverted.');
    }
  }, []);

  // ── Job assignment saved ───────────────────────────────────────────────────────
  const handleJobSaved = useCallback((updatedJob: CalJob) => {
    setJobs((prev) => prev.map((j) => j.id === updatedJob.id ? updatedJob : j));
    setAllJobs((prev) => prev.map((j) => j.id === updatedJob.id ? updatedJob : j));
    setSelectedJob(null);
  }, []);

  // ── Event handlers ─────────────────────────────────────────────────────────────
  const handleRBCSelectEvent = useCallback((event: RBCEvent) => {
    if (event.type === 'job') {
      setSelectedJob(event.resource as CalJob);
    } else {
      setSelectedEvent(event.resource as CalendarEvent);
      setShowEventDetails(true);
    }
  }, []);
  const handleEventUpdated = (evt: CalendarEvent) => {
    setCalEvents((prev) => prev.map((e) => e.id === evt.id ? evt : e));
    setShowEventDetails(false); setSelectedEvent(null);
  };
  const handleEventDeleted = (id: string) => {
    setCalEvents((prev) => prev.filter((e) => e.id !== id));
    setShowEventDetails(false); setSelectedEvent(null);
  };

  // ── RBC event styles ───────────────────────────────────────────────────────────
  const rbcEventStyleGetter = useCallback((event: RBCEvent) => {
    const c = event.type === 'job' 
      ? (event.resource as CalJob).phaseColor || '#3B82F6'
      : (event.resource as CalendarEvent).color || '#3B82F6';
    return { style: { backgroundColor: c, borderColor: c, color: '#fff', borderRadius: '4px', fontSize: '11px', padding: '2px 5px', cursor: event.type === 'job' ? 'grab' : 'pointer' } };
  }, []);

  // ── Nav label ─────────────────────────────────────────────────────────────────
  const navLabel =
    view === 'month' ? format(currentDate, 'MMMM yyyy') :
    view === 'week' ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d, yyyy')}` :
    view === 'day' ? format(currentDate, 'EEEE, MMMM d, yyyy') : 'Upcoming';

  const viewButtons: { key: ViewMode; label: string; Icon: React.ElementType }[] = [
    { key: 'month', label: 'Month', Icon: LayoutGrid },
    { key: 'week', label: 'Week', Icon: CalendarDays },
    { key: 'day', label: 'Day', Icon: Clock },
    { key: 'agenda', label: 'Agenda', Icon: List },
  ];

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      {/* ── DEV BANNER — remove this entire block when going live ── */}
      <div className="mb-4 px-4 py-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-400 dark:border-amber-600 rounded-lg">
        <span className="text-amber-800 dark:text-amber-200 font-semibold text-sm">
          🚧 Dev Preview — This calendar is under development and not yet live. The existing /calendar page is unchanged.
        </span>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-7 w-7 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Calendar <span className="ml-1 text-xs font-normal text-amber-600 dark:text-amber-400">Dev</span>
          </h1>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setCurrentDate((d) => view === 'month' ? subMonths(d, 1) : addDays(d, view === 'week' ? -7 : -1))}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2D3B4E] transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentDate(getEasternNow())}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              Today
            </button>
            <button onClick={() => setCurrentDate((d) => view === 'month' ? addMonths(d, 1) : addDays(d, view === 'week' ? 7 : 1))}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2D3B4E] transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">{navLabel}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Event create + subscribe — same as existing calendar */}
          <EventModal canCreate={canCreateEvents} onCreated={(evt) => setCalEvents((prev) => [evt, ...prev])} />
          <SubscribeCalendarsModal />

          {/* Refresh */}
          <button onClick={() => { fetchJobs(currentDate, selectedPhases); fetchCalEvents(currentDate); }}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2D3B4E] transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* View switcher */}
          <div className="flex items-center bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#2D3B4E] rounded-lg overflow-hidden">
            {viewButtons.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === key ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2D3B4E]'}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          {/* Subcontractor filter */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <select value={filterSubId} onChange={(e) => setFilterSubId(e.target.value)}
              className="text-sm border border-gray-300 dark:border-[#2D3B4E] rounded-lg px-3 py-1.5 bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Subcontractors</option>
              {subcontractors.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.id}</option>)}
            </select>
            {filterSubId !== 'all' && (
              <button onClick={() => setFilterSubId('all')} className="flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Phase filter (identical behaviour to existing calendar) ───────────── */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setShowPhaseFilter(!showPhaseFilter)}
            className="flex items-center px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] text-sm transition-colors">
            <Filter className="h-4 w-4 mr-2" /> Filter by Phase & Events
          </button>
          {selectedPhases.length > 0 && (
            <button onClick={() => setSelectedPhases([])} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Clear Filters</button>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            {selectedPhases.length > 0 ? `${selectedPhases.length} filter(s) active` : 'Showing Job Request, Work Order, Pending Work Order'}
          </span>
        </div>

        {showPhaseFilter && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 shadow mb-3 flex flex-wrap gap-2">
            {phases.map((phase) => (
              <button key={phase.id} onClick={() => togglePhase(phase.job_phase_label)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${selectedPhases.includes(phase.job_phase_label) ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: phase.color_dark_mode }} />
                {phase.job_phase_label}
                {selectedPhases.includes(phase.job_phase_label) && <Check className="h-4 w-4 ml-2" />}
              </button>
            ))}
          </div>
        )}

        {selectedPhases.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedPhases.map((phase) => {
              const phaseObj = phases.find((p) => p.job_phase_label === phase);
              return (
                <div key={phase} className="flex items-center px-2 py-1 rounded-full text-xs"
                  style={{ backgroundColor: `${phaseObj?.color_dark_mode}20`, color: phaseObj?.color_dark_mode || '#4B5563' }}>
                  <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: phaseObj?.color_dark_mode }} />
                  {phase}
                  <button onClick={() => togglePhase(phase)} className="ml-1 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Calendar body ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : view === 'month' ? (
        <div className="flex gap-4">
          {/* Month Grid */}
          <div className={`${showAgendaSidebar ? 'flex-1' : 'w-full'} bg-white dark:bg-[#1E293B] rounded-xl shadow overflow-hidden border border-gray-200 dark:border-[#2D3B4E]`}
            onDragEnd={() => setDraggingJob(null)}>
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#2D3B4E]">
              {DAY_LABELS.map((d) => (
                <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((date, i) => (
                <DayCell
                  key={i}
                  date={date}
                  currentMonth={currentDate}
                  jobs={jobsByDate.get(dateToStr(date)) || []}
                  calEvents={getEventsForDay(date)}
                  filterSubId={filterSubId}
                  selectedPhases={selectedPhases}
                  draggingId={draggingJob?.id ?? null}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onJobClick={(job) => setSelectedJob(job)}
                  onEventClick={(evt) => { setSelectedEvent(evt); setShowEventDetails(true); }}
                  onDayClick={(d) => { setSelectedDate(d); if (!showAgendaSidebar) setShowAgendaSidebar(true); }}
                  isSelected={dateToStr(date) === dateToStr(selectedDate)}
                />
              ))}
            </div>
          </div>

          {/* Today's Agenda Sidebar */}
          {showAgendaSidebar && (
            <div className="w-80 flex-shrink-0">
              <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow border border-gray-200 dark:border-[#2D3B4E] h-fit sticky top-6">
                <div className="p-4 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
                    {isToday(selectedDate) ? "Today's Agenda" : format(selectedDate, 'MMM d, yyyy')}
                  </h3>
                  <button
                    onClick={() => setShowAgendaSidebar(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Close sidebar"
                  >
                    <PanelRightClose className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4">
                  {/* Daily Summary Header */}
                  {(() => {
                    // Use phase-filtered jobs (jobsByDate) to match what's visible in the month grid
                    const dayJobs = filterSubId === 'all'
                      ? (jobsByDate.get(dateToStr(selectedDate)) || [])
                      : (jobsByDate.get(dateToStr(selectedDate)) || []).filter((j) => j.assignedTo === filterSubId);
                    const totals = getJobTypeTotals(dayJobs);
                    
                    if (totals.total > 0) {
                      return (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
                          <div className="grid grid-cols-4 gap-4 text-center">
                            <div>
                              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totals.paint}</div>
                              <div className="text-xs text-blue-600 dark:text-blue-400">Paint</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-orange-500 dark:text-orange-400">{totals.callback}</div>
                              <div className="text-xs text-orange-500 dark:text-orange-400">Callback</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-red-500 dark:text-red-400">{totals.repair}</div>
                              <div className="text-xs text-red-500 dark:text-red-400">Repair</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{totals.total}</div>
                              <div className="text-xs text-purple-700 dark:text-purple-400">Total</div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Jobs & Events List */}
                  {(() => {
                    // Use phase-filtered jobs (jobsByDate) to match what's visible in the month grid
                    const dayJobs = filterSubId === 'all'
                      ? (jobsByDate.get(dateToStr(selectedDate)) || [])
                      : (jobsByDate.get(dateToStr(selectedDate)) || []).filter((j) => j.assignedTo === filterSubId);
                    const dayEvents = getEventsForDay(selectedDate);

                    if (dayJobs.length === 0 && dayEvents.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No jobs or events scheduled</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {/* Events */}
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            onClick={() => { setSelectedEvent(event); setShowEventDetails(true); }}
                            className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                            style={{ backgroundColor: `${event.color}0A` }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                  {event.title}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {event.is_all_day 
                                    ? 'All Day' 
                                    : `${format(parseISO(event.start_at), 'h:mm a')} - ${format(parseISO(event.end_at), 'h:mm a')}`
                                  }
                                </p>
                              </div>
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: event.color }}
                              />
                            </div>
                          </div>
                        ))}

                        {/* Jobs */}
                        {dayJobs.map((job) => (
                          <div
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                            style={{ backgroundColor: `${job.phaseColor}0A` }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                  WO-{String(job.workOrderNum).padStart(6, '0')}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {job.propertyName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                  Unit #{job.unitNumber}
                                </p>
                                {job.assignedToName && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    👤 {job.assignedToName}
                                  </p>
                                )}
                                {!job.assignedToName && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
                                    Unassigned
                                  </p>
                                )}
                              </div>
                              <span
                                className="text-xs px-2 py-1 rounded-full flex-shrink-0"
                                style={{ backgroundColor: job.phaseColor, color: 'white' }}
                              >
                                {job.phaseName}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Toggle button when sidebar is hidden */}
          {!showAgendaSidebar && view === 'month' && (
            <button
              onClick={() => setShowAgendaSidebar(true)}
              className="fixed right-6 top-24 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-lg transition-colors z-10"
              title="Show Today's Agenda"
            >
              <PanelRightOpen className="h-5 w-5" />
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow p-3 border border-gray-200 dark:border-[#2D3B4E] calendar-dev-wrapper">
          <DnDCalendar
            localizer={localizer}
            events={rbcEvents}
            date={currentDate}
            onNavigate={setCurrentDate}
            view={view === 'agenda' ? Views.AGENDA : view === 'week' ? Views.WEEK : Views.DAY}
            onView={() => {}}
            views={[Views.WEEK, Views.DAY, Views.AGENDA]}
            style={{ height: 680 }}
            eventPropGetter={rbcEventStyleGetter as any}
            onEventDrop={handleRBCEventDrop as any}
            onSelectEvent={handleRBCSelectEvent as any}
            draggableAccessor={(event: RBCEvent) => event.type === 'job'}
            resizable={false}
            step={30}
            timeslots={2}
            toolbar={false}
            allDayAccessor={(event: RBCEvent) => event.allDay}
          />
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          subcontractors={subcontractors}
          onClose={() => setSelectedJob(null)}
          onSaved={handleJobSaved}
        />
      )}

      {showEventDetails && selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => { setShowEventDetails(false); setSelectedEvent(null); }}
          onEventUpdated={handleEventUpdated}
          onEventDeleted={handleEventDeleted}
          canEdit={canCreateEvents}
        />
      )}

      {dayPopup && (
        <DayPopupModal
          date={dayPopup}
          jobs={filterSubId === 'all'
            ? (allJobsByDate.get(dateToStr(dayPopup)) || [])
            : (allJobsByDate.get(dateToStr(dayPopup)) || []).filter((j) => j.assignedTo === filterSubId)}
          events={getEventsForDay(dayPopup)}
          onClose={() => setDayPopup(null)}
          onJobClick={(job) => { setDayPopup(null); setSelectedJob(job); }}
          onEventClick={(evt) => { setDayPopup(null); setSelectedEvent(evt); setShowEventDetails(true); }}
        />
      )}
    </div>
  );
}

export default CalendarDevPage;
