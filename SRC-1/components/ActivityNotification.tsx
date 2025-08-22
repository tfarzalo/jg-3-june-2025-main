import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { debounce } from '../lib/utils/debounce';

interface ActivityItem {
  id: string;
  job_id: string;
  changed_by: string;
  created_at: string;
  description: string;
  to_phase: {
    job_phase_label: string;
    color_dark_mode: string;
  };
}

export function ActivityNotification() {
  const [latestActivity, setLatestActivity] = useState<ActivityItem | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [subscriptionRetryCount, setSubscriptionRetryCount] = useState(0);
  const MAX_RETRIES = 5;
  const MAX_SUBSCRIPTION_RETRIES = 10;
  const BASE_RETRY_DELAY = 1000;
  const MAX_RETRY_DELAY = 30000;
  const isMountedRef = useRef(true);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const lastActivityIdRef = useRef<string | null>(null);
  const isReconnectingRef = useRef(false);
  const lastErrorTimeRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 10000; // Minimum 10 seconds between fetches

  const getRetryDelay = (retryCount: number) => {
    const baseDelay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
    const jitter = Math.random() * Math.min(baseDelay * 0.2, 2000); // Add up to 20% jitter, max 2s
    return baseDelay + jitter;
  };

  const cleanupSubscription = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    } catch (err) {
      console.error('Error during subscription cleanup:', err);
    }
  }, []);

  const handleSubscriptionError = useCallback(async (error?: Error) => {
    if (!isMountedRef.current || isReconnectingRef.current) return;
    
    const now = Date.now();
    if (now - lastErrorTimeRef.current < 5000) {
      consecutiveErrorsRef.current++;
    } else {
      consecutiveErrorsRef.current = 1;
    }
    lastErrorTimeRef.current = now;

    // If we're getting too many errors too quickly, increase the retry count more aggressively
    if (consecutiveErrorsRef.current > 3) {
      setSubscriptionRetryCount(prev => Math.min(prev + 2, MAX_SUBSCRIPTION_RETRIES));
    }
    
    isReconnectingRef.current = true;
    cleanupSubscription();
    
    if (subscriptionRetryCount < MAX_SUBSCRIPTION_RETRIES) {
      const delay = getRetryDelay(subscriptionRetryCount);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${subscriptionRetryCount + 1}/${MAX_SUBSCRIPTION_RETRIES})`);
      
      try {
        // Perform a lightweight query to check connection
        const { error: pingError } = await supabase
          .from('jobs')
          .select('count', { count: 'exact', head: true });
        
        if (pingError) {
          setConnectionStatus('disconnected');
          console.error('Connection check failed:', pingError);
        } else {
          setConnectionStatus('connecting');
          if (error) {
            console.warn('Reconnecting due to error:', error);
          }
        }
      } catch (checkError) {
        console.error('Error checking connection:', checkError);
        setConnectionStatus('disconnected');
      }

      retryTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setSubscriptionRetryCount(prev => prev + 1);
          isReconnectingRef.current = false;
          setupSubscription().catch(console.error);
        }
      }, delay);
    } else {
      console.error('Max subscription retries reached');
      setConnectionStatus('disconnected');
    }
  }, [subscriptionRetryCount, cleanupSubscription]);

  // Debounced version of fetchLatestActivity
  const debouncedFetchActivity = useCallback(
    debounce(async () => {
      if (!isMountedRef.current) return;
      
      // Prevent fetching too frequently
      const now = Date.now();
      if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
        return;
      }
      lastFetchTimeRef.current = now;
      
      try {
        const { data: authData, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        if (!authData.session) {
          console.log('No active session');
          return;
        }

        const { data, error } = await supabase
          .from('job_phase_changes')
          .select(`
            id,
            job_id,
            changed_by,
            changed_at,
            to_phase:to_phase_id (
              job_phase_label,
              color_dark_mode
            ),
            job:jobs (
              work_order_num,
              unit_number,
              property:properties (
                property_name
              )
            )
          `)
          .order('changed_at', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;
        
        if (data && isMountedRef.current) {
          const activityItem = {
            id: data.id,
            job_id: data.job_id,
            changed_by: data.changed_by,
            created_at: data.changed_at,
            description: `${data.job.property.property_name} - Unit ${data.job.unit_number}`,
            to_phase: data.to_phase
          };
          
          if (lastActivityIdRef.current !== data.id && data.changed_by !== currentUserIdRef.current) {
            setLatestActivity(activityItem);
            showActivityNotification(activityItem);
          }
          
          lastActivityIdRef.current = data.id;
        }
      } catch (err) {
        console.error('Error fetching latest activity:', err);
      }
    }, 1000),
    []
  );

  const setupSubscription = useCallback(async () => {
    try {
      cleanupSubscription();

      const { error: pingError } = await supabase
        .from('jobs')
        .select('count', { count: 'exact', head: true });
      
      if (pingError) throw new Error('Database connection check failed');

      const channel = supabase
        .channel('activity_changes', {
          retryIntervalMs: getRetryDelay(subscriptionRetryCount),
          timeout: 60000,
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'job_phase_changes'
        }, (payload) => {
          if (!isMountedRef.current) return;
          
          if (payload.new && payload.new.changed_by !== currentUserIdRef.current) {
            debouncedFetchActivity();
          }
        })
        .subscribe(async (status, err) => {
          if (!isMountedRef.current) return;

          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to changes');
            setSubscriptionRetryCount(0);
            consecutiveErrorsRef.current = 0;
            isReconnectingRef.current = false;
            setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error(`Channel status: ${status}`, err);
            setConnectionStatus('disconnected');
            await handleSubscriptionError(err instanceof Error ? err : new Error(`Channel ${status}`));
          }
        });

      channelRef.current = channel;
      
      return {
        unsubscribe: () => {
          try {
            if (channel) {
              channel.unsubscribe();
            }
          } catch (err) {
            console.error('Error unsubscribing from channel:', err);
          }
        }
      };
    } catch (err) {
      console.error('Error setting up subscription:', err);
      await handleSubscriptionError(err instanceof Error ? err : new Error('Setup failed'));
      return null;
    }
  }, [subscriptionRetryCount, cleanupSubscription, handleSubscriptionError, debouncedFetchActivity]);

  useEffect(() => {
    isMountedRef.current = true;
    isReconnectingRef.current = false;
    setConnectionStatus('connecting');
    
    const initialize = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          currentUserIdRef.current = data.user.id;
        }
        
        await debouncedFetchActivity();
        if (isMountedRef.current) {
          setRetryCount(0);
          const subscription = await setupSubscription();
          if (subscription) {
            subscriptionRef.current = subscription;
          }
        }
      } catch (err) {
        console.error('Error during initialization:', err);
        if (isMountedRef.current && retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setRetryCount(prev => prev + 1);
              initialize().catch(console.error);
            }
          }, delay);
        }
      }
    };
    
    initialize().catch(console.error);

    // Set up a periodic ping to check connection health - less frequent
    const pingInterval = setInterval(() => {
      if (isMountedRef.current && !isReconnectingRef.current) {
        supabase
          .from('jobs')
          .select('count', { count: 'exact', head: true })
          .then(({ error }) => {
            if (error && isMountedRef.current) {
              console.warn('Ping failed, connection may be down:', error);
              handleSubscriptionError(new Error('Ping failed')).catch(console.error);
            }
          })
          .catch(err => {
            console.error('Error during ping:', err);
            if (isMountedRef.current) {
              handleSubscriptionError(err).catch(console.error);
            }
          });
      }
    }, 60000); // Ping every 60 seconds instead of 30

    return () => {
      isMountedRef.current = false;
      isReconnectingRef.current = false;
      cleanupSubscription();
      clearInterval(pingInterval);
    };
  }, [retryCount, setupSubscription, cleanupSubscription, handleSubscriptionError, debouncedFetchActivity]);

  const showActivityNotification = (activity: ActivityItem) => {
    if (isMountedRef.current) {
      setLatestActivity(activity);
      setShowNotification(true);
      setTimeout(() => {
        if (isMountedRef.current) {
          setShowNotification(false);
        }
      }, 5000);
    }
  };

  if (!showNotification || !latestActivity) return null;

  return (
    <div 
      className={`
        fixed top-4 right-4 max-w-sm w-full bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-4 
        transform transition-all duration-500 ease-in-out
        ${showNotification ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        animate-fade-in
      `}
      style={{ 
        borderLeft: `4px solid ${latestActivity.to_phase.color_dark_mode}`,
        zIndex: 50
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <Activity className="h-5 w-5 text-blue-500 mr-2" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Activity Update
          </h3>
        </div>
        <button
          onClick={() => setShowNotification(false)}
          className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2">
        <p className="text-sm text-gray-900 dark:text-white">
          {latestActivity.description}
          <span className="inline-flex items-center mx-1">
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </span>
          <span style={{ color: latestActivity.to_phase.color_dark_mode }}>
            {latestActivity.to_phase.job_phase_label}
          </span>
        </p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            {formatInTimeZone(parseISO(latestActivity.created_at), 'America/New_York', 'MMM d, yyyy h:mm a')}
          </span>
          <Link
            to={`/dashboard/jobs/${latestActivity.job_id}`}
            className="text-blue-500 hover:text-blue-400 font-medium"
            onClick={() => setShowNotification(false)}
          >
            View Job
          </Link>
        </div>
      </div>
    </div>
  );
}