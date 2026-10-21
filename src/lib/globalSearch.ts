export const GLOBAL_SEARCH_MIN_LENGTH = 3;

export type GlobalSearchEntityType =
  | 'job'
  | 'property'
  | 'file'
  | 'user'
  | 'work_order'
  | 'job_request'
  | 'activity'
  | 'property_group'
  | 'contact';

export interface GlobalSearchRow {
  id: string;
  result_type: GlobalSearchEntityType;
  title: string;
  subtitle: string | null;
  description: string | null;
  result_date: string | null;
  tags: string[] | null;
  url: string;
  matched_field: string | null;
  relevance: number;
  total_count: number;
}

export function normalizeGlobalSearchTerm(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function canRunGlobalSearch(value: string) {
  return normalizeGlobalSearchTerm(value).length >= GLOBAL_SEARCH_MIN_LENGTH;
}
