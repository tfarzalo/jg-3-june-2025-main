/**
 * Utility functions for billing category display logic
 * Phase 1: Extra Charges System Implementation
 */

export interface BillingCategory {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  include_in_work_order?: boolean;
  is_extra_charge?: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get the display name for a billing category
 * - Extra charge categories: "Extra Charges - {name}"
 * - Archived categories: "{name} (Archived)"
 * - Regular categories: "{name}"
 */
export function getBillingCategoryDisplayName(category: BillingCategory): string {
  if (category.archived_at) {
    return `${category.name} (Archived)`;
  }
  
  if (category.is_extra_charge) {
    return `Extra Charges - ${category.name}`;
  }
  
  return category.name;
}

/**
 * Get the internal name (without prefix/suffix) for a billing category
 */
export function getBillingCategoryInternalName(category: BillingCategory): string {
  return category.name;
}

/**
 * Check if category should appear in work order form as separate section
 * (Phase 2 integration point)
 */
export function shouldShowInWorkOrderSection(category: BillingCategory): boolean {
  return (
    category.include_in_work_order === true &&
    category.is_extra_charge !== true &&
    !category.archived_at
  );
}

/**
 * Check if category should appear in Extra Charges dropdown
 * (Phase 2 integration point)
 */
export function shouldShowInExtraChargesDropdown(category: BillingCategory): boolean {
  return (
    category.is_extra_charge === true &&
    !category.archived_at
  );
}

/**
 * Group billing categories by type for display
 * Returns: { active: [], extraCharges: [], archived: [] }
 */
export function groupBillingCategories(categories: BillingCategory[]) {
  const active = categories.filter(cat => 
    !cat.is_extra_charge && !cat.archived_at
  );
  
  const extraCharges = categories.filter(cat => 
    cat.is_extra_charge && !cat.archived_at
  );
  
  const archived = categories.filter(cat => 
    cat.archived_at !== null && cat.archived_at !== undefined
  );
  
  return {
    active,
    extraCharges,
    archived,
  };
}

/**
 * Validate category flags for mutual exclusivity
 * Returns error message if invalid, null if valid
 */
export function validateCategoryFlags(
  isExtraCharge: boolean,
  includeInWorkOrder: boolean
): string | null {
  if (isExtraCharge && includeInWorkOrder) {
    return 'A category cannot be both an Extra Charge and shown in Work Order. Please choose one option.';
  }
  return null;
}

/**
 * Check if a category is a system default (Labor, Materials, etc.)
 * Default categories cannot be marked as extra charges
 */
export function isDefaultCategory(categoryName: string): boolean {
  const defaultCategories = ['Labor', 'Materials', 'Paint', 'Repair'];
  return defaultCategories.includes(categoryName);
}

/**
 * Get badge variant for category display
 */
export function getCategoryBadgeInfo(category: BillingCategory): {
  variant: 'default' | 'secondary' | 'outline';
  text: string;
} | null {
  if (category.archived_at) {
    return { variant: 'outline', text: 'Archived' };
  }
  
  if (category.is_extra_charge) {
    return { variant: 'secondary', text: 'Extra Charge' };
  }
  
  if (isDefaultCategory(category.name)) {
    return { variant: 'default', text: 'System Default' };
  }
  
  return null;
}
