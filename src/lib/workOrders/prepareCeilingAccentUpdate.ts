import type { SupabaseClient } from '@supabase/supabase-js';
import { findBillingDetail, findPerCeilingRate, findAccentWallRate } from '../billing/lookups';

type FormValues = {
  // Map these keys to your actual form state names inside the call site.
  paintedCeilingsChecked: boolean;
  ceilingMode?: 'unitSize' | 'perCeiling';
  ceilingUnitSizeLabel?: string;   // e.g., "1 Bedroom"
  ceilingCount?: number;          // for per-ceiling path
  ceilingBillingDetailId?: string; // Direct billing detail ID from form

  accentWallChecked: boolean;
  accentWallType?: 'Paint Over' | 'Custom';
  accentWallCount?: number;
  accentWallBillingDetailId?: string; // Direct billing detail ID from form
};

export async function prepareCeilingAccentUpdate(
  supabase: SupabaseClient,
  propertyId: string,
  values: FormValues
): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = {};

  // Painted Ceilings
  if (values.paintedCeilingsChecked) {
    patch.painted_ceilings = true;

    // If we have a direct billing detail ID, use it
    if (values.ceilingBillingDetailId) {
      patch.ceiling_billing_detail_id = values.ceilingBillingDetailId;
      patch.individual_ceiling_count = values.ceilingMode === 'perCeiling' ? values.ceilingCount : null;
      patch.ceiling_display_label = values.ceilingUnitSizeLabel || (values.ceilingMode === 'perCeiling' ? 'Per Ceiling' : null);
    } else if (values.ceilingMode === 'unitSize' && values.ceilingUnitSizeLabel) {
      const bd = await findBillingDetail(supabase, {
        propertyId,
        categoryName: 'Painted Ceilings',
        unitSizeLabel: values.ceilingUnitSizeLabel,
      });
      patch.ceiling_billing_detail_id = bd?.id ?? null;
      patch.individual_ceiling_count = null;
      patch.ceiling_display_label = values.ceilingUnitSizeLabel;
    } else if (values.ceilingMode === 'perCeiling' && typeof values.ceilingCount === 'number') {
      const bd = await findPerCeilingRate(supabase, propertyId);
      patch.ceiling_billing_detail_id = bd?.id ?? null;
      patch.individual_ceiling_count = values.ceilingCount;
      patch.ceiling_display_label = 'Per Ceiling';
    }
  } else {
    patch.painted_ceilings = false;
    patch.ceiling_billing_detail_id = null;
    patch.individual_ceiling_count = null;
    patch.ceiling_display_label = null;
  }

  // Accent Wall
  if (values.accentWallChecked) {
    patch.has_accent_wall = true;

    const type = values.accentWallType ?? null;
    const count = typeof values.accentWallCount === 'number' && values.accentWallCount > 0
      ? values.accentWallCount
      : 1;

    // Store the simplified type that matches the database constraint
    patch.accent_wall_type = type;
    patch.accent_wall_count = count;

    // Use the billing detail ID directly if provided, otherwise try to find it
    if (values.accentWallBillingDetailId) {
      patch.accent_wall_billing_detail_id = values.accentWallBillingDetailId;
    } else if (type) {
      const aw = await findAccentWallRate(supabase, propertyId, type);
      patch.accent_wall_billing_detail_id = aw?.id ?? null;
    } else {
      // fall back to a generic Accent Wall rate if type omitted
      const aw = await findBillingDetail(supabase, {
        propertyId,
        categoryName: 'Accent Wall',
      });
      patch.accent_wall_billing_detail_id = aw?.id ?? null;
    }
  } else {
    patch.has_accent_wall = false;
    patch.accent_wall_type = null;
    patch.accent_wall_count = null;
    patch.accent_wall_billing_detail_id = null;
  }

  return patch;
}
