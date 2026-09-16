import { supabase } from '../../utils/supabase';

// Keep job creation and reassignment choices consistent across entry points.
export function fetchJobEligibleProperties(select = '*') {
  return supabase
    .from('properties')
    .select(select)
    .eq('is_archived', false)
    .eq('is_active', true)
    .order('property_name');
}

export async function assertJobPropertyEligible(propertyId: string, currentPropertyId?: string) {
  if (!propertyId) throw new Error('Please select an active property.');
  // Existing jobs retain their property when it is later deactivated or archived.
  if (currentPropertyId && propertyId === currentPropertyId) return;

  const { data, error } = await supabase
    .from('properties')
    .select('id, is_active, is_archived')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) throw new Error('Unable to verify property status. Please try again.');
  if (!data || data.is_active !== true || data.is_archived !== false) {
    throw new Error('This property is inactive, archived, or no longer available. Please select an active property.');
  }
}
