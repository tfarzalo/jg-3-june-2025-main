import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';

export async function touchLastSeen() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  try {
    await supabase
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', user.id);
  } catch (error) {
    console.error('Error updating last_seen:', error);
  }
}

export function useLastSeen() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;

    const updateLastSeen = async () => {
      if (!mounted) return;
      
      const now = Date.now();
      // Only update if at least 1 minute has passed since last update
      if (now - lastUpdateRef.current < 60000) return;
      
      await touchLastSeen();
      lastUpdateRef.current = now;
    };

    // Update immediately on mount
    updateLastSeen();

    // Set up interval for periodic updates (every 5 minutes)
    intervalRef.current = setInterval(updateLastSeen, 5 * 60 * 1000);

    // Update on visibility change (tab becomes visible/hidden)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
    };

    // Update on page unload
    const handleBeforeUnload = () => {
      touchLastSeen();
    };

    // Update on page focus/blur
    const handleFocus = () => {
      updateLastSeen();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('focus', handleFocus);

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('focus', handleFocus);
      
      // Final update on unmount
      touchLastSeen();
    };
  }, []);

  return { touchLastSeen };
}
