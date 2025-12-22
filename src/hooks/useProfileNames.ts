import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';

interface ProfileNamesMap {
  [profileId: string]: string;
}

export function useProfileNames() {
  const [profileNames, setProfileNames] = useState<ProfileNamesMap>({});
  const [loading, setLoading] = useState(false);

  const fetchProfileNames = useCallback(async (profileIds: string[]) => {
    if (profileIds.length === 0) return;

    // Filter out IDs we already have
    const newIds = profileIds.filter(id => !profileNames[id]);
    if (newIds.length === 0) return;

    console.log('useProfileNames: Fetching new profile IDs:', newIds);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', newIds);

      if (error) {
        console.error('Error fetching profile names:', error);
        return;
      }

      if (data) {
        console.log('useProfileNames: Received profile data:', data);
        const newNames: ProfileNamesMap = {};
        data.forEach(profile => {
          if (profile.id && profile.full_name) {
            newNames[profile.id] = profile.full_name;
          }
        });

        console.log('useProfileNames: Setting new names:', newNames);
        setProfileNames(prev => ({ ...prev, ...newNames }));
      }
    } catch (err) {
      console.error('Error in fetchProfileNames:', err);
    } finally {
      setLoading(false);
    }
  }, [profileNames]);

  const getProfileName = useCallback((profileId: string | null | undefined): string => {
    if (!profileId) return 'Unassigned';
    return profileNames[profileId] || `Loading...`;
  }, [profileNames]);

  return {
    profileNames,
    loading,
    fetchProfileNames,
    getProfileName
  };
}
