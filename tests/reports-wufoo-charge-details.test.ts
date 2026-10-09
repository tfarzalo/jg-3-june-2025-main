import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateReport, type ReportTemplate } from '../src/lib/reports';

const { database } = vi.hoisted(() => ({ database: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../src/utils/supabase', () => ({ supabase: database }));

const template: ReportTemplate = {
  id: 'saved-wufoo',
  name: 'Accounting Wufoo Export',
  columns: ['work_order_num', 'description', 'extra_items', 'total_billing_amount'],
  filters: { phases: ['ALL'] },
};

function queryWith(data: unknown[]) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'gte', 'lte', 'order', 'in']) query[method] = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return query;
}

async function run(details: Record<string, unknown>, job: Record<string, unknown> = {}) {
  const jobs = [{
    id: 'job-1', work_order_num: 500, description: 'Paint apartment', total_billing_amount: 100,
    job_phase: { job_phase_label: 'Completed Work Orders' }, work_orders: [], ...job,
  }];
  database.from.mockImplementation((table: string) => queryWith(table === 'jobs' ? jobs : []));
  database.rpc.mockResolvedValue({ data: details, error: null });
  return generateReport({ from: '2026-10-01', to: '2026-10-09', template, persistRun: false });
}

beforeEach(() => vi.clearAllMocks());

describe('Wufoo combined charge details', () => {
  it('includes every itemized extra charge beyond the old ten-item display limit', async () => {
    const extra_charges_line_items = Array.from({ length: 12 }, (_, index) => ({
      categoryName: 'Prep Work',
      detailName: `Repair ${index + 1}`,
      description: `Edited description ${index + 1}`,
      notes: `Note ${index + 1}`,
      quantity: index + 1,
      unit: 'hours',
      billRate: 10,
      subRate: 5,
    }));
    const report = await run({
      billing_details: { bill_amount: 100, sub_pay_amount: 50 },
      work_order: { extra_charges_line_items },
    });
    const descriptionHeader = report.headers.find(header => header.startsWith('Description,'))!;
    const value = String(report.rows[0][descriptionHeader]);

    expect(value).toContain('$10 Extra Charge - Prep Work: Repair 1 - Quantity/Hours: 1 hours - Edited description 1 - Notes: Note 1.');
    expect(value).toContain('$120 Extra Charge - Prep Work: Repair 12 - Quantity/Hours: 12 hours - Edited description 12 - Notes: Note 12.');
    expect(value.match(/ Extra Charge/g)).toHaveLength(12);
    expect(value).not.toContain('Paint apartment');
  });

  it('lists each miscellaneous cost separately with its own amount, description, and notes', async () => {
    const report = await run({
      billing_details: { bill_amount: 100, sub_pay_amount: 50 },
      work_order: { misc_additional_cost_items: [
        { price: 35, subPay: 12, description: 'Replacement lock', notes: 'Manager approved' },
        { price: 18.5, subPay: 5, description: 'Extra plastic' },
      ] },
    });
    const header = report.headers.find(value => value.startsWith('Description,'))!;
    const value = String(report.rows[0][header]);

    expect(value).toContain('$35 Misc Additional Cost - Replacement lock - Notes: Manager approved.');
    expect(value).toContain('$18.50 Misc Additional Cost - Extra plastic.');
  });

  it('includes legacy extra-charge amount and description', async () => {
    const report = await run({
      billing_details: { bill_amount: 100, sub_pay_amount: 50 },
      extra_charges_details: { bill_amount: 75, sub_pay_amount: 30, description: 'Legacy cabinet repair' },
      work_order: {},
    });
    const header = report.headers.find(value => value.startsWith('Description,'))!;
    expect(String(report.rows[0][header])).toContain('$75 Extra Charge - Extra Charges - Legacy cabinet repair.');
  });

  it('includes the cancellation trip amount and recorded cancellation reason', async () => {
    const cancelledJob = {
      cancellation_trip_charge_added: true,
      cancellation_trip_charge_bill_amount: 95,
      cancellation_trip_charge_sub_pay_amount: 40,
      job_phase: { job_phase_label: 'Cancelled' },
    };
    const jobs = [{ id: 'job-1', work_order_num: 500, description: 'Paint apartment', work_orders: [], ...cancelledJob }];
    database.from.mockImplementation((table: string) => queryWith(table === 'jobs' ? jobs : [{
      job_id: 'job-1',
      change_reason: 'Job cancelled by admin: Unit still occupied; Cancellation Trip Charge added ($95 bill / $40 sub pay)',
      changed_at: '2026-10-09T12:00:00Z',
    }]));
    database.rpc.mockResolvedValue({ data: cancelledJob, error: null });

    const report = await generateReport({ from: '2026-10-01', to: '2026-10-09', template, persistRun: false });
    const header = report.headers.find(value => value.startsWith('Description,'))!;
    expect(String(report.rows[0][header])).toContain('$95 Cancellation Trip Charge - Reason: Unit still occupied.');
  });
});
