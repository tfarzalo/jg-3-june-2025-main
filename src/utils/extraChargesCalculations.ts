/**
 * Phase 2: Extra Charges Calculation Utilities
 */

import { ExtraChargeLineItem, ExtraChargesTotals } from '../types/extraCharges';

/**
 * Calculate bill and sub amounts based on quantity and rates
 */
export function calculateLineItemAmounts(
  quantity: number,
  billRate: number,
  subRate: number
): { billAmount: number; subAmount: number } {
  // Round to 2 decimal places to avoid floating point issues
  const billAmount = Math.round(quantity * billRate * 100) / 100;
  const subAmount = Math.round(quantity * subRate * 100) / 100;
  
  return {
    billAmount,
    subAmount,
  };
}

/**
 * Calculate totals for all line items
 */
export function calculateTotals(lineItems: ExtraChargeLineItem[]): ExtraChargesTotals {
  const totals = lineItems.reduce(
    (acc, item) => ({
      billAmount: acc.billAmount + item.calculatedBillAmount,
      subAmount: acc.subAmount + item.calculatedSubAmount,
    }),
    { billAmount: 0, subAmount: 0 }
  );
  
  return {
    ...totals,
    profitAmount: totals.billAmount - totals.subAmount,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate temporary ID for new line items (before saving to database)
 */
export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a line item has all required fields filled
 */
export function isLineItemComplete(item: ExtraChargeLineItem): boolean {
  return !!(
    item.categoryId &&
    item.detailId &&
    item.quantity > 0 &&
    item.jobBillingCategory
  );
}
