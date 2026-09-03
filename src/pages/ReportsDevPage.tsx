import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Beaker, ShieldCheck } from 'lucide-react';
import RunReportModal from '../components/Reports/RunReportModal';
import TemplatesList from '../components/Reports/TemplatesList';
import TemplateEditor from '../components/Reports/TemplateEditor';
import ReportResultModal from '../components/Reports/ReportResultModal';
import {
  DEV_PRESET_REPORT_TEMPLATES,
  devReportHeadersForTemplate,
  deleteReportRun,
  deleteReportTemplate,
  downloadReportCsv,
  downloadReportExcel,
  fetchReportRuns,
  fetchReportTemplates,
  generateDevReport,
  openReportInNewWindow,
  saveReportTemplate,
  type GeneratedReport,
  type ReportRun,
  type ReportSort,
  type ReportTemplate,
} from '../lib/reportsDev';

export default function ReportsDevPage() {
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
    () => [...DEV_PRESET_REPORT_TEMPLATES, ...savedTemplates],
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
      console.error('Failed to load dev report templates:', error);
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
      console.error('Failed to load dev report history:', error);
      toast.error('Failed to load report history');
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleRunTemplate = (template?: ReportTemplate) => {
    setActiveTemplate(template || null);
    setShowRun(true);
  };

  const handleCloneTemplate = (template: ReportTemplate) => {
    setEditing({
      ...template,
      id: `tmp-dev-clone-${Date.now()}`,
      name: `${template.name} Copy`,
      columns: [...template.columns],
      filters: { ...(template.filters || {}) },
      sort: { ...(template.sort || {}) },
      preset: false,
    });
  };

  const handleSaveTemplate = async (template: Pick<ReportTemplate, 'id' | 'name' | 'columns' | 'filters' | 'sort' | 'preset'>) => {
    try {
      setSavingTemplate(true);
      await saveReportTemplate(template);
      toast.success(template.id && !template.id.startsWith('tmp-') && !template.preset ? 'Template updated' : 'Template created');
      setEditing(null);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to save dev report template:', error);
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
      console.error('Failed to delete dev report template:', error);
      toast.error('Failed to delete report template');
    }
  };

  const handleRunReport = async ({ from, to, template, sort }: { from: string; to: string; template: ReportTemplate; sort?: ReportSort }) => {
    const report = await generateDevReport({ from, to, template, sort });
    setReportResult(report);
    await loadRuns();
    toast.success(`Dev report generated with ${report.rows.length} ${report.rows.length === 1 ? 'row' : 'rows'}`);
  };

  const handleDownloadReport = () => {
    if (!reportResult) return;
    downloadReportCsv(reportResult);
  };

  const handleDownloadExcelReport = async () => {
    if (!reportResult) return;
    try {
      await downloadReportExcel(reportResult);
    } catch (error) {
      console.error('Failed to download dev Excel report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download Excel report');
    }
  };

  const handleViewReport = () => {
    if (!reportResult) return;
    try {
      openReportInNewWindow(reportResult);
    } catch (error) {
      console.error('Failed to open dev report window:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open report window');
    }
  };

  return (
    <div className="p-6 text-gray-900 dark:text-gray-100">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
            <Beaker className="h-3.5 w-3.5" />
            Dev Report Builder
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dev Report Builder</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
            Sandbox for testing updated billing-report output before replacing the current report builder. This page reads existing application data and does not require database schema changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg bg-[#9B111E] px-4 py-2 text-white shadow hover:bg-[#7f0e17]"
            onClick={() => handleRunTemplate(undefined)}
          >
            Run Report
          </button>
          <button
            onClick={() => setEditing({ id: '', name: '', columns: [], preset: false })}
            className="rounded bg-gray-100 px-3 py-2 text-gray-800 hover:bg-gray-200 dark:bg-[#1E293B] dark:text-gray-100 dark:hover:bg-[#263449]"
          >
            New Template
          </button>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-100">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Non-destructive testing area</div>
            <div className="mt-1">
              Existing report templates, saved reports, filters, CSV downloads, and preview behavior are retained. The additional dev preset reshapes report output in memory from the current report data.
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Dev Presets</h2>
        <TemplatesList
          templates={DEV_PRESET_REPORT_TEMPLATES}
          onRun={handleRunTemplate}
          onClone={handleCloneTemplate}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Your Templates</h2>
        {loadingTemplates ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-[#071027] dark:text-gray-400">
            Loading templates...
          </div>
        ) : savedTemplates.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-[#071027] dark:text-gray-400">
            No saved templates yet.
          </div>
        ) : (
          <TemplatesList
            templates={savedTemplates}
            onRun={handleRunTemplate}
            onEdit={setEditing}
            onClone={handleCloneTemplate}
            onDelete={handleDeleteTemplate}
          />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Report History</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#071027]">
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
                              className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                            >
                              View
                            </button>
                            <button
                              onClick={() => downloadReportCsv(run.report as GeneratedReport)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Download
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await downloadReportExcel(run.report as GeneratedReport);
                                } catch (error) {
                                  console.error('Failed to download dev Excel report:', error);
                                  toast.error(error instanceof Error ? error.message : 'Failed to download Excel report');
                                }
                              }}
                              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                            >
                              Excel
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Delete this report history item?')) return;
                                try {
                                  await deleteReportRun(run.id);
                                  await loadRuns();
                                  toast.success('Report history item deleted');
                                } catch (error) {
                                  console.error('Failed to delete report run:', error);
                                  toast.error(error instanceof Error ? error.message : 'Failed to delete report run');
                                }
                              }}
                              className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
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
          onClose={() => setShowRun(false)}
          template={activeTemplate}
          templates={allTemplates}
          getReportHeaders={devReportHeadersForTemplate}
          onRun={handleRunReport}
        />
      )}

      {editing && (
        <TemplateEditor
          template={editing}
          saving={savingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => setEditing(null)}
          onDelete={!editing.preset && editing.id ? handleDeleteTemplate : undefined}
        />
      )}

      {reportResult && (
        <ReportResultModal
          report={reportResult}
          onClose={() => setReportResult(null)}
          onDownload={handleDownloadReport}
          onDownloadExcel={handleDownloadExcelReport}
          onView={handleViewReport}
        />
      )}
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
