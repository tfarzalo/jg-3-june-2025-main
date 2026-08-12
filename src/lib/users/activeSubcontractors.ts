import { supabase } from '../../utils/supabase';

function isMissingArchivedColumnError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42703' ||
    code === 'PGRST204' ||
    message.includes('archived_at') ||
    (message.includes('column') && message.includes('schema cache'));
}

export async function fetchActiveSubcontractors<T = any>(select = 'id, full_name, email') {
  const activeQuery = supabase
    .from('profiles')
    .select(select)
    .eq('role', 'subcontractor')
    .is('archived_at', null)
    .order('full_name');

  const { data, error } = await activeQuery;

  if (!error) {
    return { data: (data || []) as T[], error: null };
  }

  if (!isMissingArchivedColumnError(error)) {
    return { data: [] as T[], error };
  }

  console.warn('[activeSubcontractors] profiles.archived_at is not available yet; falling back to legacy subcontractor query.');

  const fallback = await supabase
    .from('profiles')
    .select(select)
    .eq('role', 'subcontractor')
    .order('full_name');

  return {
    data: (fallback.data || []) as T[],
    error: fallback.error,
  };
}
