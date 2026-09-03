import {
  PRESET_REPORT_TEMPLATES,
  generateReport,
  type GeneratedReport,
  type ReportSort,
  type ReportTemplate,
} from './reports';

export {
  deleteReportRun,
  deleteReportTemplate,
  downloadReportCsv,
  fetchReportRuns,
  fetchReportTemplates,
  openReportInNewWindow,
  reportHeadersForTemplate as devReportHeadersForTemplate,
  saveReportTemplate,
  type GeneratedReport,
  type ReportRun,
  type ReportSort,
  type ReportTemplate,
} from './reports';

export const DEV_PRESET_REPORT_TEMPLATES: ReportTemplate[] = PRESET_REPORT_TEMPLATES.map(template => (
  template.filters?.reportType === 'wufoo_style_billing'
    ? {
        ...template,
        id: 'dev-preset-wufoo-style-billing',
        name: 'Dev - Wufoo-Style Billing',
        preset: true,
      }
    : template
));

export const DEV_WUFOO_STYLE_TEMPLATE =
  DEV_PRESET_REPORT_TEMPLATES.find(template => template.filters?.reportType === 'wufoo_style_billing') ||
  DEV_PRESET_REPORT_TEMPLATES[0];

export async function generateDevReport(params: {
  from: string;
  to: string;
  template: ReportTemplate;
  sort?: ReportSort;
}): Promise<GeneratedReport> {
  return generateReport({ ...params, persistRun: false });
}
