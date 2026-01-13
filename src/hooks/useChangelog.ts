import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export interface ChangelogEntry {
  id: string;
  title: string;
  description: string | null;
  category: 'feature' | 'fix' | 'enhancement' | 'update' | 'security' | 'performance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  version: string | null;
  author_name: string | null;
  author_email: string | null;
  github_commit_url: string | null;
  is_breaking_change: boolean;
  affected_areas: string[] | null;
  created_at: string;
  published_at: string;
  type?: 'feature' | 'fix' | 'enhancement' | 'update' | 'security' | 'performance'; // Alias for category
  date?: string; // Formatted date for display
}

export function useChangelog() {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChangelog = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('changelog_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Format data to include type alias and formatted date
      const formattedData = (data || []).map(entry => ({
        ...entry,
        type: entry.category, // Alias category as type for compatibility
        date: new Date(entry.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }));

      setChangelog(formattedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching changelog:', err);
      setError(err instanceof Error ? err.message : 'Failed to load changelog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChangelog();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('changelog_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'changelog',
          filter: 'is_published=eq.true'
        },
        () => {
          console.log('Changelog changed, refetching...');
          fetchChangelog();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { changelog, loading, error, refetch: fetchChangelog };
}
