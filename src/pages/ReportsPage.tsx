import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import RunReportModal from '../components/Reports/RunReportModal';
import TemplatesList from '../components/Reports/TemplatesList';
import TemplateEditor from '../components/Reports/TemplateEditor';
import ReportResultModal from '../components/Reports/ReportResultModal';
import {
  downloadReportCsv,
  fetchReportRuns,
  fetchReportTemplates,
  generateReport,
  openReportInNewWindow,
  PRESET_REPORT_TEMPLATES,
  saveReportTemplate,
  deleteReportTemplate,
  type GeneratedReport,
  type ReportRun,
  type ReportTemplate,
} from '../lib/reports';

export default function ReportsPage() {
  const [showRun, setShowRun] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate | null>(null);
  const [editing, setEditing] = useState<ReportTemplate | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [reportResult, setReportResult] = useState<GeneratedReport | null>(null);
  const [reportRuns, setReportRuns] = useState<ReportRun[]>([]);

  const allTemplates = useMemo(
    () => [...PRESET_REPORT_TEMPLATES, ...savedTemplates],
    [savedTemplates]
  );

  useEffect(() => {
    void loadTemplates();
    void loadRuns();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      setSavedTemplates(await fetchReportTemplates());
    } catch (error) {
      console.error('Failed to load report templates:', error);
      toast.error('Failed to load report templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadRuns = async () => {
    try {
      setLoadingRuns(true);
      setReportRuns(await fetchReportRuns());
    } catch (error) {
      console.error('Failed to load report history:', error);
      toast.error('Failed to load report history');
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleRunTemplate = (template?: ReportTemplate) => {
    setActiveTemplate(template || null);
    setShowRun(true);
  };

  const handleSaveTemplate = async (template: Pick<ReportTemplate, 'id' | 'name' | 'columns' | 'preset'>) => {
    try {
      setSavingTemplate(true);
      await saveReportTemplate(template);
      toast.success(template.id && !template.id.startsWith('tmp-') && !template.preset ? 'Template updated' : 'Template created');
      setEditing(null);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to save report template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save report template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this report template?')) return;

    try {
      await deleteReportTemplate(id);
      toast.success('Template deleted');
      setEditing(null);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to delete report template:', error);
      toast.error('Failed to delete report template');
    }
  };

  const handleRunReport = async ({ from, to, template }: { from: string; to: string; template: ReportTemplate }) => {
    const report = await generateReport({ from, to, template });
    setReportResult(report);
    await loadRuns();
    toast.success(`Report generated with ${report.rows.length} ${report.rows.length === 1 ? 'row' : 'rows'}`);
  };

  const handleDownloadReport = () => {
    if (!reportResult) return;
    downloadReportCsv(reportResult);
  };

  const handleViewReport = () => {
    if (!reportResult) return;
    try {
      openReportInNewWindow(reportResult);
    } catch (error) {
      console.error('Failed to open report window:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open report window');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex items-center gap-2">
          <button
            className="bg-[#9B111E] hover:bg-[#7f0e17] text-white px-4 py-2 rounded-lg shadow"
            onClick={() => handleRunTemplate(undefined)}
          >
            Run Report
          </button>
          <button
            onClick={() => setEditing({ id: '', name: '', columns: [], preset: false })}
            className="px-3 py-2 bg-gray-100 dark:bg-[#1E293B] rounded"
          >
            New Template
          </button>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-4">Preset Reports</h2>
        <TemplatesList
          templates={PRESET_REPORT_TEMPLATES}
          onRun={handleRunTemplate}
          onEdit={setEditing}
        />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Your Templates</h2>
        {loadingTemplates ? (
          <div className="p-4 border rounded-lg bg-white dark:bg-[#071027] text-sm text-gray-600 dark:text-gray-400">
            Loading templates...
          </div>
        ) : savedTemplates.length === 0 ? (
          <div className="p-4 border rounded-lg bg-white dark:bg-[#071027] text-sm text-gray-600 dark:text-gray-400">
            No saved templates yet.
          </div>
        ) : (
          <TemplatesList
            templates={savedTemplates}
            onRun={handleRunTemplate}
            onEdit={setEditing}
            onDelete={handleDeleteTemplate}
          />
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium mb-4">Report History</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#071027]">
          {loadingRuns ? (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400">Loading report history...</div>
          ) : reportRuns.length === 0 ? (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400">No reports have been run yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-[#0F172A]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date Created</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Report</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date Range</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Rows</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {reportRuns.map(run => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(run.created_at)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{run.template_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {run.from && run.to ? `${run.from} to ${run.to}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{run.row_count ?? 'N/A'}</td>
                      <td className="px-4 py-3 text-right">
                        {run.report ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => {
                                try {
                                  openReportInNewWindow(run.report as GeneratedReport);
                                } catch (error) {
                                  console.error('Failed to open report window:', error);
                                  toast.error(error instanceof Error ? error.message : 'Failed to open report window');
                                }
                              }}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              View
                            </button>
                            <button
                              onClick={() => downloadReportCsv(run.report as GeneratedReport)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              Download
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showRun && (
        <RunReportModal
          onClose={() => { setShowRun(false); setActiveTemplate(null); }}
          template={activeTemplate}
          templates={allTemplates}
          onRun={handleRunReport}
        />
      )}

      {editing && (
        <TemplateEditor
          template={editing.id ? editing : undefined}
          onSave={handleSaveTemplate}
          onCancel={() => setEditing(null)}
          onDelete={handleDeleteTemplate}
          saving={savingTemplate}
        />
      )}

      {reportResult && (
        <ReportResultModal
          report={reportResult}
          onClose={() => setReportResult(null)}
          onDownload={handleDownloadReport}
          onView={handleViewReport}
        />
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
