import { supabase } from '../utils/supabase';
import {
  QUALITY_CONTROL_SCORE_ITEMS,
  QUALITY_CONTROL_SCORE_SECTIONS,
  QUALITY_CONTROL_SCORE_TOTAL,
  getQualityControlSectionTotal,
} from './qualityControl';

export type ReportTemplate = {
  id: string;
  name: string;
  columns: string[];
  filters?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  preset?: boolean;
};

export type ReportColumn = {
  key: string;
  label: string;
  value: (job: ReportJob) => string | number | boolean | null | undefined;
};

type RelatedRecord = Record<string, unknown> | null;
type ReportRow = Record<string, string | number | boolean | null | undefined>;
type BillingTotals = { bill: number; sub: number };
type QualityControlSubmissionRecord = {
  id: string;
  job_id: string;
  form_data: Record<string, unknown> | null;
  score_total: number | string | null;
  media_files: unknown;
  created_at: string | null;
  updated_at: string | null;
};
type SubcontractorQualityControlAggregate = {
  submissions: number;
  totalScore: number;
  averageScore: number;
};

export type GeneratedReport = {
  templateName: string;
  from: string;
  to: string;
  filename: string;
  headers: string[];
  rows: ReportRow[];
  csv: string;
};

export type ReportRun = {
  id: string;
  template_id?: string | null;
  template_name: string;
  from?: string;
  to?: string;
  row_count?: number;
  status: string;
  created_at: string;
  report?: GeneratedReport;
};

type ReportJob = {
  id: string;
  work_order_num?: number | string | null;
  unit_number?: string | null;
  description?: string | null;
  scheduled_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  purchase_order?: string | null;
  assigned_to?: string | null;
  total_billing_amount?: number | string | null;
  report_total_billing_amount?: number | string | null;
  sub_pay_total?: number | string | null;
  active_snapshot_id?: string | null;
  historical_data_mode?: string | null;
  cancellation_trip_charge_added?: boolean | null;
  cancellation_trip_charge_bill_amount?: number | string | null;
  cancellation_trip_charge_sub_pay_amount?: number | string | null;
  invoice_sent?: boolean | null;
  invoice_paid?: boolean | null;
  property?: RelatedRecord;
  unit_size?: RelatedRecord;
  job_phase?: RelatedRecord;
  job_type?: RelatedRecord;
  job_category?: RelatedRecord;
  assigned_to_profile?: RelatedRecord;
  work_orders?: RelatedRecord[];
  // calculated/attached by enrichJobsWithBillingTotals
  extra_charges_total?: number | string | null;
  extra_charges_list?: string | null;
  base_billing_total?: number | string | null;
  // expanded fields for reporting
  base_pay_to_sub?: number | string | null;
  base_profit?: number | string | null;
  base_profit_margin?: number | string | null;
  extra_sub_total?: number | string | null;
  extra_profit?: number | string | null;
  extra_profit_margin?: number | string | null;
  extra_items?: string | null; // itemized extra charges as joined string
  quality_control_submissions?: QualityControlSubmissionRecord[];
  quality_control_latest?: QualityControlSubmissionRecord | null;
  quality_control_submission_count?: number;
  quality_control_media_count?: number;
  quality_control_subcontractor_total_submissions?: number;
  quality_control_subcontractor_total_score?: number;
  quality_control_subcontractor_average_score?: number;
  quality_control_subcontractor_average_percent?: number;
};

const QUALITY_CONTROL_ITEM_REPORT_COLUMNS: ReportColumn[] = QUALITY_CONTROL_SCORE_ITEMS.map(item => ({
  key: `qc_score_${item.key}`,
  label: `QC - ${item.label}`,
  value: job => {
    const scores = latestQualityControlScores(job);
    return scores ? numberFrom(scores[item.key]) : '';
  },
}));

const QUALITY_CONTROL_SECTION_REPORT_COLUMNS: ReportColumn[] = QUALITY_CONTROL_SCORE_SECTIONS.map(section => ({
  key: `qc_section_${section.key}`,
  label: `QC Section - ${section.label}`,
  value: job => {
    const scores = latestQualityControlScores(job);
    return scores ? getQualityControlSectionTotal(scores, section) : '';
  },
}));

