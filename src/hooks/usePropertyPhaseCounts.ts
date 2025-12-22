import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const TARGETS = [
  { key: 'jobRequests', match: /(job\s*request)/i },
  { key: 'workOrders',  match: /(work\s*order)/i },
  { key: 'pendingWorkOrders', match: /(pending\s*work\s*order)/i },
  { key: 'completed',   match: /(completed|complete)/i },
  { key: 'cancelled',   match: /(cancel{1,2}ed)/i }, // handles canceled/cancelled
  { key: 'invoicing',   match: /(invoicing|invoice)/i },
] as const;

export type PhaseCounts = {
  jobRequests: { count: number; color: string };
  workOrders:  { count: number; color: string };
  pendingWorkOrders: { count: number; color: string };
  completed:   { count: number; color: string };
  cancelled:   { count: number; color: string };
  invoicing:   { count: number; color: string };
  totalJobs:   { count: number; color: string };
  loading: boolean;
  error?: string;
};

const NEUTRAL = '#E5E7EB';

export function usePropertyPhaseCounts(propertyId?: string): PhaseCounts {
  const [state, setState] = useState<PhaseCounts>({
    jobRequests: { count: 0, color: NEUTRAL },
    workOrders:  { count: 0, color: NEUTRAL },
    pendingWorkOrders: { count: 0, color: NEUTRAL },
    completed:   { count: 0, color: NEUTRAL },
    cancelled:   { count: 0, color: NEUTRAL },
    invoicing:   { count: 0, color: NEUTRAL },
    totalJobs:   { count: 0, color: NEUTRAL },
    loading: true,
  });

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    const fetchCounts = async () => {
      setState(s => ({ ...s, loading: true, error: undefined }));

      // 1) Load the four phase rows
      const { data: phases, error: pErr } = await supabase
        .from('job_phases')
        .select('id, job_phase_label, color_dark_mode, color_light_mode');
      if (pErr) {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: pErr.message }));
        return;
      }

      const byKey = Object.fromEntries(
        TARGETS.map(t => {
          const row = phases?.find(ph => t.match.test(ph.job_phase_label ?? ''));
          return [t.key, row];
        })
      );

      const targets = (['jobRequests','workOrders','pendingWorkOrders','completed','cancelled','invoicing'] as const).map(async k => {
        const phaseId = byKey[k]?.id ?? null;
        const color = byKey[k]?.color_dark_mode ?? NEUTRAL;
        if (!phaseId) return { key: k, count: 0, color };
        const { count, error } = await supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', propertyId)
          .eq('current_phase_id', phaseId);
        return { key: k, count: count ?? 0, color, error };
      });

      const results = await Promise.all(targets);
      if (cancelled) return;

      const next = results.reduce((acc, r) => {
        acc[r.key] = { count: r.count, color: r.color };
        return acc;
      }, {} as any);

      // Calculate total jobs across all phases
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      next.totalJobs = { count: totalCount, color: '#6B7280' }; // Neutral gray color for total

      setState({
        ...(state as any),
        ...next,
        loading: false,
      });
    };

    fetchCounts();

    // 2) Realtime refresh
    const channel = supabase
      .channel('jobs-property-' + propertyId)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `property_id=eq.${propertyId}` },
        () => { fetchCounts(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [propertyId]);

  return state;
}
