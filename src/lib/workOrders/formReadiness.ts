import type { ExtraChargeLineItem } from '../../types/extraCharges';
import { validateAllExtraCharges } from '../../utils/extraChargesValidation';

export interface WorkOrderReadinessInput {
  unitNumber: string;
  jobCategoryId: string;
  unitSizeId: string;
  isSubcontractor: boolean;
  isEditMode: boolean;
  beforeImagesPresent: boolean;
  hasSprinklers: boolean;
  sprinklerImagesPresent: boolean;
  paintedCeilings: boolean;
  ceilingMode: 'unit_size' | 'individual';
  ceilingOption: string | number;
  individualCeilingCount: number | null;
  hasAccentWall: boolean;
  accentWallType: string;
  accentWallCount: number;
  hasExtraCharges: boolean;
  extraCharges: ExtraChargeLineItem[];
}

export interface WorkOrderReadinessResult {
  canSubmit: boolean;
  errors: string[];
}

/**
 * UI readiness rules shared by the English and Spanish work-order forms.
 * Persisted/database validation still runs during submission. In particular,
 * admin edits do not inherit subcontractor-only evidence requirements.
 */
export function getWorkOrderReadiness(input: WorkOrderReadinessInput): WorkOrderReadinessResult {
  const errors: string[] = [];

  if (!input.unitNumber.trim()) errors.push('Unit number is required.');
  if (!input.jobCategoryId) errors.push('Job category is required.');
  if (!input.unitSizeId) errors.push('Unit size is required.');

  if (input.isSubcontractor && !input.isEditMode) {
    if (!input.beforeImagesPresent) errors.push('At least one before image is required.');
    if (input.hasSprinklers && !input.sprinklerImagesPresent) {
      errors.push('Sprinkler images are required when the unit has sprinklers.');
    }
  }

  // A sprinkler-form photo is optional for every role. Checking that the form
  // was left in the unit never creates an image requirement.
  if (input.paintedCeilings) {
    if (input.ceilingMode === 'individual') {
      if (!input.individualCeilingCount || input.individualCeilingCount <= 0) {
        errors.push('Individual ceiling count must be greater than 0.');
      }
    } else if (!input.ceilingOption) {
      errors.push('Select a ceiling painting option.');
    }
  }

  if (input.hasAccentWall) {
    if (!input.accentWallType) errors.push('Select an accent wall type.');
    if (!input.accentWallCount || input.accentWallCount <= 0) {
      errors.push('Accent wall count must be greater than 0.');
    }
  }

  if (input.hasExtraCharges) {
    errors.push(...validateAllExtraCharges(input.extraCharges).errors);
  }

  return { canSubmit: errors.length === 0, errors };
}
