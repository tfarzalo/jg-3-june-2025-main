import { supabase } from '../utils/supabase';

export type UnitSize = { id: string; unit_size_label: string };

// Helper to fetch unit sizes for a property's billing category.
// If categoryName is provided, the helper will try to load unit sizes only for that billing category name
// (case-insensitive). If categoryName is not provided, it will attempt to use the "Regular Paint" category
// (legacy behavior). The helper always appends N/A and TBD options if present.
export async function fetchPropertyUnitSizesForCategory(propertyId: string, categoryName?: string): Promise<UnitSize[]> {
  if (!propertyId) return [];

  try {
    const seen = new Set<string>();
    const unitSizes: UnitSize[] = [];

    // If a categoryName is provided, try to resolve billing_categories for that name
    if (categoryName) {
      const nameTrimmed = String(categoryName).trim();
      const nameLower = nameTrimmed.toLowerCase();

      // Fetch all billing categories for the property and then filter in JS to avoid
      // accidental wide SQL matches. This lets us strictly match either:
      // - exact name
      // - names that end with ' - <categoryName>' (e.g. 'Extra Charges - Painted Ceilings')
      // - special-case: when categoryName is 'Extra Charges' treat as prefix 'Extra Charges%'
      const { data: allCats, error: allCatsErr } = await supabase
        .from('billing_categories')
        .select('id, name')
        .eq('property_id', propertyId);

      if (allCatsErr) throw allCatsErr;

      const billingCats = (allCats || []).filter((c: any) => {
        const cName = String(c.name || '').trim().toLowerCase();
        if (!cName) return false;
        if (nameLower === 'extra charges') {
          // include any billing category that begins with 'extra charges'
          return cName.startsWith('extra charges');
        }
        // exact match
        if (cName === nameLower) return true;
        // ends with ' - <categoryName>'
        if (cName.endsWith(`- ${nameLower}`) || cName.endsWith(` - ${nameLower}`)) return true;
        // starts with '<categoryName> -'
        if (cName.startsWith(`${nameLower} -`)) return true;
        // contains ' <categoryName>' as a separate chunk
        if (cName.includes(` ${nameLower} `)) return true;
        return false;
      });

      if (billingCats.length > 0) {
        const categoryIds = billingCats.map((c: any) => c.id);
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

        if (unitSizes.length > 0) {
          unitSizes.sort((a, b) => a.unit_size_label.localeCompare(b.unit_size_label));
        }

        // Intentionally DO NOT fall back to other categories, billing_details, or global sizes
        // when a specific categoryName is provided. If none are found, only N/A/TBD will be appended.
      } else {
        // No matching billing category for this property; intentionally leave unitSizes empty
        // so that only N/A/TBD (if present) will be appended below.
      }

    } else {
      // No categoryName provided: legacy behavior -> try 'Regular Paint' then fall back to any billing_details
      const { data: categories, error: catErr } = await supabase
        .from('billing_categories')
        .select('id, name')
        .eq('property_id', propertyId)
        .ilike('name', 'regular paint');

      if (catErr) throw catErr;

      if (Array.isArray(categories) && categories.length > 0) {
        const categoryIds = categories.map((c: any) => c.id);
        const { data: details, error: detErr } = await supabase
          .from('billing_details')
          .select('unit_size_id, unit_sizes!inner(id, unit_size_label)')
          .in('category_id', categoryIds)
          .eq('propertyId', propertyId);

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

      // If none found for Regular Paint, fall back to any billing_details for the property
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
    }

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
    console.error('fetchPropertyUnitSizesForCategory error:', err);
    return [];
  }
}
