import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../supabase/migrations/20261028030000_protect_subcontractor_extra_charge_hours.sql', import.meta.url),
  'utf8',
);
const section = readFileSync(
  new URL('../src/components/ExtraChargesSection.tsx', import.meta.url),
  'utf8',
);
const englishForm = readFileSync(
  new URL('../src/components/NewWorkOrder.tsx', import.meta.url),
  'utf8',
);
const previewForm = readFileSync(
  new URL('../src/components/NewWorkOrderPreview.tsx', import.meta.url),
  'utf8',
);

describe('subcontractor work-order billing permissions', () => {
  it('makes the billing customization permission explicit and fail-closed', () => {
    expect(section).toContain('canCustomizeBillingHours: boolean;');
    expect(section).not.toMatch(/canCustomizeBillingHours\s*=\s*true/);
    expect(englishForm).toContain(
      'const canCustomizeBillingHours = !roleLoading && role !== null && !isSubcontractor;',
    );
    expect(previewForm).toContain(
      'const canCustomizeBillingHours = !roleLoading && role !== null && !isSubcontractor;',
    );
  });

  it('canonicalizes only inserts and rejects subcontractor updates through RLS', () => {
    expect(migration).toContain('BEFORE INSERT ON public.work_orders');
    expect(migration).not.toContain('BEFORE INSERT OR UPDATE');
    expect(migration).toContain('CREATE POLICY "Internal users can update work orders"');
    expect(migration).toMatch(/FOR UPDATE[\s\S]*USING \(public\.is_internal_admin_user\(\)\)/);
  });

  it('accepts only active extra-charge details belonging to the work-order property', () => {
    expect(migration).toContain('bd.property_id = v_property_id');
    expect(migration).toContain('bc.property_id = v_property_id');
    expect(migration).toContain('bc.is_extra_charge IS TRUE');
    expect(migration).toContain('bc.archived_at IS NULL');
  });
});
