import { beforeEach, describe, expect, it, vi } from 'vitest';
import Papa from 'papaparse';
import { generateReport, openReportInNewWindow, type ReportTemplate } from '../src/lib/reports';

const { database } = vi.hoisted(() => ({ database: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../src/utils/supabase', () => ({ supabase: database }));

const template: ReportTemplate = {
  id: 'combined-extra-charges',
  name: 'Combined Extra Charges',
  columns: ['work_order_num', 'extra_items', 'total_billing_amount', 'sub_pay'],
  filters: { phases: ['ALL'] },
};

function queryWith(data: unknown[]) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'gte', 'lte', 'order', 'in', 'eq']) query[method] = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  const jobs = [{
    id: 'job-1',
    work_order_num: 812,
    total_billing_amount: 295,
    job_phase: { job_phase_label: 'Work Order' },
    work_orders: [],
  }];
  database.from.mockImplementation((table: string) => queryWith(
    table === 'jobs' ? jobs : table === 'approval_tokens' ? [{
      job_id: 'job-1', approval_type: 'extra_charges', decision: 'approved', invalidated_at: null, created_at: '2026-10-13T12:00:00Z',
    }] : []
  ));
  database.rpc.mockResolvedValue({ data: {
    authoritative_billing_totals: {
      base_bill: 100, base_sub_pay: 50, standard_extra_bill: 100, standard_extra_sub_pay: 50,
      misc_bill: 95, misc_sub_pay: 30, total_bill: 295, total_sub_pay: 130,
      charges_approved: true, source: 'live_job_details',
    },
    billing_details: { bill_amount: 100, sub_pay_amount: 50 },
    work_order: {
      extra_charges_line_items: [{
        categoryName: 'High Ceiling', detailName: 'Labor', description: 'Vaulted ceiling',
        notes: 'Living room | approved', quantity: 2, isHourly: true,
        billRate: 50, subRate: 25, calculatedBillAmount: 100, calculatedSubAmount: 50,
      }],
      misc_additional_cost_items: [{
        description: 'Drywall supplies', notes: 'Purchased for unit repair', price: 95, subPay: 30,
      }],
    },
  }, error: null });
});

describe('combined extra-charge report column', () => {
  it('combines standard and miscellaneous customer totals with a pipe separator and no item-level sub pay', async () => {
    const report = await generateReport({
      from: '2026-10-01', to: '2026-10-31', template, persistRun: false,
    });
    const value = String(report.rows[0]['Extra Charge Items (Combined)']);

    expect(value).toBe(
      'High Ceiling: Labor — Vaulted ceiling — 2 hours — Total: $100.00 — Notes: Living room / approved | '
      + 'Misc Additional Cost — Drywall supplies — Total: $95.00 — Notes: Purchased for unit repair'
    );
    expect(value).not.toContain('Sub Pay');
    expect(value).not.toContain('$50.00');
    expect(value).not.toContain('$30.00');
    expect(report.rows[0]['Total Bill to Customer']).toBe(295);
    expect(report.rows[0]['Sub Pay']).toBe(130);
    expect(report.headers).toContain('Extra Charge Items (Combined)');
    expect(report.headers).not.toContain('Extra Charge 1');

    const parsed = Papa.parse<Record<string, string>>(report.csv, { header: true });
    expect(parsed.data[0]['Extra Charge Items (Combined)']).toBe(value);
  });

  it.each(['Repair', 'Callback'])('includes saved %s charges after an admin advances the job phase', async jobType => {
    const jobs = [{
      id: 'job-1', work_order_num: 812, total_billing_amount: 100,
      job_phase: { job_phase_label: 'Work Order' },
      job_type: { job_type_label: jobType }, work_orders: [],
    }];
    database.from.mockImplementation((table: string) => queryWith(table === 'jobs' ? jobs : []));
    database.rpc.mockResolvedValue({ data: {
      authoritative_billing_totals: {
        base_bill: 100, base_sub_pay: 50, standard_extra_bill: 0, standard_extra_sub_pay: 0,
        misc_bill: 0, misc_sub_pay: 0, total_bill: 100, total_sub_pay: 50,
        charges_approved: false, source: 'live_job_details',
      },
      billing_details: { bill_amount: 100, sub_pay_amount: 50 },
      work_order: {
        extra_charges_line_items: [{
          categoryName: 'Repair', detailName: 'Labor', description: 'Door repair',
          quantity: 1, billRate: 75, subRate: 35,
        }],
        misc_additional_cost_items: [{ description: 'Replacement hardware', price: 25, subPay: 10 }],
      },
    }, error: null });

    const report = await generateReport({ from: '2026-10-01', to: '2026-10-31', template, persistRun: false });
    expect(report.rows[0]['Extra Charge Items (Combined)']).toBe(
      'Repair: Labor — Door repair — 1 units — Total: $75.00 | Misc Additional Cost — Replacement hardware — Total: $25.00'
    );
    expect(report.rows[0]['Total Bill to Customer']).toBe(200);
    expect(report.rows[0]['Sub Pay']).toBe(95);
  });

  it('keeps every web-view column unwrapped except the combined-charge column', () => {
    let html = '';
    const popup = { document: { write: (value: string) => { html = value; }, close: vi.fn() } };
    vi.stubGlobal('window', { open: vi.fn(() => popup) });

    openReportInNewWindow({
      templateName: 'Widths', from: '2026-10-01', to: '2026-10-31', filename: 'widths.csv',
      headers: ['Property', 'Extra Charge Items (Combined)'],
      rows: [{ Property: 'A long property name', 'Extra Charge Items (Combined)': 'A long charge description' }],
      csv: '',
    });

    expect(html).toContain('<th class="nowrap-cell">Property</th>');
    expect(html).toContain('<th class="combined-charge-cell">Extra Charge Items (Combined)</th>');
    expect(html).toContain('.nowrap-cell { white-space: nowrap; width: 1%; }');
    expect(html).toContain('table { border-collapse: collapse; width: max-content; min-width: 100%; }');
    vi.unstubAllGlobals();
  });
});
