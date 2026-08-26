import { supabase } from '../utils/supabase';

export type UnitSize = { id: string; unit_size_label: string };

const SPECIAL_UNIT_SIZE_LABELS = ['N/A', 'TBD'];

async function appendSpecialUnitSizes(unitSizes: UnitSize[], seen: Set<string>): Promise<UnitSize[]> {
  const nextSizes = [...unitSizes];

  for (const label of SPECIAL_UNIT_SIZE_LABELS) {
    try {
      const { data } = await supabase
        .from('unit_sizes')
        .select('id, unit_size_label')
        .ilike('unit_size_label', label)
        .maybeSingle();

      if (data && !seen.has(data.id)) {
        seen.add(data.id);
        nextSizes.push({ id: data.id, unit_size_label: String(data.unit_size_label) });
      }
    } catch (e) {
      // Keep configured unit sizes available even if one special lookup fails.
    }
  }

  return nextSizes;
}

async function fetchConfiguredUnitSizes(propertyId: string, categoryIds: string[]): Promise<UnitSize[]> {
  if (!propertyId || categoryIds.length === 0) return [];

  const { data, error } = await supabase
    .from('billing_details')
    .select('unit_size_id, unit_sizes!inner(id, unit_size_label)')
    .in('category_id', categoryIds)
    .eq('property_id', propertyId);

  if (error) throw error;

  const seen = new Set<string>();
  const unitSizes: UnitSize[] = [];
  for (const row of data || []) {
    const size = row.unit_sizes as any;
    if (size?.id && !seen.has(size.id)) {
      seen.add(size.id);
      unitSizes.push({ id: size.id, unit_size_label: String(size.unit_size_label) });
    }
  }

  return unitSizes.sort((a, b) => a.unit_size_label.localeCompare(b.unit_size_label));
}

export async function fetchPropertyUnitSizesForBillingCategory(
  propertyId: string,
  billingCategoryId?: string | null
): Promise<UnitSize[]> {
  if (!propertyId || !billingCategoryId) return [];

  try {
    const sizes = await fetchConfiguredUnitSizes(propertyId, [billingCategoryId]);
    const seen = new Set(sizes.map(size => size.id));
    return await appendSpecialUnitSizes(sizes, seen);
  } catch (err) {
    console.error('fetchPropertyUnitSizesForBillingCategory error:', err);
    return [];
  }
}

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

      // Debug: log inputs so we can trace production behavior if needed
      console.debug('[fetchPropertyUnitSizesForCategory] inputs:', { propertyId, categoryName: nameTrimmed });

      // Perform strict DB-level matching to avoid JS-side fuzzy matches that returned unrelated categories.
      // We'll run up to three targeted queries: exact (case-insensitive), prefix '<name> -%', and if the
      // category is 'Extra Charges' include any billing_categories starting with 'Extra Charges'.
      // Collect full matched category objects so we can log ids + names for debugging.
      const matchedCats: Array<{ id: string; name: string }> = [];

      // 1) Exact (case-insensitive) match
      try {
        const { data: exactCats, error: exactErr } = await supabase
          .from('billing_categories')
          .select('id, name')
          .eq('property_id', propertyId)
          .ilike('name', nameTrimmed);

        if (exactErr) throw exactErr;
        if (Array.isArray(exactCats)) {
          for (const c of exactCats) matchedCats.push({ id: String((c as any).id), name: String((c as any).name) });
        }
      } catch (e) {
        console.debug('[fetchPropertyUnitSizesForCategory] exact category query failed', e);
      }

      // 2) Prefix match '<categoryName> -%'
      try {
        const prefixPattern = `${nameTrimmed} -%`;
        const { data: prefixCats, error: prefixErr } = await supabase
          .from('billing_categories')
          .select('id, name')
          .eq('property_id', propertyId)
          .ilike('name', prefixPattern);

        if (prefixErr) throw prefixErr;
        if (Array.isArray(prefixCats)) {
          for (const c of prefixCats) matchedCats.push({ id: String((c as any).id), name: String((c as any).name) });
        }
      } catch (e) {
        console.debug('[fetchPropertyUnitSizesForCategory] prefix category query failed', e);
      }

      // 3) Special-case: when categoryName is 'Extra Charges' include any billing category that begins with 'Extra Charges'
      if (nameLower === 'extra charges') {
        try {
          const { data: extraCats, error: extraErr } = await supabase
            .from('billing_categories')
            .select('id, name')
            .eq('property_id', propertyId)
            .ilike('name', 'Extra Charges%');

          if (extraErr) throw extraErr;
          if (Array.isArray(extraCats)) {
            for (const c of extraCats) matchedCats.push({ id: String((c as any).id), name: String((c as any).name) });
          }
        } catch (e) {
          console.debug('[fetchPropertyUnitSizesForCategory] extra charges category query failed', e);
        }
      }

      // Deduplicate matchedCats by id
      const dedupMap = new Map<string, { id: string; name: string }>();
      for (const c of matchedCats) {
        if (!dedupMap.has(c.id)) dedupMap.set(c.id, c);
      }
      const finalMatchedCats = Array.from(dedupMap.values());
      const billingCats = finalMatchedCats.map(c => c.id);
      console.debug('[fetchPropertyUnitSizesForCategory] matched billing categories:', finalMatchedCats);

      if (billingCats.length > 0) {
        const { data: details, error: detErr } = await supabase
          .from('billing_details')
          .select('unit_size_id, unit_sizes!inner(id, unit_size_label)')
          .in('category_id', billingCats)
          .eq('property_id', propertyId);

        if (detErr) throw detErr;

        if (Array.isArray(details)) {
          console.debug('[fetchPropertyUnitSizesForCategory] billing_details count:', details.length);
          const sizesAdded: Array<{id: string; label: string}> = [];
          for (const row of details) {
            const size = row.unit_sizes as any;
            if (size && !seen.has(size.id)) {
              seen.add(size.id);
              const entry = { id: size.id, unit_size_label: String(size.unit_size_label) };
              unitSizes.push(entry);
              sizesAdded.push({ id: String(size.id), label: String(size.unit_size_label) });
            }
          }
          console.debug('[fetchPropertyUnitSizesForCategory] sizes added from billing_details:', sizesAdded);
        }

        if (unitSizes.length > 0) {
          unitSizes.sort((a, b) => a.unit_size_label.localeCompare(b.unit_size_label));
        }

        // Additional debug: show final unitSizes before append of N/A/TBD
        console.debug('[fetchPropertyUnitSizesForCategory] unitSizes before N/A/TBD append:', unitSizes);

        // Intentionally do not fall back to other categories or global sizes when an explicit
        // categoryName is provided. If the selected Job Category has no billing entries for
        // the property, only N/A/TBD will be appended below.
      } else {
        // No matching billing category for this property; leave unitSizes empty so N/A/TBD
        // will be the only options appended below.
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

    const unitSizesWithSpecialOptions = await appendSpecialUnitSizes(unitSizes, seen);

    // Final debug: what we will return
    console.debug('[fetchPropertyUnitSizesForCategory] final returned unitSizes (post N/A/TBD):', unitSizesWithSpecialOptions);

    return unitSizesWithSpecialOptions;
  } catch (err) {
    console.error('fetchPropertyUnitSizesForCategory error:', err);
    return [];
  }
}
