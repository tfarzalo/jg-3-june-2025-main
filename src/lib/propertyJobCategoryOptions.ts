import { supabase } from '../utils/supabase';

export type PropertyJobCategoryOption = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  billing_category_id: string | null;
  billing_category_name: string | null;
  display_name: string;
  is_extra_charge: boolean;
  is_legacy_current_only?: boolean;
};

function normalizeCategoryName(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/[‐‑–—−]/g, '-')
    .trim()
    .toLowerCase();
}

function displayNameForBillingCategory(name: string, isExtraCharge: boolean): string {
  if (!isExtraCharge) return name;
  return normalizeCategoryName(name).startsWith('extra charges -')
    ? name
    : `Extra Charges - ${name}`;
}

export async function fetchPropertyJobCategoryOptions(
  propertyId: string,
  currentJobCategoryId?: string | null
): Promise<PropertyJobCategoryOption[]> {
  if (!propertyId) return [];

  const { data: billingCategories, error: billingError } = await supabase
    .from('billing_categories')
    .select('id, name, description, sort_order, is_extra_charge, archived_at')
    .eq('property_id', propertyId)
    .is('archived_at', null)
    .order('sort_order, name');

  if (billingError) throw billingError;

  const activeBillingCategories = (billingCategories || []).filter((category: any) => {
    const normalizedName = normalizeCategoryName(category.name);
    return normalizedName !== 'extra charges';
  });

  const categoryNames = Array.from(new Set(activeBillingCategories.map((category: any) => category.name)));
  const jobCategoryByName = new Map<string, any>();

  if (categoryNames.length > 0) {
    const { data: jobCategories, error: jobCategoryError } = await supabase
      .from('job_categories')
      .select('id, name, description, sort_order')
      .in('name', categoryNames)
      .order('sort_order, name');

    if (jobCategoryError) throw jobCategoryError;

    for (const category of jobCategories || []) {
      jobCategoryByName.set(normalizeCategoryName(category.name), category);
    }
  }

  const options: PropertyJobCategoryOption[] = [];
  for (const billingCategory of activeBillingCategories as any[]) {
    const jobCategory = jobCategoryByName.get(normalizeCategoryName(billingCategory.name));
    if (!jobCategory) continue;

    options.push({
      id: jobCategory.id,
      name: jobCategory.name,
      description: jobCategory.description,
      sort_order: billingCategory.sort_order ?? jobCategory.sort_order ?? 0,
      billing_category_id: billingCategory.id,
      billing_category_name: billingCategory.name,
      display_name: displayNameForBillingCategory(
        String(billingCategory.name),
        billingCategory.is_extra_charge === true
      ),
      is_extra_charge: billingCategory.is_extra_charge === true
    });
  }

  if (currentJobCategoryId && !options.some(option => option.id === currentJobCategoryId)) {
    const { data: currentCategory, error: currentError } = await supabase
      .from('job_categories')
      .select('id, name, description, sort_order')
      .eq('id', currentJobCategoryId)
      .maybeSingle();

    if (currentError) throw currentError;

    if (currentCategory) {
      options.push({
        id: currentCategory.id,
        name: currentCategory.name,
        description: currentCategory.description,
        sort_order: currentCategory.sort_order ?? 9999,
        billing_category_id: null,
        billing_category_name: null,
        display_name: `${currentCategory.name} (current legacy selection)`,
        is_extra_charge: normalizeCategoryName(currentCategory.name) === 'extra charges',
        is_legacy_current_only: true
      });
    }
  }

  return options.sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    return orderDiff || a.display_name.localeCompare(b.display_name);
  });
}
