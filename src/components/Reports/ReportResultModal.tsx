import React from 'react';
import type { GeneratedReport } from '../../lib/reports';

export default function ReportResultModal({
  report,
  onClose,
  onDownload,
  onView,
}: {
  report: GeneratedReport;
  onClose: () => void;
  onDownload: () => void;
  onView: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#0F172A] rounded-lg p-6 w-full max-w-xl shadow-xl">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Report Ready</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {report.templateName} · {report.from} to {report.to} · {report.rows.length} {report.rows.length === 1 ? 'row' : 'rows'}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          >
            Close
          </button>
          <button
            onClick={onView}
            className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 dark:bg-[#1E293B] dark:hover:bg-[#263449] text-gray-900 dark:text-white"
          >
            View in New Window
          </button>
          <button
            onClick={onDownload}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
