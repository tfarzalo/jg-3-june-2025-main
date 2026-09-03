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
        <div key={t.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-[#071027] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-medium text-gray-900 dark:text-white break-words">{t.name}</div>
            {t.columns && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t.columns.length} columns</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => onRun && onRun(t)} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Run</button>
            {!t.preset && <button onClick={() => onEdit && onEdit(t)} className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Edit</button>}
            <button onClick={() => onClone && onClone(t)} className="text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">Clone</button>
            {!t.preset && <button onClick={() => onDelete && onDelete(t.id)} className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
