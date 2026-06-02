import type { SupabaseClient } from '@supabase/supabase-js';

export type CancellationTripChargeRate = {
  billAmount: number;
  subPayAmount: number;
};

export const DEFAULT_CANCELLATION_TRIP_CHARGE: CancellationTripChargeRate = {
  billAmount: 50,
  subPayAmount: 25,
};

export async function findCancellationTripChargeRate(
  supabase: SupabaseClient,
  params: {
    propertyId: string;
    unitSizeId?: string | null;
  }
): Promise<CancellationTripChargeRate | null> {
  const { data: category, error: categoryError } = await supabase
    .from('billing_categories')
    .select('id')
    .eq('property_id', params.propertyId)
    .ilike('name', 'Cancellation Trip Charge')
    .limit(1)
    .maybeSingle();

  if (categoryError) {
    console.warn('findCancellationTripChargeRate category lookup error', categoryError);
    return null;
  }

  if (!category?.id) {
    return null;
  }

  let query = supabase
    .from('billing_details')
    .select('bill_amount, sub_pay_amount')
    .eq('property_id', params.propertyId)
    .eq('category_id', category.id)
    .limit(1);

  if (params.unitSizeId) {
    query = query.eq('unit_size_id', params.unitSizeId);
  }

  const { data: detail, error: detailError } = await query.maybeSingle();

  if (detailError) {
    console.warn('findCancellationTripChargeRate detail lookup error', detailError);
    return null;
  }

  if (!detail) {
    return null;
  }

  return {
    billAmount: Number(detail.bill_amount ?? DEFAULT_CANCELLATION_TRIP_CHARGE.billAmount),
    subPayAmount: Number(detail.sub_pay_amount ?? DEFAULT_CANCELLATION_TRIP_CHARGE.subPayAmount),
  };
}
