import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { createPortal } from 'react-dom';
import './calendar-print.css';

const TZ = 'America/New_York';
const LOGO_URL = `${import.meta.env.BASE_URL}jg-logo-icon.png`;

export type PrintCalendarView = 'month' | 'week' | 'day' | 'agenda';

export interface PrintCalendarItem {
  id: string;
  type: 'job' | 'event';
  date: string;
  title: string;
  color: string;
  workOrder?: string;
  property?: string;
  unit?: string;
  unitSize?: string | null;
  jobType?: string | null;
  subcontractor?: string | null;
  jobPhase?: string | null;
  assignmentStatus?: string | null;
  notificationStatus?: string | null;
  purchaseOrder?: string | null;
  address?: string | null;
  notes?: string | null;
  schedule?: string | null;
  eventTime?: string | null;
  eventDetails?: string | null;
}

export interface CalendarPrintSnapshot {
  view: PrintCalendarView;
  heading: string;
  rangeLabel: string;
  printedAt: string;
  filterLabel: string;
  sortLabel: string;
  dates: string[];
  itemsByDate: Record<string, PrintCalendarItem[]>;
}

function Item({ item, detailed = false }: { item: PrintCalendarItem; detailed?: boolean }) {
  if (item.type === 'event') {
    return (
      <article className="calendar-print-item calendar-print-event">
        <div className="calendar-print-item-heading">
          <div className="calendar-print-item-title"><span className="calendar-print-color" style={{ backgroundColor: item.color }} />{item.title}</div>
          <span className="calendar-print-type">Event</span>
        </div>
        <div className="calendar-print-meta">{item.eventTime || 'All day'}</div>
        {detailed && item.eventDetails && <div className="calendar-print-notes"><strong>Details</strong><span>{item.eventDetails}</span></div>}
      </article>
    );
  }
  return (
    <article className="calendar-print-item">
      <div className="calendar-print-item-heading">
        <div className="calendar-print-item-title"><span className="calendar-print-color" style={{ backgroundColor: item.color }} />{item.workOrder}</div>
        {item.jobPhase && <span className="calendar-print-type">{item.jobPhase}</span>}
      </div>
      <div className="calendar-print-location">{item.property} <span>•</span> Unit {item.unit}</div>
      <div className="calendar-print-meta">{[item.jobType, item.subcontractor || 'Unassigned'].filter(Boolean).join(' · ')}</div>
      <div className="calendar-print-statuses">
        <span className="calendar-print-status"><strong>Assignment</strong>{item.assignmentStatus || 'Unassigned'}</span>
        <span className="calendar-print-status"><strong>Notification</strong>{item.notificationStatus || 'Not available'}</span>
      </div>
      {detailed && (
        <div className="calendar-print-details">
          {item.schedule && <div><strong>Schedule</strong><span>{item.schedule}</span></div>}
          {item.unitSize && <div><strong>Unit Size</strong><span>{item.unitSize}</span></div>}
          {item.purchaseOrder && <div><strong>Purchase Order</strong><span>{item.purchaseOrder}</span></div>}
          {item.address && <div className="calendar-print-wide"><strong>Address</strong><span>{item.address}</span></div>}
          {item.notes && <div className="calendar-print-notes calendar-print-wide"><strong>Notes</strong><span>{item.notes}</span></div>}
        </div>
      )}
    </article>
  );
}

export function CalendarPrintView({ snapshot }: { snapshot: CalendarPrintSnapshot | null }) {
  if (!snapshot) return null;
  const nonEmptyDates = snapshot.dates.filter(date => (snapshot.itemsByDate[date] || []).length > 0);
  const allItems = snapshot.dates.flatMap(date => snapshot.itemsByDate[date] || []);
  const jobCount = allItems.filter(item => item.type === 'job').length;
  const eventCount = allItems.length - jobCount;
  const isGrid = snapshot.view === 'week';
  const orientation = isGrid ? 'landscape' : 'portrait';
  return createPortal((
    <>
      <style media="print">{`@page { size: ${orientation}; margin: 0.45in; }`}</style>
    <section className={`calendar-print-root calendar-print-${snapshot.view}`} aria-hidden="true">
      <header className="calendar-print-header">
        <div className="calendar-print-brand">
          <div className="calendar-print-logo"><img src={LOGO_URL} alt="JG Painting Pros" /></div>
          <div><p>JG Painting Pros Inc.</p><h1>{snapshot.view === 'agenda' ? 'Agenda Schedule' : `${snapshot.view.charAt(0).toUpperCase()}${snapshot.view.slice(1)} Schedule`}</h1></div>
        </div>
        <div className="calendar-print-header-meta"><strong>{snapshot.rangeLabel}</strong><span>Printed {formatInTimeZone(parseISO(snapshot.printedAt), TZ, "MMMM d, yyyy 'at' h:mm a 'ET'")}</span></div>
        <div className="calendar-print-summary" aria-label="Print summary">
          <span><strong>{jobCount}</strong> job{jobCount === 1 ? '' : 's'}</span>
          <span><strong>{eventCount}</strong> event{eventCount === 1 ? '' : 's'}</span>
          <span><strong>{nonEmptyDates.length}</strong> scheduled day{nonEmptyDates.length === 1 ? '' : 's'}</span>
        </div>
        <div className="calendar-print-filter"><span>{snapshot.filterLabel}</span><span>{snapshot.sortLabel}</span></div>
      </header>
      <div className="calendar-print-legend">
        <strong>Status key</strong>
        <span>Assignment: Pending / Accepted / Declined / In Progress / Completed</span>
        <span>Notification: Send Later / Sent / Failed</span>
      </div>

      {isGrid && (
        <div className={`calendar-print-grid calendar-print-grid-${snapshot.view}`}>
          {snapshot.dates.map(date => (
            <section key={date} className="calendar-print-day">
              <h3>{format(parseISO(`${date}T12:00:00`), snapshot.view === 'month' ? 'EEE d' : 'EEE, MMM d')}</h3>
              {(snapshot.itemsByDate[date] || []).map(item => <Item key={item.id} item={item} />)}
            </section>
          ))}
        </div>
      )}

      {!isGrid && (
        <section className="calendar-print-agenda">
          {nonEmptyDates.map(date => (
            <section key={date} className="calendar-print-agenda-day">
              <div className="calendar-print-date-heading">
                <span>{format(parseISO(`${date}T12:00:00`), 'EEEE')}</span>
                <strong>{format(parseISO(`${date}T12:00:00`), 'MMMM d, yyyy')}</strong>
                <small>{(snapshot.itemsByDate[date] || []).length} item{(snapshot.itemsByDate[date] || []).length === 1 ? '' : 's'}</small>
              </div>
              {(snapshot.itemsByDate[date] || []).map(item => <Item key={item.id} item={item} detailed />)}
            </section>
          ))}
          {nonEmptyDates.length === 0 && <p>No visible schedule items in this period.</p>}
        </section>
      )}
    </section>
    </>
  ), document.body);
}
