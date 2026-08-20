import { supabase } from '../utils/supabase';

export type UnitSize = { id: string; unit_size_label: string };

// Helper to fetch unit sizes tied to a property's "Regular Paint" billing setup.
// Appends global N/A and TBD unit sizes if present. Falls back to property's billing_details
// if no Regular Paint category is found, and ultimately to global unit_sizes as a last resort.
export async function fetchRegularPaintUnitSizes(propertyId: string): Promise<UnitSize[]> {
  if (!propertyId) return [];

  try {
    // First try to find billing_categories for this property named "Regular Paint" (case-insensitive)
    const { data: categories, error: catErr } = await supabase
      .from('billing_categories')
      .select('id, name')
      .eq('property_id', propertyId)
      .ilike('name', 'regular paint');

    if (catErr) throw catErr;

    let unitSizes: UnitSize[] = [];
    const seen = new Set<string>();

    if (Array.isArray(categories) && categories.length > 0) {
      const categoryIds = categories.map((c: any) => c.id);
      const { data: details, error: detErr } = await supabase
        .from('billing_details')
        .select('unit_size_id, unit_sizes!inner(id, unit_size_label)')
        .in('category_id', categoryIds)
        .eq('property_id', propertyId);

      if (!detErr && Array.isArray(details)) {
        for (const row of details) {
          const size = row.unit_sizes as any;
          if (size && !seen.has(size.id)) {
            seen.add(size.id);
            unitSizes.push({ id: size.id, unit_size_label: String(size.unit_size_label) });
          }
        }
      }
    }

    // If we didn't find regular-paint-specific unit sizes, fall back to any billing_details for property
    if (unitSizes.length === 0) {
      const { data: fallbackDetails, error: fbErr } = await supabase
        .from('billing_details')
        .select('unit_size_id, unit_sizes!inner(id, unit_size_label)')
        .eq('property_id', propertyId);

      if (!fbErr && Array.isArray(fallbackDetails)) {
        for (const row of fallbackDetails) {
          const size = row.unit_sizes as any;
          if (size && !seen.has(size.id)) {
            seen.add(size.id);
            unitSizes.push({ id: size.id, unit_size_label: String(size.unit_size_label) });
          }
        }
      }
    }

    // As a last resort, if still empty, load global unit_sizes
    if (unitSizes.length === 0) {
      const { data: globalSizes, error: gsErr } = await supabase
        .from('unit_sizes')
        .select('id, unit_size_label')
        .order('unit_size_label');
      if (!gsErr && Array.isArray(globalSizes)) {
        for (const s of globalSizes) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            unitSizes.push({ id: s.id, unit_size_label: String(s.unit_size_label) });
          }
        }
      }
    }

    unitSizes.sort((a, b) => a.unit_size_label.localeCompare(b.unit_size_label));

    // Append N/A and TBD if they exist and aren't already present
    try {
      const { data: naData } = await supabase.from('unit_sizes').select('id, unit_size_label').ilike('unit_size_label', 'n/a').maybeSingle();
      if (naData && !seen.has(naData.id)) {
        seen.add(naData.id);
        unitSizes.push({ id: naData.id, unit_size_label: String(naData.unit_size_label) });
      }
    } catch (e) {
      // ignore
    }

    try {
      const { data: tbdData } = await supabase.from('unit_sizes').select('id, unit_size_label').ilike('unit_size_label', 'tbd').maybeSingle();
      if (tbdData && !seen.has(tbdData.id)) {
        seen.add(tbdData.id);
        unitSizes.push({ id: tbdData.id, unit_size_label: String(tbdData.unit_size_label) });
      }
    } catch (e) {
      // ignore
    }

    return unitSizes;
  } catch (err) {
    console.error('fetchRegularPaintUnitSizes error:', err);
    return [];
  }
}
