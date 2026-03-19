import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthProvider';

interface MaintenanceModeContextType {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  /** True while the initial fetch is in-flight. Gate should wait before rendering. */
  loading: boolean;
}

const DEFAULT_MESSAGE =
  'We are currently performing scheduled maintenance. We will be back shortly.';

const MaintenanceModeContext = createContext<MaintenanceModeContextType>({
  isMaintenanceMode: false,
  maintenanceMessage: DEFAULT_MESSAGE,
  loading: true,
});

export function useMaintenanceMode() {
  return useContext(MaintenanceModeContext);
}

export function MaintenanceModeProvider({ children }: { children: React.ReactNode }) {
  const { initializing } = useAuth();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(DEFAULT_MESSAGE);
  const [loading, setLoading] = useState(true);

  // Fetch the current maintenance_mode value once auth has resolved
  useEffect(() => {
    if (initializing) return;

    let mounted = true;

    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();

        if (!mounted) return;

        if (error) {
          // Fail safe: if we can't read the config, assume maintenance is OFF
          // so we never accidentally lock anyone out
          console.warn('MaintenanceModeContext: Could not fetch config, defaulting to OFF.', error.message);
          setIsMaintenanceMode(false);
        } else if (data?.value) {
          setIsMaintenanceMode(data.value.enabled === true);
          if (data.value.message) {
            setMaintenanceMessage(data.value.message);
          }
        }
      } catch (err) {
        if (!mounted) return;
        console.warn('MaintenanceModeContext: Unexpected error, defaulting to OFF.', err);
        setIsMaintenanceMode(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchConfig();

    // Subscribe to realtime changes on app_config so toggling takes effect
    // for all connected clients without a page refresh
    const channel = supabase
      .channel('app_config_maintenance')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_config', filter: 'key=eq.maintenance_mode' },
        (payload) => {
          if (!mounted) return;
          const newValue = payload.new?.value;
          if (newValue) {
            setIsMaintenanceMode(newValue.enabled === true);
            if (newValue.message) {
              setMaintenanceMessage(newValue.message);
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [initializing]);

  return (
    <MaintenanceModeContext.Provider value={{ isMaintenanceMode, maintenanceMessage, loading }}>
      {children}
    </MaintenanceModeContext.Provider>
  );
}
