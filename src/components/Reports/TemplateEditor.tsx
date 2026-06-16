import React, { useState, useEffect } from 'react';
import { REPORT_COLUMNS, type ReportTemplate } from '../../lib/reports';

type TemplateDraft = Pick<ReportTemplate, 'id' | 'name' | 'columns' | 'preset'>;

export default function TemplateEditor({ template, onSave, onCancel, onDelete, saving = false }: {
  template?: ReportTemplate;
  onSave: (template: TemplateDraft) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(template?.name || '');
  const [columns, setColumns] = useState<string[]>(template?.columns || REPORT_COLUMNS.map(column => column.key));

  useEffect(() => {
    setName(template?.name || '');
    setColumns(template?.columns?.length ? template.columns : REPORT_COLUMNS.map(column => column.key));
  }, [template]);

  const toggleColumn = (col: string) => {
    setColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const move = (idx: number, dir: number) => {
    setColumns(prev => {
      const next = prev.slice();
      const [item] = next.splice(idx,1);
      next.splice(idx+dir,0,item);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return alert('Please name the template');
    onSave({ id: template?.id || `tmp-${Date.now()}`, name: name.trim(), columns, preset: template?.preset });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#0F172A] rounded-lg p-6 w-full max-w-6xl max-h-[88vh] overflow-y-auto shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{template ? 'Edit' : 'New'} Report Template</h3>
        <label className="block mb-3">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Name</div>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded dark:bg-[#111827] dark:border-gray-700 dark:text-white" />
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 mb-5">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Select Columns</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {REPORT_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 rounded border border-gray-200 dark:border-gray-700 p-2 text-sm text-gray-800 dark:text-gray-100">
                  <input type="checkbox" checked={columns.includes(col.key)} onChange={() => toggleColumn(col.key)} />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">Order Columns</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{columns.length} selected</div>
            </div>
            <ul className="rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 max-h-[54vh] overflow-y-auto">
              {columns.map((col, idx) => (
                <li key={col} className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                  <span>{REPORT_COLUMNS.find(column => column.key === col)?.label || col}</span>
                  <span className="flex items-center gap-1">
                    <button onClick={() => move(idx, -1)} disabled={idx===0} className="px-2 py-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800">▲</button>
                    <button onClick={() => move(idx, 1)} disabled={idx===columns.length-1} className="px-2 py-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800">▼</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          {onDelete && template && !template.preset && (
            <button onClick={() => onDelete(template.id)} className="px-3 py-2 rounded text-red-600">Delete</button>
          )}
          <button onClick={onCancel} className="px-3 py-2 rounded">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
