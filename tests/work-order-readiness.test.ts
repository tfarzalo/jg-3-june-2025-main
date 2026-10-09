import { describe, expect, it } from 'vitest';
import { getWorkOrderReadiness, type WorkOrderReadinessInput } from '../src/lib/workOrders/formReadiness';

const validBase = (overrides: Partial<WorkOrderReadinessInput> = {}): WorkOrderReadinessInput => ({
  unitNumber: 'M-141',
  jobCategoryId: 'category-id',
  unitSizeId: 'studio-id',
  isSubcontractor: false,
  isEditMode: true,
  beforeImagesPresent: false,
  hasSprinklers: true,
  sprinklerImagesPresent: false,
  paintedCeilings: false,
  ceilingMode: 'unit_size',
  ceilingOption: '',
  individualCeilingCount: null,
  hasAccentWall: false,
  accentWallType: '',
  accentWallCount: 0,
  hasExtraCharges: false,
  extraCharges: [],
  ...overrides,
});

describe('work-order form readiness', () => {
  it('allows an admin edit without subcontractor image evidence', () => {
    expect(getWorkOrderReadiness(validBase()).canSubmit).toBe(true);
  });

  it('does not require a sprinkler-form photo for subcontractor creation', () => {
    const result = getWorkOrderReadiness(validBase({
      isSubcontractor: true,
      isEditMode: false,
      beforeImagesPresent: true,
      sprinklerImagesPresent: true,
    }));
    expect(result.canSubmit).toBe(true);
  });

  it('keeps subcontractor before and sprinkler evidence requirements', () => {
    const result = getWorkOrderReadiness(validBase({ isSubcontractor: true, isEditMode: false }));
    expect(result.errors).toContain('At least one before image is required.');
    expect(result.errors).toContain('Sprinkler images are required when the unit has sprinklers.');
  });

  it('only requires ceiling subfields when ceilings are selected', () => {
    expect(getWorkOrderReadiness(validBase()).canSubmit).toBe(true);
    expect(getWorkOrderReadiness(validBase({ paintedCeilings: true })).canSubmit).toBe(false);
    expect(getWorkOrderReadiness(validBase({
      paintedCeilings: true,
      ceilingMode: 'individual',
      individualCeilingCount: 2,
    })).canSubmit).toBe(true);
  });

  it('only requires accent-wall subfields when accent walls are selected', () => {
    const result = getWorkOrderReadiness(validBase({ hasAccentWall: true }));
    expect(result.errors).toContain('Select an accent wall type.');
    expect(result.errors).toContain('Accent wall count must be greater than 0.');
  });
});
