import React from 'react';
import type { ReportTemplate } from '../../lib/reports';

export default function TemplatesList({ templates, onRun, onEdit, onClone, onDelete }: {
  templates: ReportTemplate[];
  onRun?: (template: ReportTemplate) => void;
  onEdit?: (template: ReportTemplate) => void;
  onClone?: (template: ReportTemplate) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map(t => (
        <div key={t.id} className="p-4 border rounded-lg shadow-sm bg-white dark:bg-[#071027] flex items-start justify-between">
          <div>
            <div className="font-medium">{t.name}</div>
            {t.columns && <div className="text-xs text-gray-500 mt-1">{t.columns.length} columns</div>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onRun && onRun(t)} className="text-sm text-blue-600">Run</button>
            <button onClick={() => onEdit && onEdit(t)} className="text-sm text-gray-700">Edit</button>
            <button onClick={() => onClone && onClone(t)} className="text-sm text-emerald-700 dark:text-emerald-400">Clone</button>
            <button onClick={() => onDelete && onDelete(t.id)} className="text-sm text-red-600">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
