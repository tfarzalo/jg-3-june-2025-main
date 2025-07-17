import { useEffect, useState, useCallback } from 'react';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../supabase';

interface UseSupabaseQueryOptions<T> {
  table: string;
  select?: string;
  filter?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  transform?: (data: any) => T;
}

export function useSupabaseQuery<T>({
  table,
  select = '*',
  filter,
  orderBy,
  limit,
  transform
}: UseSupabaseQueryOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  const fetchData = useCallback(async () => {
    try {
      let query = supabase.from(table).select(select);

      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data: result, error } = await query;

      if (error) throw error;

      setData(transform ? result.map(transform) : result);
      setError(null);
    } catch (err) {
      setError(err as PostgrestError);
    } finally {
      setLoading(false);
    }
  }, [table, select, filter, orderBy, limit, transform]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}