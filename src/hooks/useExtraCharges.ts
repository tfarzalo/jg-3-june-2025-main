/**
 * Phase 2: Hook for fetching extra charge categories from property billing settings
 */

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { ExtraChargeCategory } from '../types/extraCharges';

interface UseExtraChargesResult {
  categories: ExtraChargeCategory[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useExtraCharges(propertyId: string | null): UseExtraChargesResult {
  const [categories, setCategories] = useState<ExtraChargeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExtraCharges = async () => {
    if (!propertyId) {
      setCategories([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch categories marked as extra charges (Phase 1)
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('billing_categories')
        .select('id, name')
        .eq('property_id', propertyId)
        .eq('is_extra_charge', true)
        .is('archived_at', null)
        .order('name');

      if (categoriesError) throw categoriesError;

      if (!categoriesData || categoriesData.length === 0) {
        setCategories([]);
        setIsLoading(false);
        return;
      }

      // Fetch billing details for each category
      const categoryIds = categoriesData.map((c) => c.id);
      const { data: billingDetailsData, error: detailsError } = await supabase
        .from('billing_details')
        .select(`
          id,
          category_id,
          unit_size_id,
          bill_amount,
          sub_pay_amount,
          is_hourly,
          unit_size:unit_sizes(unit_size_label),
          unit_sizes:unit_sizes(unit_size_label)
        `)
        .eq('property_id', propertyId)
        .in('category_id', categoryIds)
        .order('bill_amount', { ascending: true });

      if (detailsError) throw detailsError;

      // Group billing details by category
      const transformed: ExtraChargeCategory[] = categoriesData.map((cat) => {
        const categoryDetails = (billingDetailsData || []).filter(
          (bd) => bd.category_id === cat.id
        );

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          displayName: `Extra Charges - ${cat.name}`,
          lineItems: categoryDetails.map((detail) => ({
            id: detail.id,
            name: (
              detail.unit_size?.unit_size_label ||
              (Array.isArray(detail.unit_sizes)
                ? detail.unit_sizes[0]?.unit_size_label
                : detail.unit_sizes?.unit_size_label) ||
              'Standard'
            ),
            billAmount: detail.bill_amount || 0,
            subAmount: detail.sub_pay_amount || 0,
            isHourly: detail.is_hourly || false,
          })),
        };
      }).filter(cat => cat.lineItems.length > 0); // Only include categories with billing details

      setCategories(transformed);
    } catch (err) {
      console.error('Error fetching extra charges:', err);
      setError(err instanceof Error ? err.message : 'Failed to load extra charges');
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExtraCharges();
  }, [propertyId]);

  return { 
    categories, 
    isLoading, 
    error,
    refetch: fetchExtraCharges 
  };
}
