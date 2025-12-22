import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export interface CurrentProfile {
  id: string;
  role: string;
  full_name?: string;
  email: string;
}

export function useCurrentProfile(currentUserId: string) {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, role, full_name, email')
          .eq('id', currentUserId)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error('Error fetching current profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUserId]);

  return { profile, loading };
}
