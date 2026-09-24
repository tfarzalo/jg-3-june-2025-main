import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, Mail, X } from 'lucide-react';
import { formatDisplayDate } from '../../lib/dateUtils';
import { AssignmentNotificationRow } from '../../services/assignmentNotifications';

interface Props {
  rows: AssignmentNotificationRow[];
  sessionStartedAt: string;
  sending: boolean;
  onClose: () => void;
  onSend: (ids: string[], groupBySubcontractor: boolean) => Promise<void>;
}

const actionable = (row: AssignmentNotificationRow) => row.status === 'pending' || row.status === 'failed';
const relation = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] || null : value || null;

export default function AssignmentNotificationsModal({ rows, sessionStartedAt, sending, onClose, onSend }: Props) {
  const pendingIds = useMemo(() => rows.filter(actionable).map((row) => row.id), [rows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pendingIds));
  const [groupBySubcontractor, setGroupBySubcontractor] = useState(true);
  const [activeTab, setActiveTab] = useState<'not-sent' | 'sent'>('not-sent');
  const notSentRows = rows.filter((row) => row.status !== 'sent');
  const sentRows = rows.filter((row) => row.status === 'sent');
  const visibleRows = activeTab === 'not-sent' ? notSentRows : sentRows;
  const sessionRows = visibleRows.filter((row) => row.created_at >= sessionStartedAt);
  const olderRows = visibleRows.filter((row) => row.created_at < sessionStartedAt);
  const selectedRows = rows.filter((row) => selected.has(row.id));
  const selectedRecipients = new Set(selectedRows.map((row) => row.subcontractor_id || row.recipient_email || row.id));
  const emailCount = groupBySubcontractor ? selectedRecipients.size : selectedRows.length;

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const renderRows = (items: AssignmentNotificationRow[]) => items.map((row) => {
    const job = row.job;
    const property = relation(job?.property);
    const sub = relation(job?.subcontractor);
    const enabled = actionable(row);
    const staleSchedule = row.status === 'sent' && (
      row.scheduled_date_snapshot !== job?.scheduled_date?.slice(0, 10) ||
      (row.scheduled_end_date_snapshot || null) !== (job?.scheduled_end_date?.slice(0, 10) || null)
    );
    return (
      <label key={row.id} className={`flex gap-2.5 rounded-lg border px-3 py-2 ${enabled ? 'cursor-pointer border-gray-200 dark:border-[#2D3B4E]' : 'border-gray-100 bg-gray-50 dark:border-[#2D3B4E] dark:bg-[#0F172A]'}`}>
        {activeTab === 'not-sent' && <input type="checkbox" checked={selected.has(row.id)} disabled={!enabled || sending} onChange={() => toggle(row.id)} className="mt-0.5 h-4 w-4" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{sub?.full_name || row.recipient_email || 'Unknown subcontractor'} <span className="font-normal text-gray-500">· {row.recipient_email || sub?.email || 'No email address'}</span></p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              row.status === 'sent' ? 'bg-green-100 text-green-700' : row.status === 'failed' ? 'bg-red-100 text-red-700' : row.status === 'processing' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {row.status === 'sent' ? <CheckCircle2 className="h-3.5 w-3.5" /> : row.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
              {staleSchedule ? 'Sent before schedule changed' : row.status.charAt(0).toUpperCase() + row.status.slice(1)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-medium">WO-{String(job?.work_order_num || '').padStart(6, '0')} · {property?.property_name || 'Property'}{job?.unit_number ? ` · Unit ${job.unit_number}` : ''}</span>
            {job?.scheduled_date && <span className="text-gray-500">· {formatDisplayDate(job.scheduled_date.slice(0, 10))}{job.scheduled_end_date ? ` – ${formatDisplayDate(job.scheduled_end_date.slice(0, 10))}` : ''}</span>}
            {row.sent_at && <span className="text-xs text-gray-500">· Sent {new Date(row.sent_at).toLocaleString()}</span>}
          </div>
          {row.last_error && <p className="mt-1 text-xs text-red-600">{row.last_error}</p>}
        </div>
      </label>
    );
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="assignment-notifications-title">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl dark:bg-[#111827]">
        <div className="flex items-start justify-between border-b border-gray-200 p-5 dark:border-[#2D3B4E]">
          <div><h2 id="assignment-notifications-title" className="flex items-center gap-2 text-lg font-semibold"><Mail className="h-5 w-5 text-blue-600" />Assignment Notifications</h2><p className="mt-1 text-sm text-gray-500">Select pending assignments. Multiple jobs for one subcontractor are combined into one email.</p></div>
          <button onClick={onClose} disabled={sending} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1E293B]" aria-label="Close assignment notifications"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex border-b border-gray-200 px-5 pt-2 dark:border-[#2D3B4E]" role="tablist" aria-label="Assignment notification status">
          <button role="tab" aria-selected={activeTab === 'not-sent'} onClick={() => setActiveTab('not-sent')} className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${activeTab === 'not-sent' ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>Not Sent <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{notSentRows.length}</span></button>
          <button role="tab" aria-selected={activeTab === 'sent'} onClick={() => setActiveTab('sent')} className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${activeTab === 'sent' ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>Sent <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">{sentRows.length}</span></button>
        </div>
        {activeTab === 'not-sent' && <div className="flex flex-wrap gap-2 border-b border-gray-200 px-5 py-2.5 dark:border-[#2D3B4E]">
          <button onClick={() => setSelected(new Set(pendingIds))} disabled={sending} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"><Check className="h-4 w-4" />Select All Pending</button>
          <button onClick={() => setSelected(new Set())} disabled={sending} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium dark:bg-[#1E293B]">Deselect All</button>
          <span className="ml-auto self-center text-sm text-gray-500">{selected.size} selected</span>
        </div>}
        {activeTab === 'not-sent' && <div className="border-b border-gray-200 bg-blue-50/70 px-5 py-3 dark:border-[#2D3B4E] dark:bg-blue-950/20">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={groupBySubcontractor} disabled={sending} onChange={(event) => setGroupBySubcontractor(event.target.checked)} className="mt-1 h-4 w-4" />
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">Combine selected jobs into one email per subcontractor</span>
              <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
                {selected.size === 0
                  ? 'Select assignments to preview the send.'
                  : groupBySubcontractor
                    ? `${selected.size} selected job${selected.size === 1 ? '' : 's'} will be sent in ${emailCount} consolidated email${emailCount === 1 ? '' : 's'}.`
                    : `${selected.size} selected job${selected.size === 1 ? '' : 's'} will be sent as ${emailCount} separate email${emailCount === 1 ? '' : 's'}.`}
              </span>
            </span>
          </label>
        </div>}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {visibleRows.length === 0 && <div className="py-10 text-center text-gray-500"><CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />{activeTab === 'sent' ? 'No sent assignment notifications.' : 'No unsent assignment notifications to review.'}</div>}
          {sessionRows.length > 0 && <section><h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">This Scheduling Session</h3><div className="space-y-1.5">{renderRows(sessionRows)}</div></section>}
          {olderRows.length > 0 && <section><h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{activeTab === 'sent' ? 'Previously Sent' : 'Other Notifications'}</h3><div className="space-y-1.5">{renderRows(olderRows)}</div></section>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 p-4 dark:border-[#2D3B4E]"><button onClick={onClose} disabled={sending} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium dark:bg-[#1E293B]">Close</button>{activeTab === 'not-sent' && <button onClick={() => onSend([...selected], groupBySubcontractor)} disabled={sending || selected.size === 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{sending && <Loader2 className="h-4 w-4 animate-spin" />}{sending ? 'Sending…' : groupBySubcontractor && selected.size > 1 ? `Send ${emailCount} Grouped Email${emailCount === 1 ? '' : 's'}` : 'Send Selected'}</button>}</div>
      </div>
    </div>
  );
}
