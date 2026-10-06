import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { createPortal } from 'react-dom';
import './calendar-print.css';

const TZ = 'America/New_York';

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
        <div className="calendar-print-item-title"><span className="calendar-print-color" style={{ backgroundColor: item.color }} />{item.title}</div>
        <div className="calendar-print-meta">Event · {item.eventTime || 'All day'}</div>
        {detailed && item.eventDetails && <div className="calendar-print-notes">{item.eventDetails}</div>}
      </article>
    );
  }
  return (
    <article className="calendar-print-item">
      <div className="calendar-print-item-title"><span className="calendar-print-color" style={{ backgroundColor: item.color }} />{item.workOrder} · {item.property} · Unit {item.unit}</div>
      <div className="calendar-print-meta">{[item.jobType, item.subcontractor || 'Unassigned', item.jobPhase].filter(Boolean).join(' · ')}</div>
      <div className="calendar-print-statuses">
        <span>Assignment: {item.assignmentStatus || 'Unassigned'}</span>
        <span>Notification: {item.notificationStatus || 'Not available'}</span>
      </div>
      {detailed && (
        <div className="calendar-print-details">
          {item.schedule && <span>Schedule: {item.schedule}</span>}
          {item.unitSize && <span>Unit Size: {item.unitSize}</span>}
          {item.purchaseOrder && <span>PO: {item.purchaseOrder}</span>}
          {item.address && <span>Address: {item.address}</span>}
          {item.notes && <span className="calendar-print-notes">Notes: {item.notes}</span>}
        </div>
      )}
    </article>
  );
}

export function CalendarPrintView({ snapshot }: { snapshot: CalendarPrintSnapshot | null }) {
  if (!snapshot) return null;
  const nonEmptyDates = snapshot.dates.filter(date => (snapshot.itemsByDate[date] || []).length > 0);
  const isGrid = snapshot.view === 'month' || snapshot.view === 'week';
  const orientation = isGrid ? 'landscape' : 'portrait';
  return createPortal((
    <>
      <style media="print">{`@page { size: ${orientation}; margin: 0.45in; }`}</style>
    <section className={`calendar-print-root calendar-print-${snapshot.view}`} aria-hidden="true">
      <header className="calendar-print-header">
        <div><h1>JG Painting Pros — Calendar</h1><h2>{snapshot.heading}</h2></div>
        <div className="calendar-print-header-meta"><div>{snapshot.rangeLabel}</div><div>Printed: {formatInTimeZone(parseISO(snapshot.printedAt), TZ, "MMMM d, yyyy 'at' h:mm a 'ET'")}</div></div>
        <div className="calendar-print-filter">{snapshot.filterLabel} · {snapshot.sortLabel}</div>
      </header>
      <div className="calendar-print-legend">Assignment: Pending Acceptance / Accepted / Declined / In Progress / Completed · Notification: Send Later / Sent / Failed</div>

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

      {(!isGrid || snapshot.view === 'month') && (
        <section className="calendar-print-agenda">
          {snapshot.view === 'month' && <h2>Schedule Details by Date</h2>}
          {nonEmptyDates.map(date => (
            <section key={date} className="calendar-print-agenda-day">
              <h3>{format(parseISO(`${date}T12:00:00`), 'EEEE, MMMM d, yyyy')}</h3>
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
