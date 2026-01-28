/**
 * Phase 2: Extra Charges Validation
 */

import { ExtraChargeLineItem, ExtraChargesValidationResult } from '../types/extraCharges';

/**
 * Validate a single extra charge line item
 */
export function validateExtraChargeLineItem(
  item: ExtraChargeLineItem,
  index: number
): string[] {
  const errors: string[] = [];
  const itemNumber = index + 1;

  if (!item.categoryId) {
    errors.push(`Extra Charge #${itemNumber}: Category is required`);
  }

  if (!item.detailId) {
    errors.push(`Extra Charge #${itemNumber}: Line item option is required`);
  }

  if (!item.quantity || item.quantity <= 0) {
    errors.push(`Extra Charge #${itemNumber}: Quantity must be greater than 0`);
  }

  if (item.quantity > 1000) {
    errors.push(`Extra Charge #${itemNumber}: Quantity seems unusually high (${item.quantity}). Please verify.`);
  }

  if (!item.jobBillingCategory) {
    errors.push(`Extra Charge #${itemNumber}: "Bill To" selection is required (Owner/Warranty/Tenant)`);
  }

  if (item.notes && item.notes.length > 500) {
    errors.push(`Extra Charge #${itemNumber}: Notes must be 500 characters or less (currently ${item.notes.length})`);
  }

  // Validate calculated amounts make sense
  if (item.calculatedBillAmount < 0) {
    errors.push(`Extra Charge #${itemNumber}: Calculated bill amount cannot be negative`);
  }

  if (item.calculatedSubAmount < 0) {
    errors.push(`Extra Charge #${itemNumber}: Calculated sub pay amount cannot be negative`);
  }

  return errors;
}

/**
 * Validate all extra charges in the form
 */
export function validateAllExtraCharges(
  lineItems: ExtraChargeLineItem[]
): ExtraChargesValidationResult {
  if (lineItems.length === 0) {
    return {
      isValid: false,
      errors: ['At least one extra charge line item is required when "Extra Charges Needed" is checked'],
    };
  }

  const allErrors: string[] = [];

  lineItems.forEach((item, index) => {
    const itemErrors = validateExtraChargeLineItem(item, index);
    allErrors.push(...itemErrors);
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Validate that extra charges can be added (property has categories configured)
 */
export function canAddExtraCharges(categoryCount: number): boolean {
  return categoryCount > 0;
}
