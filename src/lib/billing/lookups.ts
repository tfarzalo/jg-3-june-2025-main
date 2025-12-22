import type { SupabaseClient } from '@supabase/supabase-js';

export type BillingDetail = {
  id: string;
  bill_amount: number | null;
  sub_pay_amount: number | null;
};

async function getBillingCategoryIdByName(
  supabase: SupabaseClient,
  name: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('billing_categories')
    .select('id')
    .eq('name', name)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('getBillingCategoryIdByName error', error);
    return null;
  }
  return data?.id ?? null;
}

async function getUnitSizeIdByLabel(
  supabase: SupabaseClient,
  label: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('unit_sizes')
    .select('id')
    .eq('unit_size_label', label)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('getUnitSizeIdByLabel error', error);
    return null;
  }
  return data?.id ?? null;
}

export async function findBillingDetail(
  supabase: SupabaseClient,
  params: {
    propertyId: string;
    categoryName: string;
    unitSizeLabel?: string;
    unitSizeId?: string;
  }
): Promise<BillingDetail | null> {
  const categoryId = await getBillingCategoryIdByName(supabase, params.categoryName);
  if (!categoryId) return null;

  let unitSizeId = params.unitSizeId ?? null;
  if (!unitSizeId && params.unitSizeLabel) {
    unitSizeId = await getUnitSizeIdByLabel(supabase, params.unitSizeLabel);
  }

  let q = supabase
    .from('billing_details')
    .select('id,bill_amount,sub_pay_amount')
    .eq('property_id', params.propertyId)
    .eq('category_id', categoryId);

  if (unitSizeId) q = q.eq('unit_size_id', unitSizeId);

  const { data, error } = await q.limit(1).maybeSingle();
  if (error) {
    console.warn('findBillingDetail error', error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    bill_amount: data.bill_amount ?? 0,
    sub_pay_amount: data.sub_pay_amount ?? 0,
  };
}

/**
 * Strategy: try to find a row for "Painted Ceilings" with a unit size that means "Paint Individual Ceiling".
 * Looks for "Paint Individual Ceiling" unit size label. If none, return null.
 */
export async function findPerCeilingRate(
  supabase: SupabaseClient,
  propertyId: string
): Promise<BillingDetail | null> {
  const bd = await findBillingDetail(supabase, {
    propertyId,
    categoryName: 'Painted Ceilings',
    unitSizeLabel: 'Paint Individual Ceiling',
  });
  return bd;
}

/**
 * Strategy: prefer a specific category by type if present, else fall back to "Accent Wall".
 * Tries: "Accent Wall - Paint Over" / "Accent Wall (Paint Over)" / "Accent Wall"
 * Same for "Custom".
 */
export async function findAccentWallRate(
  supabase: SupabaseClient,
  propertyId: string,
  accentWallType: 'Paint Over' | 'Custom'
): Promise<BillingDetail | null> {
  const nameCandidates = [
    `Accent Wall - ${accentWallType}`,
    `Accent Wall (${accentWallType})`,
    'Accent Wall',
  ];
  for (const name of nameCandidates) {
    const bd = await findBillingDetail(supabase, {
      propertyId,
      categoryName: name,
    });
    if (bd) return bd;
  }
  return null;
}
