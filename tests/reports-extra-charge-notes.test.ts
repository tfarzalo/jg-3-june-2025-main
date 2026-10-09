import { afterEach, describe, expect, it, vi } from 'vitest';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { downloadReportExcel, generateReport, PRESET_REPORT_TEMPLATES, reportIncludesExtraChargeNotes } from '../src/lib/reports';

const note = 'repair TV mount damage, "wall" repair\nand LED adhesive. MG';
const { database } = vi.hoisted(() => ({ database: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../src/utils/supabase', () => ({ supabase: database }));

const preset = PRESET_REPORT_TEMPLATES.find(template => template.id === 'preset-wufoo-style-billing')!;
const charge = (description: string, notes?: string) => ({
  categoryName: 'Prep Work', detailName: 'Drywall Repairs', description, notes,
  quantity: 1, billRate: 25, subRate: 10,
});

async function run(filters: Record<string, unknown> = {}, columns = preset.columns, name = preset.name) {
  const jobs = [{ id: 'job-1', description: 'Paint unit', work_order_num: 123,
    job_phase: { job_phase_label: 'Completed Work Orders' }, work_orders: [] }];
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'gte', 'lte', 'order', 'in']) query[method] = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: jobs, error: null }).then(resolve);
  database.from.mockReturnValue(query);
  database.rpc.mockResolvedValue({ data: {
    billing_details: { bill_amount: 100, sub_pay_amount: 50 },
    work_order: { extra_charges_line_items: [
      charge('Repair walls', note), charge('Repair door', 'Door note'),
      charge('Repair trim', '   '), charge('Repair ceiling'),
    ] },
  }, error: null });
  return generateReport({ from: '2026-09-01', to: '2026-09-10', persistRun: false,
    template: { ...preset, name, columns, filters: { ...preset.filters, phases: ['ALL'], ...filters } } });
}

afterEach(() => vi.unstubAllGlobals());

describe('extra-charge report notes', () => {
  it('defaults on for Wufoo presets and every template named Wufoo', () => {
    expect(reportIncludesExtraChargeNotes(preset)).toBe(true);
    expect(reportIncludesExtraChargeNotes({ ...preset, filters: { reportType: 'wufoo_style_billing' } })).toBe(true);
    expect(reportIncludesExtraChargeNotes({ ...preset, filters: {} })).toBe(true);
    expect(reportIncludesExtraChargeNotes({ ...preset, name: 'Customer WuFoO Export', filters: {} })).toBe(true);
    expect(reportIncludesExtraChargeNotes({ ...preset, name: 'Standard Billing', filters: {} })).toBe(false);
  });

  it('keeps notes with each charge in preview and CSV without changing amounts or headers', async () => {
    const report = await run();
    const without = await run({ includeExtraChargeNotes: false });
    const header = report.headers.find(value => value.startsWith('Description,'))!;
    const text = String(report.rows[0][header]);
    expect(text).toContain(`Repair walls - Notes: ${note}`);
    expect(text).toContain('Repair door - Notes: Door note');
    expect(text.match(/Notes:/g)).toHaveLength(2);
    expect(text.indexOf(note)).toBeLessThan(text.indexOf('Repair door'));
    expect(report.headers).toEqual(without.headers);
    for (const key of report.headers.filter(value => value !== header)) {
      expect(report.rows[0][key]).toEqual(without.rows[0][key]);
    }
    expect(String(without.rows[0][header])).not.toContain('Notes:');
    const parsed = Papa.parse<Record<string, string>>(report.csv, { header: true });
    expect(parsed.data[0][header]).toBe(text);
  });

  it('lets standard templates opt in and respects selected extra-charge items', async () => {
    const columns = ['extra_item_2', 'extra_item_3'];
    const report = await run({ reportType: undefined, includeExtraChargeNotes: true }, columns, 'Standard Billing');
    expect(report.rows[0]['Extra Charge 2']).toContain('Notes: Door note');
    expect(report.rows[0]['Extra Charge 3']).not.toContain('Notes:');
    expect(JSON.stringify(report.rows)).not.toContain('Repair walls');
    const original = await run({ reportType: undefined, includeExtraChargeNotes: undefined }, columns, 'Standard Billing');
    expect(JSON.stringify(original.rows)).not.toContain('Notes:');
  });

  it('preserves notes in the exported Excel workbook', async () => {
    const report = await run();
    let exported: Blob | undefined;
    vi.stubGlobal('window', { URL: {
      createObjectURL: (blob: Blob) => { exported = blob; return 'blob:test'; }, revokeObjectURL: vi.fn(),
    } });
    vi.stubGlobal('document', { createElement: () => ({ click: vi.fn(), remove: vi.fn() }),
      body: { appendChild: vi.fn() } });
    await downloadReportExcel(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exported!.arrayBuffer());
    const index = report.headers.findIndex(value => value.startsWith('Description,'));
    const cell = workbook.worksheets[0].getRow(2).getCell(index + 1);
    expect(cell.value).toBe(report.rows[0][report.headers[index]]);
    expect(cell.alignment.wrapText).toBe(true);
  });
});
