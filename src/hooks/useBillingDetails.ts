import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';

interface BillingDetails {
  billAmount: number | null;
  subPayAmount: number | null;
  profitAmount: number | null;
  isHourly: boolean;
}

interface UseBillingDetailsProps {
  propertyId: string;
  paintType: string;
  unitSize: string;
  extraChargesUnitSize?: string;
  extraHours?: number;
  onBillingChange?: (billing: BillingDetails | null) => void;
  onExtraChargesBillingChange?: (billing: BillingDetails | null) => void;
}

export function useBillingDetails({
  propertyId,
  paintType,
  unitSize,
  extraChargesUnitSize,
  extraHours = 0,
  onBillingChange,
  onExtraChargesBillingChange
}: UseBillingDetailsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);
  const [extraChargesBilling, setExtraChargesBilling] = useState<BillingDetails | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [subscriptionRetryCount, setSubscriptionRetryCount] = useState(0);
  const MAX_RETRIES = 8;
  const MAX_SUBSCRIPTION_RETRIES = 5;
  const INITIAL_RETRY_DELAY = 1000;
  const MAX_RETRY_DELAY = 30000;
  const CONNECTION_TIMEOUT = 30000;

  const checkNetworkConnectivity = () => {
    if (!navigator.onLine) {
      throw new Error('No internet connection. Please check your network connection and try again.');
    }
  };

  const fetchWithRetry = async <T,>(
    operation: () => Promise<T>,
    retries = MAX_RETRIES,
    delay = INITIAL_RETRY_DELAY
  ): Promise<T> => {
    try {
      checkNetworkConnectivity();
      return await operation();
    } catch (error) {
      if (retries === 0) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw new Error('Network request failed. Please check your connection and try again.');
        }
        throw error;
      }
      
      const jitter = Math.random() * 1000;
      const nextDelay = Math.min(delay * 2 + jitter, MAX_RETRY_DELAY);
      
      console.log(`Retrying operation in ${delay}ms... Attempts remaining: ${retries}`);
      
      toast.info(`Connection attempt failed. Retrying in ${Math.ceil(delay / 1000)} seconds...`, {
        duration: delay - 100,
        id: 'connection-retry-toast'
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return fetchWithRetry(operation, retries - 1, nextDelay);
    }
  };

  const checkSupabaseConnection = async () => {
    try {
      checkNetworkConnectivity();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);
      
      try {
        const { error } = await supabase
          .from('unit_sizes')
          .select('count')
          .single()
          .abortSignal(controller.signal);
        
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('Supabase connection error:', error);
          throw new Error(`Database connection error: ${error.message}`);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Database connection timed out. Please try again.');
        }
        throw err;
      }
    } catch (err) {
      console.error('Connection check failed:', err);
      if (err instanceof Error) {
        throw new Error(`Unable to establish database connection: ${err.message}`);
      }
      throw new Error('Unable to establish database connection. Please try again.');
    }
  };

  const fetchBillingDetails = useCallback(async () => {
    if (!propertyId || !paintType || !unitSize) {
      setBillingDetails(null);
      setExtraChargesBilling(null);
      if (onBillingChange) onBillingChange(null);
      if (onExtraChargesBillingChange) onExtraChargesBillingChange(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await fetchWithRetry(() => checkSupabaseConnection());

      let regularBilling: BillingDetails | null = null;
      let extraBilling: BillingDetails | null = null;

      const { data: unitSizeData, error: unitSizeError } = await fetchWithRetry(
        async () => {
          const result = await supabase
            .from('unit_sizes')
            .select('id')
            .eq('unit_size_label', unitSize)
            .maybeSingle();
          
          if (result.error) {
            console.error('Unit size fetch error:', result.error);
            throw new Error(`Error fetching unit size data: ${result.error.message}`);
          }
          return result;
        }
      );

      if (unitSizeError || !unitSizeData) {
        const errorMsg = unitSizeError ? 
          `Error fetching unit size: ${unitSizeError.message}` : 
          `Unit size "${unitSize}" not found. Please contact support.`;
        console.error(errorMsg);
        toast.error(errorMsg);
        setBillingDetails(null);
        if (onBillingChange) onBillingChange(null);
        return;
      }

      const { data: categoryData, error: categoryError } = await fetchWithRetry(
        async () => {
          const result = await supabase
            .from('billing_categories')
            .select('id')
            .eq('property_id', propertyId)
            .eq('name', paintType)
            .single();
          
          if (result.error && result.error.code !== 'PGRST116') {
            console.error('Category fetch error:', result.error);
            throw new Error(`Error fetching billing category: ${result.error.message}`);
          }
          return result;
        }
      );

      if (categoryData) {
        const { data: billingData, error: billingError } = await fetchWithRetry(
          async () => {
            const result = await supabase
              .from('billing_details')
              .select('bill_amount, sub_pay_amount, profit_amount, is_hourly')
              .eq('property_id', propertyId)
              .eq('category_id', categoryData.id)
              .eq('unit_size_id', unitSizeData.id)
              .maybeSingle();
            
            if (result.error) {
              console.error('Billing details fetch error:', result.error);
              throw new Error(`Error fetching billing details: ${result.error.message}`);
            }
            return result;
          }
        );

        if (billingError) {
          throw billingError;
        }

        regularBilling = billingData ? {
          billAmount: billingData.bill_amount,
          subPayAmount: billingData.sub_pay_amount,
          profitAmount: billingData.profit_amount,
          isHourly: billingData.is_hourly
        } : null;
      }

      setBillingDetails(regularBilling);
      if (onBillingChange) onBillingChange(regularBilling);

      // Fetch extra charges billing details if we have extra hours
      if (extraHours > 0) {
        try {
          const { data: extraCategoryData, error: extraCategoryError } = await fetchWithRetry(
            async () => {
              const result = await supabase
                .from('billing_categories')
                .select('id')
                .eq('property_id', propertyId)
                .eq('name', 'Extra Charges')
                .single();
              
              if (result.error && result.error.code !== 'PGRST116') {
                throw new Error(`Error fetching extra charges category: ${result.error.message}`);
              }
              return result;
            }
          );

          if (extraCategoryData) {
            const { data: extraBillingData, error: extraBillingError } = await fetchWithRetry(
              async () => {
                const result = await supabase
                  .from('billing_details')
                  .select('bill_amount, sub_pay_amount, profit_amount, is_hourly')
                  .eq('property_id', propertyId)
                  .eq('category_id', extraCategoryData.id)
                  .eq('is_hourly', true)
                  .maybeSingle();
                
                if (result.error) {
                  throw new Error(`Error fetching extra charges billing details: ${result.error.message}`);
                }
                return result;
              }
            );

            if (extraBillingError) {
              throw extraBillingError;
            }

            extraBilling = extraBillingData ? {
              billAmount: extraBillingData.bill_amount,
              subPayAmount: extraBillingData.sub_pay_amount,
              profitAmount: extraBillingData.profit_amount,
              isHourly: extraBillingData.is_hourly
            } : null;

            if (extraBilling && extraBilling.isHourly && extraHours > 0) {
              extraBilling = {
                ...extraBilling,
                billAmount: extraBilling.billAmount ? extraBilling.billAmount * extraHours : null,
                subPayAmount: extraBilling.subPayAmount ? extraBilling.subPayAmount * extraHours : null,
                profitAmount: null
              };
            }
          }

          setExtraChargesBilling(extraBilling);
          if (onExtraChargesBillingChange) onExtraChargesBillingChange(extraBilling);
        } catch (extraError) {
          console.error('Error processing extra charges:', extraError);
          const errorMessage = extraError instanceof Error ? extraError.message : 'Failed to fetch extra charges billing details';
          toast.error(errorMessage);
        }
      }

      setRetryCount(0);
      setError(null);
    } catch (err) {
      console.error('Error fetching billing details:', err);
      
      let errorMessage = 'Failed to fetch billing details. Please try again.';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
        const supabaseError = err as { code: string; message: string; details?: string; hint?: string };
        errorMessage = `Database error: ${supabaseError.message}`;
        if (supabaseError.details) {
          console.error('Error details:', supabaseError.details);
        }
        if (supabaseError.hint) {
          console.error('Error hint:', supabaseError.hint);
        }
      }

      setError(errorMessage);
      toast.error(errorMessage, {
        id: 'billing-error-toast'
      });
      
      setBillingDetails(null);
      setExtraChargesBilling(null);
      if (onBillingChange) onBillingChange(null);
      if (onExtraChargesBillingChange) onExtraChargesBillingChange(null);
    } finally {
      setLoading(false);
    }
  }, [propertyId, paintType, unitSize, extraHours, onBillingChange, onExtraChargesBillingChange]);

  const subscribeWithRetry = useCallback(async () => {
    try {
      if (!propertyId) {
        return { unsubscribe: () => {} };
      }
      
      const channel = supabase
        .channel(`billing-${propertyId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'billing_details',
          filter: `property_id=eq.${propertyId}`
        }, () => {
          fetchBillingDetails();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to changes');
            setSubscriptionRetryCount(0);
          } else if (status === 'CHANNEL_ERROR') {
            throw new Error('Failed to subscribe to changes');
          }
        });

      return {
        unsubscribe: () => {
          channel.unsubscribe();
        }
      };
    } catch (err) {
      console.error('Subscription error:', err);
      
      if (subscriptionRetryCount >= MAX_SUBSCRIPTION_RETRIES) {
        console.error('Max subscription retries reached');
        return { unsubscribe: () => {} };
      }
      
      const delay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, subscriptionRetryCount),
        MAX_RETRY_DELAY
      );
      
      console.log(`Retrying subscription in ${delay}ms... Attempt ${subscriptionRetryCount + 1} of ${MAX_SUBSCRIPTION_RETRIES}`);
      
      return new Promise(resolve => {
        setTimeout(() => {
          setSubscriptionRetryCount(prev => prev + 1);
          resolve(subscribeWithRetry());
        }, delay);
      });
    }
  }, [propertyId, fetchBillingDetails, subscriptionRetryCount]);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    let isSubscribed = true;

    const initializeSubscription = async () => {
      try {
        if (isSubscribed) {
          subscription = await subscribeWithRetry();
        }
      } catch (err) {
        console.error('Failed to initialize subscription:', err);
      }
    };

    fetchBillingDetails();
    initializeSubscription();

    return () => {
      isSubscribed = false;
      subscription?.unsubscribe();
    };
  }, [propertyId, fetchBillingDetails, subscribeWithRetry]);

  return {
    loading,
    error,
    billingDetails,
    extraChargesBilling,
    refetch: fetchBillingDetails
  };
}