export const REPORT_COLUMNS: ReportColumn[] = [
  { key: 'work_order_num', label: 'Work Order #', value: job => formatWorkOrderNumber(job.work_order_num) },
  { key: 'scheduled_date', label: 'Scheduled Date', value: job => formatDate(job.scheduled_date) },
  { key: 'property', label: 'Property', value: job => textFrom(job.property, 'property_name') },
  { key: 'unit_number', label: 'Unit #', value: job => job.unit_number },
  { key: 'unit_size', label: 'Unit Size', value: job => textFrom(job.unit_size, 'unit_size_label') || textFrom(firstWorkOrder(job), 'unit_size') },
  { key: 'job_type', label: 'Job Type', value: job => textFrom(job.job_type, 'job_type_label') },
  { key: 'job_category', label: 'Job Category', value: job => textFrom(job.job_category, 'name') || textFrom(firstWorkOrder(job), 'job_category') },
  { key: 'phase', label: 'Phase', value: job => textFrom(job.job_phase, 'job_phase_label') },
  { key: 'assigned_to', label: 'Assigned To', value: job => textFrom(job.assigned_to_profile, 'full_name') },
  { key: 'purchase_order', label: 'PO #', value: job => job.purchase_order },
  { key: 'description', label: 'Description', value: job => {
      const base = job.description || '';
      if (job.extra_charges_list) {
        return `${base}${base ? '\n\n' : ''}Extra Charges: ${job.extra_charges_list}`;
      }
      return base;
    } },
  // Base billing breakdown
  { key: 'base_billing', label: 'Base Bill to Customer', value: job => job.base_billing_total },
  { key: 'base_pay_to_sub', label: 'Base Pay to Subcontractor', value: job => job.base_pay_to_sub },
  { key: 'base_profit', label: 'Base Profit', value: job => job.base_profit },
  { key: 'base_profit_margin', label: 'Base Profit Margin', value: job => job.base_profit_margin },
  { key: 'total_billing_amount', label: 'Total Bill to Customer', value: job => billingTotalForReport(job) },
  { key: 'sub_pay', label: 'Sub Pay', value: job => job.sub_pay_total },
  // Extra charges breakdown
  { key: 'extra_items', label: 'Extra Charge Items', value: job => job.extra_items },
  { key: 'extra_charges_total', label: 'Extra Charges Billing', value: job => job.extra_charges_total },
  { key: 'extra_sub_total', label: 'Extra Pay to Subcontractor', value: job => job.extra_sub_total },
  { key: 'extra_profit', label: 'Extra Profit', value: job => job.extra_profit },
  { key: 'extra_profit_margin', label: 'Extra Profit Margin', value: job => job.extra_profit_margin },
  { key: 'total_profit', label: 'Total Profit', value: job => {
      try {
        const bill = Number(billingTotalForReport(job) || 0);
        const sub = Number(job.sub_pay_total ?? 0);
        const profit = bill - sub;
        return Number.isFinite(profit) ? Number(profit.toFixed(2)) : '';
      } catch (e) {
        return '';
      }
    } },
  { key: 'profit_margin', label: 'Profit Margin', value: job => {
      try {
        const bill = Number(billingTotalForReport(job) || 0);
        const sub = Number(job.sub_pay_total ?? 0);
        if (!bill || !isFinite(bill)) return '';
        const margin = ((bill - sub) / bill) * 100;
        return Number.isFinite(margin) ? Number(margin.toFixed(2)) : '';
      } catch (e) {
        return '';
      }
    } },
  { key: 'approval', label: 'Approval (Completed)', value: job => {
      const phaseLabel = textFrom(job.job_phase, 'job_phase_label') || String(job['phase'] || job['status'] || '');
      const isCompleted = String(phaseLabel).toLowerCase().includes('completed') || String(job['status'] || '').toLowerCase() === 'completed' || Boolean(job['completed_at'] || job['completed_on']);
      if (isCompleted) return 'Yes';
      // If cancelled but has extra charges or cancellation trip charge, mark as approved
      const isCancelled = String(phaseLabel).toLowerCase().includes('cancel');
      const hasExtra = Number(job.sub_pay_total || job.report_total_billing_amount || 0) > 0 || Boolean((job as any).has_extra_charges) || Boolean((job as any).cancellation_trip_charge_added);
      if (isCancelled && hasExtra) return 'Yes';
      return 'No';
    } },
  { key: 'invoice_sent', label: 'Invoice Sent', value: job => yesNo(job.invoice_sent) },
  { key: 'invoice_paid', label: 'Invoice Paid', value: job => yesNo(job.invoice_paid) },
  { key: 'qc_submitted', label: 'QC Submitted', value: job => yesNo(Boolean(job.quality_control_latest)) },
  { key: 'qc_submitted_date', label: 'QC Submitted Date', value: job => formatDate(job.quality_control_latest?.created_at) },
  { key: 'qc_updated_date', label: 'QC Updated Date', value: job => formatDate(job.quality_control_latest?.updated_at) },
  { key: 'qc_submission_count', label: 'QC Submission Count', value: job => job.quality_control_submission_count ?? 0 },
  { key: 'qc_score_total', label: 'QC Score Total', value: job => job.quality_control_latest ? numberFrom(job.quality_control_latest.score_total) : '' },
  { key: 'qc_score_percent', label: 'QC Score %', value: job => {
      if (!job.quality_control_latest) return '';
      return QUALITY_CONTROL_SCORE_TOTAL ? Number(((numberFrom(job.quality_control_latest.score_total) / QUALITY_CONTROL_SCORE_TOTAL) * 100).toFixed(2)) : '';
    } },
  { key: 'qc_painter_name', label: 'QC Painter/Subcontractor', value: job => textFrom(latestQualityControlFormData(job), 'subcontractor_name', 'painter_name') || [textFrom(latestQualityControlFormData(job), 'painter_first_name'), textFrom(latestQualityControlFormData(job), 'painter_last_name')].filter(Boolean).join(' ') },
  { key: 'qc_date_painted', label: 'QC Date Painted', value: job => formatDate(textFrom(latestQualityControlFormData(job), 'date_painted')) },
  { key: 'qc_date_walked', label: 'QC Date Walked', value: job => formatDate(textFrom(latestQualityControlFormData(job), 'date_walked')) },
  { key: 'qc_comments', label: 'QC Comments', value: job => textFrom(latestQualityControlFormData(job), 'comments') },
  { key: 'qc_media_count', label: 'QC Media Count', value: job => job.quality_control_media_count ?? 0 },
  { key: 'qc_subcontractor_submission_total', label: 'Subcontractor QC Submission Total', value: job => job.quality_control_subcontractor_total_submissions ?? '' },
  { key: 'qc_subcontractor_score_total', label: 'Subcontractor QC Score Total', value: job => job.quality_control_subcontractor_total_score ?? '' },
  { key: 'qc_subcontractor_score_average', label: 'Subcontractor QC Score Average', value: job => job.quality_control_subcontractor_average_score ?? '' },
  { key: 'qc_subcontractor_score_average_percent', label: 'Subcontractor QC Score Average %', value: job => job.quality_control_subcontractor_average_percent ?? '' },
  ...QUALITY_CONTROL_SECTION_REPORT_COLUMNS,
  ...QUALITY_CONTROL_ITEM_REPORT_COLUMNS,
  { key: 'work_order_submitted', label: 'Work Order Submitted', value: job => formatDate(textFrom(firstWorkOrder(job), 'submission_date')) },
  { key: 'occupied', label: 'Occupied', value: job => yesNo(valueFrom(firstWorkOrder(job), 'is_occupied')) },
  { key: 'full_paint', label: 'Full Paint', value: job => yesNo(valueFrom(firstWorkOrder(job), 'is_full_paint')) },
  { key: 'sprinklers', label: 'Sprinklers', value: job => yesNo(valueFrom(firstWorkOrder(job), 'has_sprinklers')) },
  { key: 'sprinklers_painted', label: 'Sprinklers Painted', value: job => yesNo(valueFrom(firstWorkOrder(job), 'sprinklers_painted')) },
  { key: 'painted_ceilings', label: 'Painted Ceilings', value: job => yesNo(valueFrom(firstWorkOrder(job), 'painted_ceilings')) },
  { key: 'ceiling_rooms_count', label: 'Ceiling Rooms Count', value: job => valueFrom(firstWorkOrder(job), 'ceiling_rooms_count') as number | string | null | undefined },
  { key: 'painted_patio', label: 'Painted Patio', value: job => yesNo(valueFrom(firstWorkOrder(job), 'painted_patio')) },
  { key: 'painted_garage', label: 'Painted Garage', value: job => yesNo(valueFrom(firstWorkOrder(job), 'painted_garage')) },
  { key: 'painted_cabinets', label: 'Painted Cabinets', value: job => yesNo(valueFrom(firstWorkOrder(job), 'painted_cabinets')) },
  { key: 'painted_crown_molding', label: 'Painted Crown Molding', value: job => yesNo(valueFrom(firstWorkOrder(job), 'painted_crown_molding')) },
  { key: 'painted_front_door', label: 'Painted Front Door', value: job => yesNo(valueFrom(firstWorkOrder(job), 'painted_front_door')) },
  { key: 'accent_wall', label: 'Accent Wall', value: job => yesNo(valueFrom(firstWorkOrder(job), 'has_accent_wall')) },
  { key: 'accent_wall_type', label: 'Accent Wall Type', value: job => textFrom(firstWorkOrder(job), 'accent_wall_type') },
  { key: 'accent_wall_count', label: 'Accent Wall Count', value: job => valueFrom(firstWorkOrder(job), 'accent_wall_count') as number | string | null | undefined },
  { key: 'extra_charges', label: 'Extra Charges', value: job => yesNo(valueFrom(firstWorkOrder(job), 'has_extra_charges')) },
  { key: 'extra_hours', label: 'Extra Hours', value: job => valueFrom(firstWorkOrder(job), 'extra_hours') as number | string | null | undefined },
  { key: 'extra_charges_description', label: 'Extra Charges Description', value: job => textFrom(firstWorkOrder(job), 'extra_charges_description') },
  { key: 'additional_comments', label: 'Additional Comments', value: job => textFrom(firstWorkOrder(job), 'additional_comments') },
  { key: 'created_at', label: 'Date Created', value: job => formatDate(job.created_at) },
  { key: 'updated_at', label: 'Last Updated', value: job => formatDate(job.updated_at) },
];

