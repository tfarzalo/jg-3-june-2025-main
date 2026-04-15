import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { useUserRole } from '../hooks/useUserRole';
import {
  WhatsNewEntry,
  hasUnreadWhatsNew,
} from '../lib/whatsNew/whatsNewOptions';

interface UseWhatsNewResult {
  entries: WhatsNewEntry[];
  loading: boolean;
  error: string | null;
  shouldShowModal: boolean;
  lastSeenAt: string | null;
  dismiss: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useWhatsNew(): UseWhatsNewResult {
  const { session } = useAuth();
  const { isAdmin, isJGManagement, isSuperAdmin, loading: roleLoading } = useUserRole();
  const [entries, setEntries] = useState<WhatsNewEntry[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSeeWhatsNew = isAdmin || isJGManagement || isSuperAdmin;

  const fetchWhatsNew = useCallback(async () => {
    if (roleLoading) return;
    if (!session?.user.id || !canSeeWhatsNew) {
      setEntries([]);
      setLastSeenAt(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [{ data: items, error: itemsError }, { data: profile, error: profileError }] =
        await Promise.all([
          supabase
            .from('whats_new_entries')
            .select('*')
            .eq('is_published', true)
            .order('display_order', { ascending: true })
            .order('updated_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('last_seen_whats_new_at')
            .eq('id', session.user.id)
            .single(),
        ]);

      if (itemsError) throw itemsError;
      if (profileError) throw profileError;

      const visibleItems = ((items ?? []) as WhatsNewEntry[]).filter((entry) => {
        if (isSuperAdmin) {
          return entry.include_super_admin;
        }
        return true;
      });

      setEntries(visibleItems);
      setLastSeenAt(profile?.last_seen_whats_new_at ?? null);
      setError(null);
    } catch (err) {
      console.error('Error loading what\'s new items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load what\'s new');
    } finally {
      setLoading(false);
    }
  }, [canSeeWhatsNew, isSuperAdmin, roleLoading, session?.user.id]);

  useEffect(() => {
    fetchWhatsNew();
  }, [fetchWhatsNew]);

  const dismiss = useCallback(async () => {
    if (!session?.user.id) return;

    const seenAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ last_seen_whats_new_at: seenAt })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error saving what\'s new dismissal:', updateError);
      throw updateError;
    }

    setLastSeenAt(seenAt);
  }, [session?.user.id]);

  const shouldShowModal = useMemo(() => {
    if (loading || roleLoading || !canSeeWhatsNew) return false;
    return hasUnreadWhatsNew(entries, lastSeenAt);
  }, [canSeeWhatsNew, entries, lastSeenAt, loading, roleLoading]);

  return {
    entries,
    loading,
    error,
    shouldShowModal,
    lastSeenAt,
    dismiss,
    refetch: fetchWhatsNew,
  };
}
