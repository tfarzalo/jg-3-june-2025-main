import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20261028010000_decouple_work_order_misc_cost_sync.sql'),
  'utf8',
);
const emptyDescriptionFix = readFileSync(
  resolve(root, 'supabase/migrations/20261028020000_preserve_empty_repair_description.sql'),
  'utf8',
);

describe('miscellaneous cost synchronization boundary', () => {
  it('keeps the work-order trigger free of jobs mutations', () => {
    const triggerFunction = migration.match(
      /CREATE OR REPLACE FUNCTION public\.sync_job_misc_costs_from_work_order\(\)([\s\S]*?)\$\$;/,
    )?.[1];

    expect(triggerFunction).toBeDefined();
    expect(triggerFunction).not.toContain('UPDATE public.jobs');
    expect(triggerFunction).toContain('NEW.repair_cost := round(v_bill, 2)');
  });

  it('syncs jobs only through the explicit admin RPC and only on change', () => {
    const rpc = migration.match(
      /CREATE OR REPLACE FUNCTION public\.save_misc_additional_costs\([\s\S]*?\)([\s\S]*?)\$\$;/,
    )?.[1];

    expect(rpc).toBeDefined();
    expect(rpc).toContain('UPDATE public.jobs');
    expect(rpc).toContain('repair_amount IS DISTINCT FROM round(v_bill, 2)');
    expect(rpc).toContain('repair_sub_pay IS DISTINCT FROM round(v_sub_pay, 2)');
  });

  it('preserves an empty string for an empty miscellaneous-cost array', () => {
    const triggerFunction = emptyDescriptionFix.match(
      /CREATE OR REPLACE FUNCTION public\.sync_job_misc_costs_from_work_order\(\)([\s\S]*?)\$\$;/,
    )?.[1];

    expect(triggerFunction).toBeDefined();
    expect(triggerFunction).toContain(
      "NEW.repair_description := COALESCE(NULLIF(v_description, ''), '')",
    );
    expect(triggerFunction).not.toContain("NEW.repair_description := NULLIF(v_description, '')");
  });
});