export const DEFAULT_REPORT_COLUMNS = [
  'work_order_num',
  'scheduled_date',
  'property',
  'unit_number',
  'unit_size',
  'job_type',
  'job_category',
  'phase',
  'assigned_to',
  'base_billing',
  'extra_charges_total',
  'total_billing_amount',
  'sub_pay',
  'created_at',
];

const DAILY_WORK_ORDER_REPORT_COLUMNS = DEFAULT_REPORT_COLUMNS.filter(column => column !== 'created_at');

export async function fetchReportTemplates(): Promise<ReportTemplate[]> {
  const { data, error } = await supabase
    .from('report_templates')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  // Exclude preset templates stored in the DB so the UI only shows user-created templates
  const rows = (data || []).filter((row: any) => !row.preset);

  return rows.map(row => ({
     id: row.id,
     name: row.name,
     columns: normalizeColumns(row.columns),
     filters: row.filters || {},
     sort: row.sort || {},
     user_id: row.user_id,
     created_at: row.created_at,
     updated_at: row.updated_at,
   }));
}

export async function saveReportTemplate(template: Pick<ReportTemplate, 'id' | 'name' | 'columns'> & { preset?: boolean }) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('You must be signed in to save report templates.');

  // Allow optional filters to be saved (e.g., phases selection)
  const payload: Record<string, unknown> = {
    user_id: authData.user.id,
    name: template.name,
    columns: template.columns,
  };
  // Attach filters if provided
  if ((template as any).filters) payload.filters = (template as any).filters;

  if (template.id && !template.id.startsWith('tmp-') && !template.preset) {
    const { error } = await supabase
      .from('report_templates')
      .update(payload)
      .eq('id', template.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from('report_templates')
    .insert([payload]);
  if (error) throw new Error(error.message);
}

export async function deleteReportTemplate(id: string) {
  const { error } = await supabase
    .from('report_templates')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteReportRun(id: string) {
  const { error } = await supabase
    .from('report_runs')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function fetchReportRuns(): Promise<ReportRun[]> {
  const { data, error } = await supabase
    .from('report_runs')
    .select('id, template_id, params, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  return (data || []).map(row => {
    const params = objectFrom(row.params);
    const report = generatedReportFromParams(params);

    return {
      id: row.id,
      template_id: row.template_id,
      template_name: String(params?.templateName || report?.templateName || 'Report'),
      from: typeof params?.from === 'string' ? params.from : report?.from,
      to: typeof params?.to === 'string' ? params.to : report?.to,
      row_count: typeof params?.rowCount === 'number' ? params.rowCount : report?.rows.length,
      status: row.status || 'completed',
      created_at: row.created_at,
      report,
    };
  });
}

export async function generateReport(params: {
  from: string;
  to: string;
  template: ReportTemplate;
}): Promise<GeneratedReport> {
  const selectedColumns = resolveColumns(params.template.columns);
  const needsSubPay = selectedColumns.some(column => column.key === 'sub_pay');
  const needsQualityControl = selectedColumns.some(column => column.key.startsWith('qc_'));
  const from = `${params.from}T00:00:00`;
  const to = `${params.to}T23:59:59`;

  // Server-side phase filtering: if template.filters.phases is provided, resolve labels to phase ids
  const phasesParam = params.template.filters?.phases as unknown;
  let phaseIds: string[] | null = null;
  if (Array.isArray(phasesParam)) {
    // If ALL, leave phaseIds null to include all
    if (phasesParam.includes('ALL')) {
      phaseIds = null;
    } else if (phasesParam.includes('ALL_EXCEPT_ARCHIVED')) {
      // load all phase ids except Archived
      try {
        const { data: allPhases } = await supabase.from('job_phases').select('id, job_phase_label');
        if (Array.isArray(allPhases)) {
          phaseIds = allPhases.filter(p => String(p.job_phase_label).toLowerCase() !== 'archived').map(p => String(p.id));
        }
      } catch (e) {
        console.warn('Could not resolve phases for ALL_EXCEPT_ARCHIVED', e);
      }
    } else if (phasesParam.length > 0) {
      try {
        const { data: matched } = await supabase.from('job_phases').select('id').in('job_phase_label', phasesParam as string[]);
        if (Array.isArray(matched)) phaseIds = matched.map(m => String(m.id));
      } catch (e) {
        console.warn('Could not resolve requested phase labels to ids', e);
      }
    }
  }

  const query = supabase
    .from('jobs')
    .select(`
     id,
     work_order_num,
     unit_number,
     description,
     scheduled_date,
     created_at,
     updated_at,
     purchase_order,
     assigned_to,
     total_billing_amount,
     active_snapshot_id,
     historical_data_mode,
     cancellation_trip_charge_added,
     cancellation_trip_charge_bill_amount,
     cancellation_trip_charge_sub_pay_amount,
     invoice_sent,
     invoice_paid,
     property:properties(property_name),
     unit_size:unit_sizes(unit_size_label),
     job_phase:current_phase_id(job_phase_label),
     job_type:job_types(job_type_label),
     job_category:job_categories(name),
     assigned_to_profile:assigned_to(full_name),
     work_orders(
       id,
       unit_size,
       is_occupied,
       is_full_paint,
       has_sprinklers,
       sprinklers_painted,
       painted_ceilings,
       ceiling_rooms_count,
       painted_patio,
       painted_garage,
       painted_cabinets,
       painted_crown_molding,
       painted_front_door,
       has_accent_wall,
       accent_wall_type,
       accent_wall_count,
       has_extra_charges,
       extra_charges_description,
       extra_hours,
       additional_comments,
       is_active,
       submission_date,
       created_at
     )
   `)
    .gte('scheduled_date', from)
    .lte('scheduled_date', to)
    .order('scheduled_date', { ascending: true });

  // Apply phase id filter if resolved. Use current_phase_id column.
  if (Array.isArray(phaseIds)) {
    if (phaseIds.length === 0) {
      // no matching phases => return empty result early
      return {
        templateName: params.template.name,
        from: params.from,
        to: params.to,
        filename: `${slugify(params.template.name)}_${params.from}_${params.to}.csv`,
        headers: selectedColumns.map(c => c.label),
        rows: [],
        csv: toCsv([], selectedColumns.map(c => c.label)),
      };
    }
    query.in('current_phase_id', phaseIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Jobs returned from Supabase (possibly already filtered by phaseIds above)
  let jobs = (data || []) as ReportJob[];

  const needsBillingTotals = selectedColumns.some(column => column.key === 'total_billing_amount' || column.key === 'sub_pay');
  if (needsBillingTotals || needsSubPay) {
    jobs = await enrichJobsWithBillingTotals(jobs);
  }

  if (needsQualityControl) {
    jobs = await enrichJobsWithQualityControl(jobs);
  }

  const rows = jobs.map(job => {
    const row: ReportRow = {};
    selectedColumns.forEach(column => {
      row[column.label] = column.value(job);
    });
    return row;
  });

  // Prepare CSV rows: format currency and percent columns for CSV output only
  const csvRows = rows.map(r => {
    const out: Record<string, unknown> = {};
    // Use the same header labels as the preview window formatting so CSV matches displayed report
    const currencyHeaders = new Set([
      'Base Bill to Customer',
      'Base Pay to Subcontractor',
      'Base Profit',
      'Extra Charges Billing',
      'Extra Pay to Subcontractor',
      'Extra Profit',
      'Total Bill to Customer',
      'Sub Pay',
      'Total Profit'
    ]);
    const percentHeaders = new Set(['Profit Margin', 'Base Profit Margin', 'Extra Profit Margin', 'QC Score %', 'Subcontractor QC Score Average %']);
    for (const header of Object.keys(r)) {
      const val = r[header];
      if (val === null || val === undefined || val === '') {
        out[header] = '';
      } else if (currencyHeaders.has(header)) {
        out[header] = formatCurrency(val);
      } else if (percentHeaders.has(header)) {
        // if numeric, append % with two decimals; otherwise string
        const n = Number(val);
        out[header] = Number.isFinite(n) ? `${n.toFixed(2)}%` : String(val);
      } else {
        out[header] = val;
      }
    }
    return out;
  });

  const headers = selectedColumns.map(column => column.label);
  const csv = toCsv(csvRows, headers);
  const filename = `${slugify(params.template.name)}_${params.from}_${params.to}.csv`;
  const report = {
    templateName: params.template.name,
    from: params.from,
    to: params.to,
    filename,
    headers,
    rows,
    csv,
  };

  await saveReportRun(params.template, report);

  return report;
}

export async function exportReportCsv(params: {
  from: string;
  to: string;
  template: ReportTemplate;
}) {
  const report = await generateReport(params);
  downloadReportCsv(report);
  return report.rows.length;
}

export function downloadReportCsv(report: GeneratedReport) {
  downloadTextFile(report.csv, report.filename, 'text/csv;charset=utf-8;');
}

export function openReportInNewWindow(report: GeneratedReport) {
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('The report window was blocked by the browser.');
  }

  const currencyHeaders = new Set([
    'Base Bill to Customer',
    'Base Pay to Subcontractor',
    'Base Profit',
    'Extra Charges Billing',
    'Extra Pay to Subcontractor',
    'Extra Profit',
    'Total Bill to Customer',
    'Sub Pay',
    'Total Profit'
  ]);
  const percentHeaders = new Set(['Profit Margin', 'Base Profit Margin', 'Extra Profit Margin', 'QC Score %', 'Subcontractor QC Score Average %']);

  const tableHead = report.headers
    .map(header => `<th>${escapeHtml(header)}</th>`)
    .join('');
  const tableRows = report.rows
    .map(row => {
      const cells = report.headers.map(header => {
        const raw = row[header];
        let display = raw;
        if (raw === null || raw === undefined || raw === '') {
          display = '';
        } else if (currencyHeaders.has(header)) {
          // If it's already a formatted string, keep it; otherwise format
          const num = Number(raw);
          display = isFinite(num) ? formatCurrency(num) : String(raw);
        } else if (percentHeaders.has(header)) {
          const num = Number(raw);
          display = isFinite(num) ? `${num.toFixed(2)}%` : String(raw);
        } else {
          display = String(raw);
        }
        return `<td>${escapeHtml(display)}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.templateName)}</title>
  <style>
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #111827; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #4b5563; margin-bottom: 20px; }
    .wrap { overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
    table { border-collapse: collapse; width: 100%; min-width: 900px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-size: 13px; vertical-align: top; }
    th { background: #f9fafb; font-weight: 700; position: sticky; top: 0; }
    tr:nth-child(even) td { background: #fcfcfd; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.templateName)}</h1>
  <div class="meta">${escapeHtml(report.from)} to ${escapeHtml(report.to)} · ${report.rows.length} ${report.rows.length === 1 ? 'row' : 'rows'}</div>
  <div class="wrap">
    <table>
      <thead><tr>${tableHead}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
</body>
</html>`);
  win.document.close();
}

async function saveReportRun(template: ReportTemplate, report: GeneratedReport) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('You must be signed in to save report history.');

  const { error } = await supabase.from('report_runs').insert([{
    user_id: authData.user.id,
    template_id: template.preset ? null : template.id,
    params: {
      from: report.from,
      to: report.to,
      templateName: report.templateName,
      rowCount: report.rows.length,
      report,
    },
    status: 'completed',
  }]);

  if (error) {
    throw new Error(`Report generated, but could not be saved to Report History: ${error.message}`);
  }
}

async function enrichJobsWithBillingTotals(jobs: ReportJob[]): Promise<ReportJob[]> {
  const snapshotTotals = await fetchSnapshotTotals(jobs);

  return Promise.all(jobs.map(async job => {
    // Always attempt to fetch detailed billing via RPC for the most accurate breakdown.
    try {
      const { data, error } = await supabase.rpc('get_job_details', { p_job_id: job.id });
      if (!error && data) {
        const totals = calculateBillingTotals(data, job);
        return {
          ...job,
          report_total_billing_amount: totals.bill,
          sub_pay_total: totals.sub,
          extra_charges_total: totals.extra ?? 0,
          extra_charges_list: totals.extraList ?? '',
          base_billing_total: totals.base ?? 0,
          base_pay_to_sub: totals.baseSub ?? 0,
          base_profit: Number(((totals.base ?? 0) - (totals.baseSub ?? 0)).toFixed(2)),
          base_profit_margin: totals.base ? Number(((((totals.base ?? 0) - (totals.baseSub ?? 0)) / (totals.base ?? 1)) * 100).toFixed(2)) : 0,
          extra_sub_total: totals.extraSub ?? 0,
          extra_profit: Number(((totals.extra ?? 0) - (totals.extraSub ?? 0)).toFixed(2)),
          extra_profit_margin: totals.extra ? Number((((totals.extra ?? 0) - (totals.extraSub ?? 0)) / (totals.extra ?? 1) * 100).toFixed(2)) : 0,
          extra_items: (totals.extraItems || []).map(i => `${i.description}${i.qty ? ' x'+i.qty : ''} | $${Number(i.bill).toFixed(2)} | $${Number(i.sub).toFixed(2)} | $${Number(i.profit).toFixed(2)}`).join(';; '),
        };
      }
    } catch (e) {
      console.warn(`get_job_details RPC failed for job ${job.id}, will fall back to snapshot totals if available`, e);
    }

    // If RPC failed or returned no data, fall back to snapshot totals when available
    const snapshot = job.active_snapshot_id ? snapshotTotals.get(job.active_snapshot_id) : undefined;
    if (snapshot) {
      // If the job is in a Cancelled phase, treat the snapshot bill as 'extras' (ignore base)
      const phaseLabel = String(textFrom(job.job_phase, 'job_phase_label') || '').toLowerCase();
      const isPhaseCancelled = phaseLabel.includes('cancel');

      if (isPhaseCancelled) {
        return {
          ...job,
          report_total_billing_amount: snapshot.bill,
          sub_pay_total: snapshot.sub,
          extra_charges_total: snapshot.bill,
          extra_charges_list: 'Snapshot (Cancelled)',
          base_billing_total: 0,
          base_pay_to_sub: 0,
          base_profit: 0,
          base_profit_margin: 0,
          extra_sub_total: snapshot.sub,
          extra_profit: Number((snapshot.bill - snapshot.sub).toFixed(2)),
          extra_profit_margin: snapshot.bill ? Number((((snapshot.bill - snapshot.sub) / snapshot.bill) * 100).toFixed(2)) : 0,
          extra_items: '',
        };
      }

      return {
        ...job,
        report_total_billing_amount: snapshot.bill,
        sub_pay_total: snapshot.sub,
        extra_charges_total: 0,
        extra_charges_list: '',
        base_billing_total: snapshot.bill,
        base_pay_to_sub: snapshot.sub,
        base_profit: Number((snapshot.bill - snapshot.sub).toFixed(2)),
        base_profit_margin: snapshot.bill ? Number((((snapshot.bill - snapshot.sub) / snapshot.bill) * 100).toFixed(2)) : 0,
        extra_sub_total: 0,
        extra_profit: 0,
        extra_profit_margin: 0,
        extra_items: '',
      };
    }

    // Last resort: unable to fetch details or snapshot, fall back to best-effort numbers from job
    return {
      ...job,
      report_total_billing_amount: billingTotalForReport(job),
      sub_pay_total: '',
      extra_charges_total: 0,
      extra_charges_list: '',
      base_billing_total: 0,
      base_pay_to_sub: 0,
      base_profit: 0,
      base_profit_margin: 0,
      extra_sub_total: 0,
      extra_profit: 0,
      extra_profit_margin: 0,
      extra_items: '',
    };
  }));
}

async function enrichJobsWithQualityControl(jobs: ReportJob[]): Promise<ReportJob[]> {
  const jobIds = jobs.map(job => job.id).filter(Boolean);
  if (jobIds.length === 0) return jobs;

  const { data, error } = await supabase
    .from('job_quality_control_submissions')
    .select('id, job_id, form_data, score_total, media_files, created_at, updated_at')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load Quality Control report data: ${error.message}`);
  }

  const submissionsByJobId = new Map<string, QualityControlSubmissionRecord[]>();
  const subcontractorAggregates = new Map<string, SubcontractorQualityControlAggregate>();

  ((data || []) as QualityControlSubmissionRecord[]).forEach((submission) => {
    const submissions = submissionsByJobId.get(submission.job_id) || [];
    submissions.push(submission);
    submissionsByJobId.set(submission.job_id, submissions);

    const key = qualityControlSubcontractorKey(submission);
    if (!key) return;

    const aggregate = subcontractorAggregates.get(key) || {
      submissions: 0,
      totalScore: 0,
      averageScore: 0,
    };
    aggregate.submissions += 1;
    aggregate.totalScore += numberFrom(submission.score_total);
    aggregate.averageScore = aggregate.submissions ? aggregate.totalScore / aggregate.submissions : 0;
    subcontractorAggregates.set(key, aggregate);
  });

  return jobs.map(job => {
    const submissions = submissionsByJobId.get(job.id) || [];
    const latest = submissions[0] || null;
    const aggregate = latest ? subcontractorAggregates.get(qualityControlSubcontractorKey(latest) || '') : undefined;

    return {
      ...job,
      quality_control_submissions: submissions,
      quality_control_latest: latest,
      quality_control_submission_count: submissions.length,
      quality_control_media_count: latest ? qualityControlMediaCount(latest.media_files) : 0,
      quality_control_subcontractor_total_submissions: aggregate?.submissions,
      quality_control_subcontractor_total_score: aggregate ? Number(aggregate.totalScore.toFixed(2)) : undefined,
      quality_control_subcontractor_average_score: aggregate ? Number(aggregate.averageScore.toFixed(2)) : undefined,
      quality_control_subcontractor_average_percent: aggregate && QUALITY_CONTROL_SCORE_TOTAL
        ? Number(((aggregate.averageScore / QUALITY_CONTROL_SCORE_TOTAL) * 100).toFixed(2))
        : undefined,
    };
  });
}

async function fetchSnapshotTotals(jobs: ReportJob[]) {
  const snapshotIds = Array.from(new Set(jobs.map(job => job.active_snapshot_id).filter((id): id is string => Boolean(id))));
  const totals = new Map<string, { bill: number; sub: number }>();
  if (snapshotIds.length === 0) return totals;

  try {
    const { data, error } = await supabase
      .from('job_snapshots')
      .select('id, total_bill, total_sub_pay')
      .in('id', snapshotIds);

    if (error) {
      console.warn('Unable to load report snapshot billing totals:', error);
      return totals;
    }

    (data || []).forEach((snapshot: any) => {
      totals.set(snapshot.id, {
        bill: numberFrom(snapshot.total_bill),
        sub: numberFrom(snapshot.total_sub_pay),
      });
    });
  } catch (e) {
    console.warn('Error fetching snapshot totals for reports:', e);
  }

  return totals;
}

export function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

// End of helpers

function calculateBillingTotals(details: unknown, job: ReportJob): BillingTotals & { extra?: number; extraList?: string; base?: number; baseSub?: number; extraSub?: number; extraItems?: {description:string,unit?:string,qty?:number,bill:number,sub:number,profit:number}[] } {
  const jobDetails = details as Record<string, unknown> | null;
  if (!jobDetails) {
    const b = numberFrom(job.total_billing_amount);
    return {
      bill: b,
      sub: 0,
      extra: 0,
      extraList: '',
      base: 0,
      baseSub: 0,
      extraSub: 0,
      extraItems: [],
    };
  }

  if (isCancellationTripChargeJob(job, jobDetails)) {
    const cBill = numberFrom(job.cancellation_trip_charge_bill_amount, jobDetails.cancellation_trip_charge_bill_amount);
    const cSub = numberFrom(job.cancellation_trip_charge_sub_pay_amount, jobDetails.cancellation_trip_charge_sub_pay_amount);
    return {
      bill: cBill,
      sub: cSub,
      extra: cBill || 0,
      extraList: 'Cancellation Trip Charge',
      base: 0,
      baseSub: 0,
      extraSub: cSub || 0,
      extraItems: [{ description: 'Cancellation Trip Charge', bill: Number((cBill || 0).toFixed(2)), sub: Number((cSub || 0).toFixed(2)), profit: Number(((cBill || 0) - (cSub || 0)).toFixed(2)) }],
    };
  }

  const workOrder = objectFrom(jobDetails.work_order);
  const base = objectFrom(jobDetails.billing_details);
  const extra = objectFrom(jobDetails.extra_charges_details);
  const storedBill = numberFrom(job.total_billing_amount);
  const baseBill = numberFrom(base?.bill_amount, base?.base_price);
  const baseSub = numberFrom(base?.sub_pay_amount);

  // non-base components that we'll attribute as 'extra'
  let nonBaseBill: number = 0;
  let nonBaseSub: number = 0;

  const extraItems: {description:string,unit?:string,qty?:number,bill:number,sub:number,profit:number}[] = [];

  const extraLineItems = arrayFrom(workOrder?.extra_charges_line_items);
  if (extraLineItems.length > 0) {
    const lineTotals = extraLineItems.reduce(function(sum: {bill:number; sub:number}, item: any) {
      const quantity = numberFrom(item.quantity);
      const billRate = numberFrom(item.billRate);
      const subRate = numberFrom(item.subRate);
      const billAmount = numberFrom(item.calculatedBillAmount, quantity * billRate);
      const subAmount = numberFrom(item.calculatedSubAmount, quantity * subRate);
      return { bill: (sum.bill || 0) + billAmount, sub: (sum.sub || 0) + subAmount };
    }, { bill: 0, sub: 0 } as { bill: number; sub: number });

    // Coerce to Number to satisfy TypeScript narrowing (reduce items may be unknown)
    nonBaseBill += Number(lineTotals.bill);
    nonBaseSub += Number(lineTotals.sub);

    extraLineItems.forEach((item: any) => {
      const qty = numberFrom(item.quantity);
      const desc = String(item.description ?? item.name ?? item.item ?? '');
      const unit = String(item.unit ?? item.unit_type ?? '');
      const amt = numberFrom(item.calculatedBillAmount, qty * numberFrom(item.billRate));
      const subAmt = numberFrom(item.calculatedSubAmount, qty * numberFrom(item.subRate));
      const profit = Number((amt - subAmt).toFixed(2));
      extraItems.push({ description: desc, unit: unit || undefined, qty: qty || undefined, bill: Number(amt.toFixed(2)), sub: Number(subAmt.toFixed(2)), profit });
    });
  } else {
    const eBill = numberFrom(extra?.bill_amount);
    const eSub = numberFrom(extra?.sub_pay_amount);
    nonBaseBill += eBill;
    nonBaseSub += eSub;
    if (extra && (extra?.bill_amount || extra?.sub_pay_amount)) {
      extraItems.push({ description: String(extra?.description ?? 'Extra Charges'), bill: Number(eBill.toFixed(2)), sub: Number(eSub.toFixed(2)), profit: Number((eBill - eSub).toFixed(2)) });
    }
  }

  const frozenLines = arrayFrom(workOrder?.frozen_billing_lines);
  const additionalServices = arrayFrom(workOrder?.additional_services);
  const frozenBill = frozenLines.reduce<number>((sum, line) => sum + numberFrom(line.amountBill, line.bill_amount), 0);
  const frozenSubPay = frozenLines.reduce<number>((sum, line) => sum + numberFrom(line.amountSub, line.sub_pay_amount), 0);
  const additionalBill = additionalServices.reduce<number>((sum, service) => sum + numberFrom(service.amountBill, service.bill_amount), 0);
  const additionalSubPay = additionalServices.reduce<number>((sum, service) => sum + numberFrom(service.amountSub, service.sub_pay_amount), 0);
  if (frozenBill >= additionalBill) {
    nonBaseBill += frozenBill;
    nonBaseSub += frozenSubPay;
  } else {
    nonBaseBill += additionalBill;
    nonBaseSub += additionalSubPay;
  }

  if (jobDetails.cancellation_trip_charge_added) {
    const cBill = numberFrom(jobDetails.cancellation_trip_charge_bill_amount);
    const cSub = numberFrom(jobDetails.cancellation_trip_charge_sub_pay_amount);
    nonBaseBill += cBill;
    nonBaseSub += cSub;
    extraItems.push({ description: 'Cancellation Trip Charge', bill: Number(cBill.toFixed(2)), sub: Number(cSub.toFixed(2)), profit: Number((cBill - cSub).toFixed(2)) });
  }

  nonBaseBill += numberFrom(jobDetails.repair_amount);
  nonBaseSub += numberFrom(jobDetails.repair_sub_pay);

  // If the job is in a Cancelled phase, we should ignore the base billing portion entirely
  const phaseLabel = String(jobDetails.phase_label ?? jobDetails.job_phase_label ?? textFrom(job.job_phase, 'job_phase_label') ?? '').toLowerCase();
  const isPhaseCancelled = phaseLabel.includes('cancel');

  const includeBase = !isPhaseCancelled && storedBill > 0 && baseBill > 0 && storedBill >= baseBill;
  const calculatedBill = (includeBase ? baseBill : 0) + nonBaseBill;
  // If job is cancelled, ignore stored base billing and treat total as the non-base components (extras/cancellation)
  const bill = storedBill > 0 && !isPhaseCancelled ? storedBill : nonBaseBill;
  const sub = bill > 0 ? (includeBase ? baseSub : 0) + nonBaseSub : 0;

  // Determine base portion:
  let basePortion = 0;
  if (isPhaseCancelled) {
    basePortion = 0;
  } else if (baseBill > 0) {
    basePortion = baseBill;
  } else if (storedBill > 0) {
    basePortion = Math.max(0, storedBill - nonBaseBill);
  } else {
    basePortion = 0;
  }

  const extraPortion = Number((bill - basePortion || 0).toFixed(2));
  const extraSubTotal = Number((nonBaseSub || 0).toFixed(2));
  const baseSubTotal = Number(((includeBase ? baseSub : 0)).toFixed(2));

  const baseProfit = Number((basePortion - baseSubTotal).toFixed(2));
  const baseMargin = basePortion ? Number(((baseProfit / basePortion) * 100).toFixed(2)) : 0;

  const extraProfit = Number((extraPortion - extraSubTotal).toFixed(2));
  const extraMargin = extraPortion ? Number(((extraProfit / extraPortion) * 100).toFixed(2)) : 0;

  return {
    bill: Number((bill || calculatedBill || 0).toFixed(2)),
    sub: Number(sub.toFixed(2)),
    extra: extraPortion,
    extraList: extraItems.map(i => `${i.description}${i.qty ? ' x'+i.qty : ''} (${i.bill.toFixed(2)})`).join('; '),
    base: Number(basePortion.toFixed(2)),
    baseSub: baseSubTotal,
    extraSub: extraSubTotal,
    extraItems,
  };
}

function billingTotalForReport(job: ReportJob) {
  if (job.report_total_billing_amount !== null && job.report_total_billing_amount !== undefined) {
    return job.report_total_billing_amount;
  }
  if (isCancellationTripChargeJob(job)) {
    return numberFrom(job.cancellation_trip_charge_bill_amount);
  }
  return job.total_billing_amount;
}

function isCancellationTripChargeJob(job: ReportJob, details?: Record<string, unknown> | null) {
  const cancellationAdded = Boolean(job.cancellation_trip_charge_added || details?.cancellation_trip_charge_added);
  if (!cancellationAdded) return false;

  const phaseLabel = textFrom(job.job_phase, 'job_phase_label') || String(details?.phase_label || details?.job_phase_label || '');
  return !phaseLabel || phaseLabel === 'Cancelled';
}

function latestQualityControlFormData(job: ReportJob) {
  return objectFrom(job.quality_control_latest?.form_data);
}

function latestQualityControlScores(job: ReportJob) {
  const formData = latestQualityControlFormData(job);
  const qualityScore = objectFrom(formData?.quality_score);
  return objectFrom(qualityScore?.categories);
}

function qualityControlSubcontractorKey(submission: QualityControlSubmissionRecord) {
  const formData = objectFrom(submission.form_data);
  const id = textFrom(formData, 'subcontractor_id');
  if (id) return `id:${id}`;

  const explicitName = textFrom(formData, 'subcontractor_name', 'painter_name');
  const fullName = [textFrom(formData, 'painter_first_name'), textFrom(formData, 'painter_last_name')].filter(Boolean).join(' ');
  const name = explicitName || fullName;
  return name ? `name:${name.toLowerCase()}` : '';
}

function qualityControlMediaCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function generatedReportFromParams(params: Record<string, unknown> | null): GeneratedReport | undefined {
  const report = objectFrom(params?.report);
  const headers = Array.isArray(report?.headers) ? report.headers.filter((header): header is string => typeof header === 'string') : [];
  const rawRows = Array.isArray(report?.rows) ? report.rows : [];
  const rows = rawRows.filter((row): row is ReportRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
  const csv = typeof report?.csv === 'string' ? report.csv : '';

  if (!headers.length || !csv) return undefined;

  return {
    templateName: String(report?.templateName || params?.templateName || 'Report'),
    from: String(report?.from || params?.from || ''),
    to: String(report?.to || params?.to || ''),
    filename: String(report?.filename || `${slugify(String(params?.templateName || 'report'))}.csv`),
    headers,
    rows,
    csv,
  };
}

function resolveColumns(keys: string[]) {
  const fallback = REPORT_COLUMNS.filter(column => DEFAULT_REPORT_COLUMNS.includes(column.key));
  const selected = normalizeColumns(keys)
    .map(key => REPORT_COLUMNS.find(column => column.key === key))
    .filter((column): column is ReportColumn => Boolean(column));

  return selected.length > 0 ? selected : fallback;
}

function normalizeColumns(columns: unknown): string[] {
  if (!Array.isArray(columns)) return DEFAULT_REPORT_COLUMNS;
  return columns
    .filter((column): column is string => typeof column === 'string')
    .map(column => column === 'paint_type' ? 'job_category' : column);
}

function firstWorkOrder(job: ReportJob) {
  if (!Array.isArray(job.work_orders)) return null;
  return job.work_orders.find(workOrder => valueFrom(workOrder, 'is_active') === true) || job.work_orders[0] || null;
}

function valueFrom(record: RelatedRecord, ...keys: string[]) {
  if (!record) return null;
  const target = Array.isArray(record) ? record[0] : record;
  if (!target) return null;
  for (const key of keys) {
    const value = target[key];
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function textFrom(record: RelatedRecord, ...keys: string[]) {
  const value = valueFrom(record, ...keys);
  return value === null || value === undefined ? '' : String(value);
}

function yesNo(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return value ? 'Yes' : 'No';
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatWorkOrderNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `WO-${String(numeric).padStart(6, '0')}` : String(value);
}

function formatCurrency(value: unknown) {
  const num = Number(value);
  if (!isFinite(num)) return '';
  return `$${num.toFixed(2)}`;
}

// Helper utilities (restored)
function objectFrom(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function arrayFrom(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function numberFrom(...values: unknown[]) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]) {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    const line = headers.map(h => escapeCsvValue(row[h])).join(',');
    lines.push(line);
  }
  return `${lines.join('\n')}\n`;
}

function escapeHtml(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';
}
