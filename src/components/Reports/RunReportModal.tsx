import React, { useState, useEffect } from 'react';
import type { ReportTemplate } from '../../lib/reports';

export default function RunReportModal({ onClose, template, templates, onRun }: {
  onClose: () => void;
  template?: ReportTemplate | null;
  templates?: ReportTemplate[];
  onRun: (params: { from: string; to: string; template: ReportTemplate }) => Promise<void>;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(template || null);

  useEffect(() => {
    if (template) setSelectedTemplate(template);
  }, [template]);

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
      await onRun({ from, to, template: selectedTemplate });
      onClose();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to run report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#0F172A] rounded-lg p-6 w-full max-w-xl">
        <h3 className="text-lg font-semibold mb-4">Run Report {selectedTemplate ? `- ${selectedTemplate.name}` : ''}</h3>

        {/* Template selection when not preselected */}
        {!selectedTemplate && templates && (
          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">Select a Report Template</div>
            <div className="grid grid-cols-2 gap-2">
              {templates.map(t => (
                <button key={t.id} onClick={() => setSelectedTemplate(t)} className="text-left p-2 border rounded hover:bg-gray-50">
                  <div className="font-medium">{t.name}</div>
                  {t.columns && <div className="text-xs text-gray-500">{t.columns.length} columns</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => applyPreset('yesterday')} className="px-3 py-1 rounded bg-gray-100">Yesterday</button>
          <button onClick={() => applyPreset('today')} className="px-3 py-1 rounded bg-gray-100">Today</button>
          <button onClick={() => applyPreset('this-week')} className="px-3 py-1 rounded bg-gray-100">This Week</button>
          <button onClick={() => applyPreset('last-week')} className="px-3 py-1 rounded bg-gray-100">Last Week</button>
          <button onClick={() => applyPreset('this-month')} className="px-3 py-1 rounded bg-gray-100">This Month</button>
          <button onClick={() => applyPreset('last-month')} className="px-3 py-1 rounded bg-gray-100">Last Month</button>
        </div>

        <label className="block mb-2">
          <div className="text-sm text-gray-600 mb-1">From</div>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full p-2 border rounded" />
        </label>
        <label className="block mb-4">
          <div className="text-sm text-gray-600 mb-1">To</div>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full p-2 border rounded" />
        </label>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 rounded">Cancel</button>
          <button onClick={run} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">{loading ? 'Running...' : 'Run'}</button>
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
