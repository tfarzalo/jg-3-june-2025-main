import React, { useState, useEffect, useMemo } from 'react';
import { reportHeadersForTemplate, type ReportSort, type ReportTemplate } from '../../lib/reports';

export default function RunReportModal({ onClose, template, templates, getReportHeaders, onRun }: {
  onClose: () => void;
  template?: ReportTemplate | null;
  templates?: ReportTemplate[];
  getReportHeaders?: (template: ReportTemplate) => string[];
  onRun: (params: { from: string; to: string; template: ReportTemplate; sort?: ReportSort }) => Promise<void>;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(template || null);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<ReportSort['direction']>('asc');
  const headers = useMemo(
    () => selectedTemplate ? (getReportHeaders || reportHeadersForTemplate)(selectedTemplate) : [],
    [getReportHeaders, selectedTemplate]
  );

  useEffect(() => {
    if (template) setSelectedTemplate(template);
  }, [template]);

  useEffect(() => {
    if (!headers.length) {
      setSortColumn('');
      return;
    }

    if (sortColumn && headers.includes(sortColumn)) return;

    setSortColumn(
      headers.find(header => header === 'Scheduled Date' || header === 'Scheduled Work Date') || headers[0]
    );
  }, [headers, sortColumn]);

  const applyPreset = (preset: string) => {
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (preset === 'yesterday') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      end = new Date(start);
    } else if (preset === 'today') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      end = new Date(start);
    } else if (preset === 'this-week') {
      start = startOfWeek(today);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (preset === 'last-week') {
      const thisWeekStart = startOfWeek(today);
      start = new Date(thisWeekStart);
      start.setDate(thisWeekStart.getDate() - 7);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (preset === 'this-month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === 'last-month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    if (start && end) {
      setFrom(formatDateInput(start));
      setTo(formatDateInput(end));
    }
  };

  const run = async () => {
    if (!from || !to) return alert('Please select from and to dates');
    if (!selectedTemplate) return alert('Please select a report template');
    setLoading(true);
    try {
      await onRun({
        from,
        to,
        template: selectedTemplate,
        sort: sortColumn ? { column: sortColumn, direction: sortDirection } : undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to run report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#0F172A] rounded-lg p-6 w-full max-w-4xl shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Run Report {selectedTemplate ? `- ${selectedTemplate.name}` : ''}</h3>

        {/* Template selection when not preselected */}
        {!selectedTemplate && templates && (
          <div className="mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Select a Report Template</div>
            <div className="grid grid-cols-2 gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className="text-left p-2 border border-gray-200 rounded bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-[#111827] dark:hover:bg-[#1E293B]"
                >
                  <div className="font-medium text-gray-900 dark:text-white">{t.name}</div>
                  {t.columns && <div className="text-xs text-gray-500 dark:text-gray-400">{t.columns.length} columns</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2 lg:flex-nowrap">
          <button onClick={() => applyPreset('yesterday')} className="px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-[#1E293B] dark:text-gray-100 dark:hover:bg-[#263449]">Yesterday</button>
          <button onClick={() => applyPreset('today')} className="px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-[#1E293B] dark:text-gray-100 dark:hover:bg-[#263449]">Today</button>
          <button onClick={() => applyPreset('this-week')} className="px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-[#1E293B] dark:text-gray-100 dark:hover:bg-[#263449]">This Week</button>
          <button onClick={() => applyPreset('last-week')} className="px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-[#1E293B] dark:text-gray-100 dark:hover:bg-[#263449]">Last Week</button>
          <button onClick={() => applyPreset('this-month')} className="px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-[#1E293B] dark:text-gray-100 dark:hover:bg-[#263449]">This Month</button>
          <button onClick={() => applyPreset('last-month')} className="px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-[#1E293B] dark:text-gray-100 dark:hover:bg-[#263449]">Last Month</button>
        </div>

        <label className="block mb-2">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">From</div>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full p-2 border border-gray-200 rounded bg-white text-gray-900 dark:border-gray-700 dark:bg-[#111827] dark:text-white" />
        </label>
        <label className="block mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">To</div>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full p-2 border border-gray-200 rounded bg-white text-gray-900 dark:border-gray-700 dark:bg-[#111827] dark:text-white" />
        </label>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sort By</div>
            <select
              value={sortColumn}
              onChange={e => setSortColumn(e.target.value)}
              disabled={!selectedTemplate || headers.length === 0}
              className="w-full p-2 border border-gray-200 rounded bg-white text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-[#111827] dark:text-white"
            >
              {headers.map(header => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Direction</div>
            <select
              value={sortDirection}
              onChange={e => setSortDirection(e.target.value as ReportSort['direction'])}
              className="w-full p-2 border border-gray-200 rounded bg-white text-gray-900 dark:border-gray-700 dark:bg-[#111827] dark:text-white"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#1E293B]">Cancel</button>
          <button onClick={run} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">{loading ? 'Running...' : 'Run'}</button>
        </div>
      </div>
    </div>
  );
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}
