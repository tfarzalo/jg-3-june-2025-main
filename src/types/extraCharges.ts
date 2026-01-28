/**
 * Phase 2: Extra Charges Type Definitions
 * Used in work order form for adding structured extra charges
 */

/**
 * Category with available line item options
 */
export interface ExtraChargeCategory {
  categoryId: string;
  categoryName: string;
  displayName: string; // "Extra Charges - {name}"
  lineItems: ExtraChargeLineItemOption[];
}

/**
 * Available billing option for a category
 */
export interface ExtraChargeLineItemOption {
  id: string;
  name: string; // "1 Bedroom", "Other", "Standard", etc.
  billAmount: number;
  subAmount: number;
  isHourly: boolean;
}

/**
 * Single extra charge line item (as stored in work order)
 */
export interface ExtraChargeLineItem {
  id: string; // Temporary ID for React keys (e.g., "temp-123")
  categoryId: string; // billing_categories.id
  categoryName: string; // For display
  detailId: string; // billing_details.id
  detailName: string; // For display
  quantity: number; // Hours (if hourly) or units (if fixed)
  billRate: number; // Rate per unit
  subRate: number; // Sub pay rate per unit
  isHourly: boolean;
  jobBillingCategory: 'owner' | 'warranty' | 'tenant';
  notes: string; // Optional description
  calculatedBillAmount: number; // quantity * billRate
  calculatedSubAmount: number; // quantity * subRate
}

/**
 * Form state for extra charges section
 */
export interface ExtraChargesFormState {
  hasExtraCharges: boolean;
  lineItems: ExtraChargeLineItem[];
}

/**
 * Validation result
 */
export interface ExtraChargesValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * API response type
 */
export interface FetchExtraChargesResponse {
  success: boolean;
  categories: ExtraChargeCategory[];
  error?: string;
}

/**
 * Totals calculation result
 */
export interface ExtraChargesTotals {
  billAmount: number;
  subAmount: number;
  profitAmount: number;
}
