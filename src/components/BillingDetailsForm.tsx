import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, X, DollarSign, Save, Trash2, ArrowLeft, GripVertical, FileText, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase';
import { useUnsavedChangesPrompt } from '../hooks/useUnsavedChangesPrompt';

interface JobCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_default?: boolean;
  is_system?: boolean;
  is_hidden?: boolean;
}

interface PropertyBillingCategory {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  include_in_work_order?: boolean;
  created_at: string;
  updated_at: string;
}

interface UnitSize {
  id: string;
  unit_size_label: string;
}

interface BillingDetail {
  id: string;
  property_id: string;
  category_id: string;
  unit_size_id: string;
  bill_amount: number;
  sub_pay_amount: number;
  profit_amount: number | null;
  is_hourly: boolean;
  sort_order?: number;
}

interface CategoryLineItem {
  id: string;
  unitSizeId: string;
  billAmount: string;
  subPayAmount: string;
  isHourly: boolean;
}

interface CategoryLineItems {
  [key: string]: CategoryLineItem[];
}

export function BillingDetailsForm() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [propertyBillingCategories, setPropertyBillingCategories] = useState<PropertyBillingCategory[]>([]);
  const [unitSizes, setUnitSizes] = useState<UnitSize[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetail[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [categoryLineItems, setCategoryLineItems] = useState<CategoryLineItems>({});
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [selectedMasterCategoryId, setSelectedMasterCategoryId] = useState<string>('');
  const [includeInWorkOrder, setIncludeInWorkOrder] = useState(false);
  const [propertyName, setPropertyName] = useState<string>('');
  const [supportsDetailSortOrder, setSupportsDetailSortOrder] = useState<boolean>(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<number | null>(null);
  const { attemptNavigate } = useUnsavedChangesPrompt(hasChanges, async () => {
    await handleSaveAll();
  });

  // Drag and drop state
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [draggedLineItemId, setDraggedLineItemId] = useState<string | null>(null);
  const [dragOverLineItemId, setDragOverLineItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) {
      navigate('/dashboard/properties');
      return;
    }
    // Fetch property name
    const fetchPropertyName = async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('property_name')
        .eq('id', propertyId)
        .single();
      if (!error && data) setPropertyName(data.property_name);
    };
    fetchPropertyName();
    Promise.all([
      fetchJobCategories(),
      fetchUnitSizes(),
    ]);
  }, [propertyId, navigate]);

  useEffect(() => {
    if (propertyId && jobCategories.length > 0 && unitSizes.length > 0) {
      fetchPropertyBillingData();
    }
  }, [propertyId, jobCategories, unitSizes]);

  useEffect(() => {
    const checkDetailSortOrder = async () => {
      try {
        const { error } = await supabase
          .from('billing_details')
          .select('id, sort_order')
          .limit(1);
        if (!error) {
          setSupportsDetailSortOrder(true);
        } else {
          setSupportsDetailSortOrder(false);
        }
      } catch {
        setSupportsDetailSortOrder(false);
      }
    };
    checkDetailSortOrder();
  }, []);

  const fetchJobCategories = async () => {
    try {
      // Fetch all job categories
      const { data, error } = await supabase
        .from('job_categories')
        .select('*')
        .eq('is_hidden', false)
        .order('sort_order');

      if (error) {
        console.error('Error fetching master job categories:', error);
        setError('Failed to load job categories for selection.');
        throw error;
      }
      setJobCategories(data || []);

    } catch (err) {
      console.error('Error in fetchJobCategories:', err);
      // Fallback if columns don't exist yet (migration not run)
      if ((err as any)?.message?.includes('does not exist')) {
          // Retry without new columns
          const { data } = await supabase
            .from('job_categories')
            .select('id, name, description, sort_order')
            .order('sort_order');
          setJobCategories(data || []);
      }
    }
  };

  const fetchUnitSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('unit_sizes')
        .select('*')
        .order('unit_size_label');

      if (error) throw error;
      setUnitSizes(data || []);
    } catch (err) {
      console.error('Error fetching unit sizes:', err);
    }
  };

  const fetchPropertyBillingData = async () => {
    try {

      const { data: propertyBillingCategoriesData, error: fetchCategoriesError } = await supabase
        .from('billing_categories')
        .select('*')
        .eq('property_id', propertyId);

      if (fetchCategoriesError) throw fetchCategoriesError;

      // Sort categories by sort_order
      const sortedCategories = (propertyBillingCategoriesData || []).sort((a, b) => a.sort_order - b.sort_order);

      // Auto-add default categories
      const currentCategories = sortedCategories;
      const defaultCategories = jobCategories.filter(jc => jc.is_default);
      const missingDefaults = defaultCategories.filter(dc => 
        !currentCategories.some(pbc => pbc.name.toLowerCase() === dc.name.toLowerCase())
      );

      if (missingDefaults.length > 0) {
        const { data: newCategories, error: autoAddError } = await supabase
          .from('billing_categories')
          .insert(
            missingDefaults.map(dc => ({
              property_id: propertyId,
              name: dc.name,
              description: dc.description,
              sort_order: dc.sort_order,
              include_in_work_order: true
            }))
          )
          .select();
        
        if (!autoAddError && newCategories) {
           currentCategories.push(...newCategories);
           toast.success(`Added ${newCategories.length} default billing categories.`);
        } else {
            console.error('Error auto-adding default categories', autoAddError);
        }
      }

      setPropertyBillingCategories(currentCategories);

      // Check if Extra Charges category exists
      const hasExtraCharges = currentCategories.some(cat => cat.name === 'Extra Charges');
      let extraChargesCategoryId: string | null = null;
      
      // If Extra Charges doesn't exist, create it
      if (!hasExtraCharges) {
        const { data: extraChargesCategory, error: insertError } = await supabase
          .from('billing_categories')
          .insert([
            {
              property_id: propertyId,
              name: 'Extra Charges',
              description: 'Additional charges for special services or materials',
              sort_order: 4
            }
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        extraChargesCategoryId = extraChargesCategory.id;
        
        // Update the categories list with the new Extra Charges category
        setPropertyBillingCategories(prev => [...prev, extraChargesCategory]);
        currentCategories.push(extraChargesCategory); // Keep currentCategories in sync

        // Create default billing details for Extra Charges
        const { error: billingDetailsError } = await supabase
          .from('billing_details')
          .insert([
            {
              property_id: propertyId,
              category_id: extraChargesCategoryId,
              unit_size_id: unitSizes[0]?.id, // Use first unit size as default
              bill_amount: 40,
              sub_pay_amount: 20,
              profit_amount: null,
              is_hourly: true
            }
          ]);

        if (billingDetailsError) throw billingDetailsError;
      } else {
        // If category exists, check if it has billing details
        extraChargesCategoryId = currentCategories.find(cat => cat.name === 'Extra Charges')?.id || null;
      }

      const { data: billingDetailsData, error: fetchDetailsError } = await supabase
        .from('billing_details')
        .select('*')
        .eq('property_id', propertyId)
        .order(supportsDetailSortOrder ? 'sort_order' : 'updated_at');

      if (fetchDetailsError) throw fetchDetailsError;
      setBillingDetails(billingDetailsData || []);

      // If Extra Charges exists but has no billing details, create default ones
      if (extraChargesCategoryId && !billingDetailsData?.some(detail => detail.category_id === extraChargesCategoryId)) {
        const { error: billingDetailsError } = await supabase
          .from('billing_details')
          .insert([
            {
              property_id: propertyId,
              category_id: extraChargesCategoryId,
              unit_size_id: unitSizes[0]?.id, // Use first unit size as default
              bill_amount: 40,
              sub_pay_amount: 20,
              profit_amount: null,
              is_hourly: true
            }
          ]);

        if (billingDetailsError) throw billingDetailsError;

        // Refresh billing details after adding default rates
        const { data: updatedBillingDetails, error: refreshError } = await supabase
          .from('billing_details')
          .select('*')
          .eq('property_id', propertyId);

        if (refreshError) throw refreshError;
        setBillingDetails(updatedBillingDetails || []);
      }

    } catch (err) {
      console.error('Error fetching property billing data:', err);
      setError('Failed to load existing billing information.');
    }
  };

  const handleAddBillingItem = () => {
    setShowAddCategoryModal(true);
    setSelectedMasterCategoryId('');
    setIncludeInWorkOrder(false);
  };

  const handleConfirmAddCategory = async () => {
    if (!propertyId) return;

    setLoading(true);
    setError(null);

    try {
      // Only allow selecting existing categories - remove create new category logic
      if (!selectedMasterCategoryId) {
        toast.error('Please select a category from the dropdown');
        setLoading(false);
        return;
      }

      const selectedCategory = jobCategories.find(cat => cat.id === selectedMasterCategoryId);
      if (!selectedCategory) {
        throw new Error('Selected category not found');
      }

      // Check if this category already exists for the property
      const existingPropertyBillingCategory = propertyBillingCategories.find(pbc => 
        pbc.name.toLowerCase() === selectedCategory.name.toLowerCase()
      );

      if (existingPropertyBillingCategory) {
        toast.error('This category is already added to this property');
        setLoading(false);
        return;
      }

      // Create new property billing category
      const { data: newPropertyBillingCategory, error: insertPBCError } = await supabase
        .from('billing_categories')
        .insert([
          { 
            property_id: propertyId, 
            name: selectedCategory.name,
            description: selectedCategory.description,
            sort_order: selectedCategory.sort_order,
            include_in_work_order: includeInWorkOrder
          }
        ])
        .select('id')
        .single();

      if (insertPBCError) throw insertPBCError;

      // Add line item for the new category
      setCategoryLineItems(prev => ({
        ...prev,
        [newPropertyBillingCategory.id]: [{
          id: crypto.randomUUID(),
          unitSizeId: '',
          billAmount: '',
          subPayAmount: '',
          isHourly: false
        }]
      }));

      await fetchPropertyBillingData();
      
      toast.success('Category added to property successfully');

      // Close modal and reset form
      setShowAddCategoryModal(false);
      setSelectedMasterCategoryId('');
      setIncludeInWorkOrder(false);
      setHasChanges(true);

    } catch (err) {
      console.error('Error adding category:', err);
      setError(err instanceof Error ? err.message : 'Failed to add category.');
      toast.error(err instanceof Error ? err.message : 'Failed to add category.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (propertyBillingCategoryId: string) => {

    setLoading(true);
    setError(null);

    try {
      const { error: deleteBillingDetailsError } = await supabase
        .from('billing_details')
        .delete()
        .eq('category_id', propertyBillingCategoryId);

      if (deleteBillingDetailsError) {
        console.error('Error deleting associated billing details:', deleteBillingDetailsError);
      }

      const { error: deletePBCError } = await supabase
        .from('billing_categories')
        .delete()
        .eq('id', propertyBillingCategoryId)
        .eq('property_id', propertyId);

      if (deletePBCError) {
        console.error('Error deleting property billing category:', deletePBCError);
        throw deletePBCError;
      }


      await fetchPropertyBillingData();

      setShowDeleteConfirm(null);
      setHasChanges(true);

    } catch (err) {
      console.error('Error in handleDeleteCategory:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete billing category entry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const grouped: Record<string, BillingDetail[]> = {};
    billingDetails.forEach(detail => {
      const key = detail.category_id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(detail);
    });
    const next: CategoryLineItems = {};
    Object.keys(grouped).forEach(categoryId => {
      const details = grouped[categoryId];
      const sorted = [...details].sort((a, b) => {
        if (supportsDetailSortOrder) {
          const ao = a.sort_order ?? 0;
          const bo = b.sort_order ?? 0;
          return ao - bo;
        }
        return 0;
      });
      next[categoryId] = sorted.map(d => ({
        id: crypto.randomUUID(),
        unitSizeId: d.unit_size_id,
        billAmount: d.bill_amount.toString(),
        subPayAmount: d.sub_pay_amount.toString(),
        isHourly: d.is_hourly
      }));
    });
    setCategoryLineItems(next);
  }, [billingDetails, supportsDetailSortOrder]);

  const handleRemoveLineItem = (propertyBillingCategoryId: string, lineItemId: string) => {
    setCategoryLineItems(prev => ({
      ...prev,
      [propertyBillingCategoryId]: prev[propertyBillingCategoryId].filter(item => item.id !== lineItemId)
    }));
    setHasChanges(true);
  };

  const handleLineItemChange = (
    propertyBillingCategoryId: string,
    lineItemId: string,
    field: keyof CategoryLineItem,
    value: string | boolean
  ) => {
    setCategoryLineItems(prev => ({
      ...prev,
      [propertyBillingCategoryId]: prev[propertyBillingCategoryId].map(item =>
        item.id === lineItemId ? { ...item, [field]: value } : item
      )
    }));
    setHasChanges(true);
  };

  const handleCategoryChange = (categoryId: string, field: keyof PropertyBillingCategory, value: any) => {
    setPropertyBillingCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, [field]: value } : cat
    ));
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    setLoading(true);
    setError(null);

    try {
      // Save category settings (including include_in_work_order and sort_order)
      const categoryUpdates = propertyBillingCategories.map(cat => {
        // Enforce include_in_work_order=true for default categories
        const isDefault = jobCategories.find(jc => jc.name === cat.name)?.is_default;
        
        return {
          id: cat.id,
          property_id: propertyId,
          name: cat.name,
          description: cat.description,
          sort_order: cat.sort_order, // Ensure current sort order is saved
          include_in_work_order: isDefault ? true : cat.include_in_work_order
        };
      });

      const { error: catError } = await supabase
        .from('billing_categories')
        .upsert(categoryUpdates, { onConflict: 'id' });

      if (catError) throw catError;

      const updates: any[] = [];

      for (const propertyBillingCategoryId in categoryLineItems) {
        const items = categoryLineItems[propertyBillingCategoryId] || [];
        items.forEach((lineItem, index) => {
          const pbc = propertyBillingCategories.find(p => p.id === propertyBillingCategoryId);
          if (!pbc || pbc.property_id !== propertyId) {
            console.warn(`Skipping line item for property billing category ${propertyBillingCategoryId} not associated with property ${propertyId}`);
            return;
          }

          if (!lineItem.unitSizeId || !lineItem.billAmount || !lineItem.subPayAmount) return;

          const billAmountNum = parseFloat(lineItem.billAmount);
          const subPayAmountNum = parseFloat(lineItem.subPayAmount);
          
          // For hourly rates, we don't calculate profit here as it will be based on actual hours worked
          const profitAmount = lineItem.isHourly ? null : billAmountNum - subPayAmountNum;

          updates.push({
            property_id: propertyId,
            category_id: propertyBillingCategoryId,
            unit_size_id: lineItem.unitSizeId,
            bill_amount: billAmountNum,
            sub_pay_amount: subPayAmountNum,
            profit_amount: profitAmount,
            is_hourly: lineItem.isHourly,
            ...(supportsDetailSortOrder ? { sort_order: index + 1 } : {})
          });
        });
      }

      // Use upsert instead of delete-then-insert to avoid conflicts
      if (updates.length > 0) {
        const { error: upsertError } = await supabase
          .from('billing_details')
          .upsert(updates, { 
            onConflict: 'property_id,category_id,unit_size_id',
            ignoreDuplicates: false 
          });

        if (upsertError) throw upsertError;
      }

      setHasChanges(false);
      
      // Navigate back to property details page
      navigate(`/dashboard/properties/${propertyId}`);

    } catch (err) {
      console.error('Error saving billing details:', err);
      setError(err instanceof Error ? err.message : 'Failed to save billing details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLineItem = (propertyBillingCategoryId: string) => {
    setCategoryLineItems(prev => ({
      ...prev,
      [propertyBillingCategoryId]: [
        ...(prev[propertyBillingCategoryId] || []),
        {
          id: crypto.randomUUID(),
          unitSizeId: '',
          billAmount: '',
          subPayAmount: '',
          isHourly: false
        }
      ]
    }));
    setHasChanges(true);
    if (autoSaveTimer) {
      window.clearTimeout(autoSaveTimer);
      setAutoSaveTimer(null);
    }
    const timerId = window.setTimeout(async () => {
      if (hasChanges && !loading) {
        try {
          await (async () => {
            setLoading(true);
            setError(null);
            try {
              const categoryUpdates = propertyBillingCategories.map(cat => {
                const isDefault = jobCategories.find(jc => jc.name === cat.name)?.is_default;
                return {
                  id: cat.id,
                  property_id: propertyId,
                  name: cat.name,
                  description: cat.description,
                  sort_order: cat.sort_order,
                  include_in_work_order: isDefault ? true : cat.include_in_work_order
                };
              });
              const { error: catError } = await supabase
                .from('billing_categories')
                .upsert(categoryUpdates, { onConflict: 'id' });
              if (catError) throw catError;
              const updates: any[] = [];
              for (const cid in categoryLineItems) {
                const items = categoryLineItems[cid] || [];
                items.forEach((li, idx) => {
                  const pbc = propertyBillingCategories.find(p => p.id === cid);
                  if (!pbc || pbc.property_id !== propertyId) return;
                  if (!li.unitSizeId || !li.billAmount || !li.subPayAmount) return;
                  const billAmountNum = parseFloat(li.billAmount);
                  const subPayAmountNum = parseFloat(li.subPayAmount);
                  const profitAmount = li.isHourly ? null : billAmountNum - subPayAmountNum;
                  updates.push({
                    property_id: propertyId,
                    category_id: cid,
                    unit_size_id: li.unitSizeId,
                    bill_amount: billAmountNum,
                    sub_pay_amount: subPayAmountNum,
                    profit_amount: profitAmount,
                    is_hourly: li.isHourly,
                    ...(supportsDetailSortOrder ? { sort_order: idx + 1 } : {})
                  });
                });
              }
              if (updates.length > 0) {
                const { error: upsertError } = await supabase
                  .from('billing_details')
                  .upsert(updates, { 
                    onConflict: 'property_id,category_id,unit_size_id',
                    ignoreDuplicates: false 
                  });
                if (upsertError) throw upsertError;
              }
              setHasChanges(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to auto-save billing details.');
            } finally {
              setLoading(false);
            }
          })();
        } catch {}
      }
    }, 2000);
    setAutoSaveTimer(timerId);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategoryId(categoryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    if (draggedCategoryId && draggedCategoryId !== categoryId) {
      setDragOverCategoryId(categoryId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCategoryId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCategoryId: string) => {
    e.preventDefault();
    
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      setDraggedCategoryId(null);
      setDragOverCategoryId(null);
      return;
    }

    try {
      // Get current categories and their sort orders
      const currentCategories = [...propertyBillingCategories];
      const draggedCategory = currentCategories.find(cat => cat.id === draggedCategoryId);
      const targetCategory = currentCategories.find(cat => cat.id === targetCategoryId);
      
      if (!draggedCategory || !targetCategory) {
        console.error('Could not find dragged or target category');
        return;
      }

      // Find indices
      const draggedIndex = currentCategories.findIndex(cat => cat.id === draggedCategoryId);
      const targetIndex = currentCategories.findIndex(cat => cat.id === targetCategoryId);

      // Remove dragged category from its current position
      currentCategories.splice(draggedIndex, 1);

      // Insert dragged category at target position
      currentCategories.splice(targetIndex, 0, draggedCategory);

      // Update sort orders
      const updatedCategories = currentCategories.map((cat, index) => ({
        ...cat,
        sort_order: index + 1
      }));

      // Update state immediately for responsive UI
      setPropertyBillingCategories(updatedCategories);
      setHasChanges(true);

      // We defer saving to the DB until the user clicks "Save All"
      // to allow for batch reordering without multiple DB calls
    } catch (err) {
      console.error('Error reordering categories:', err);
      toast.error('Failed to update category order');
      // Revert state on error
      await fetchPropertyBillingData();
    } finally {
      setDraggedCategoryId(null);
      setDragOverCategoryId(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedCategoryId(null);
    setDragOverCategoryId(null);
  };

  // Line item drag handlers
  const handleLineItemDragStart = (e: React.DragEvent, lineItemId: string) => {
    setDraggedLineItemId(lineItemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleLineItemDragOver = (e: React.DragEvent, lineItemId: string) => {
    e.preventDefault();
    if (draggedLineItemId && draggedLineItemId !== lineItemId) {
      setDragOverLineItemId(lineItemId);
    }
  };

  const handleLineItemDragLeave = () => {
    setDragOverLineItemId(null);
  };

  const handleLineItemDrop = async (e: React.DragEvent, targetLineItemId: string, categoryId: string) => {
    e.preventDefault();
    
    if (!draggedLineItemId || draggedLineItemId === targetLineItemId) {
      setDraggedLineItemId(null);
      setDragOverLineItemId(null);
      return;
    }

    try {
      // Get current line items for this category
      const currentLineItems = [...(categoryLineItems[categoryId] || [])];
      const draggedLineItem = currentLineItems.find(item => item.id === draggedLineItemId);
      const targetLineItem = currentLineItems.find(item => item.id === targetLineItemId);
      
      if (!draggedLineItem || !targetLineItem) {
        console.error('Could not find dragged or target line item');
        return;
      }

      // Find indices
      const draggedIndex = currentLineItems.findIndex(item => item.id === draggedLineItemId);
      const targetIndex = currentLineItems.findIndex(item => item.id === targetLineItemId);

      // Remove dragged line item from its current position
      currentLineItems.splice(draggedIndex, 1);

      // Insert dragged line item at target position
      currentLineItems.splice(targetIndex, 0, draggedLineItem);

      // Update state
      setCategoryLineItems(prev => ({
        ...prev,
        [categoryId]: currentLineItems
      }));
      setHasChanges(true);

    } catch (err) {
      console.error('Error reordering line items:', err);
      toast.error('Failed to update line item order');
    } finally {
      setDraggedLineItemId(null);
      setDragOverLineItemId(null);
    }
  };

  const handleLineItemDragEnd = () => {
    setDraggedLineItemId(null);
    setDragOverLineItemId(null);
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Property name label above the page title */}
        {propertyName && (
          <div className="text-xs text-gray-400 mb-1">
            Billing details for: <span className="font-medium text-gray-500">{propertyName}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => attemptNavigate(() => navigate(-1))}
              className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Property Billing Details</h1>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleAddBillingItem}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </button>
            <button
              onClick={handleSaveAll}
              disabled={loading || !hasChanges}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save All Changes'}
            </button>
            <button
              onClick={() => attemptNavigate(() => navigate(-1))}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Drag and Drop Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <GripVertical className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Drag and Drop Categories
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                Use the grip handle to drag categories and rearrange their order. Click “Save All Changes” to persist the new order.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <div className="space-y-4">
            {propertyBillingCategories.map(pbc => {
              const propertyBillingCategoryId = pbc.id;
              const isDefault = jobCategories.find(jc => jc.name === pbc.name)?.is_default;

              return (
                <div 
                  key={propertyBillingCategoryId} 
                  className={`bg-gray-50 dark:bg-[#0F172A] rounded-lg p-4 transition-all duration-200 ${
                    draggedCategoryId === propertyBillingCategoryId ? 'opacity-50 scale-95' : ''
                  } ${
                    dragOverCategoryId === propertyBillingCategoryId ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                  }`}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, propertyBillingCategoryId)}
                  onDragOver={(e) => handleDragOver(e, propertyBillingCategoryId)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, propertyBillingCategoryId)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-gray-900 dark:text-white font-medium">{pbc.name}</h3>
                        {pbc.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{pbc.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {isDefault ? (
                        <div className="flex items-center space-x-2 mr-2 text-blue-600 dark:text-blue-400" title="Default category - Automatically included in Work Order">
                          <ShieldCheck className="h-5 w-5" />
                          <span className="text-sm font-medium">Included</span>
                        </div>
                      ) : (
                        <label className="flex items-center space-x-2 cursor-pointer mr-2">
                          <input
                            type="checkbox"
                            checked={pbc.include_in_work_order || false}
                            onChange={(e) => handleCategoryChange(pbc.id, 'include_in_work_order', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Show on Work Order</span>
                        </label>
                      )}
                      <button
                        onClick={() => setShowDeleteConfirm(propertyBillingCategoryId)}
                      disabled={isDefault}
                      className={`text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ${
                        isDefault ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                      title={isDefault ? 'Default categories cannot be removed' : 'Delete category'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {categoryLineItems[propertyBillingCategoryId]?.map(lineItem => (
                      <div 
                        key={lineItem.id} 
                        className={`flex items-center space-x-4 p-3 rounded-lg border-2 transition-colors ${
                          draggedLineItemId === lineItem.id 
                            ? 'opacity-50 bg-blue-50 dark:bg-blue-900/20' 
                            : dragOverLineItemId === lineItem.id 
                            ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        draggable
                        onDragStart={(e) => handleLineItemDragStart(e, lineItem.id)}
                        onDragOver={(e) => handleLineItemDragOver(e, lineItem.id)}
                        onDragLeave={handleLineItemDragLeave}
                        onDrop={(e) => handleLineItemDrop(e, lineItem.id, propertyBillingCategoryId)}
                        onDragEnd={handleLineItemDragEnd}
                      >
                        <div className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={lineItem.unitSizeId}
                            onChange={(e) => handleLineItemChange(propertyBillingCategoryId, lineItem.id, 'unitSizeId', e.target.value)}
                            className="h-11 px-4 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                          >
                            <option value="">Select Unit Size</option>
                            {unitSizes.map(size => (
                              <option key={size.id} value={size.id}>
                                {size.unit_size_label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col space-y-1">
                          <label className="text-xs text-gray-500 dark:text-gray-400">
                            {pbc.name === 'Extra Charges' ? 'Billed Amount' : 'Bill Amount'}
                          </label>
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <input
                              type="number"
                              value={lineItem.billAmount}
                              onChange={(e) => handleLineItemChange(propertyBillingCategoryId, lineItem.id, 'billAmount', e.target.value)}
                              placeholder={"Bill Amount"}
                              className="w-32 h-11 px-4 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col space-y-1">
                          <label className="text-xs text-gray-500 dark:text-gray-400">
                            {pbc.name === 'Extra Charges' ? 'Sub Pay Amount' : 'Sub Pay'}
                          </label>
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <input
                              type="number"
                              value={lineItem.subPayAmount}
                              onChange={(e) => handleLineItemChange(propertyBillingCategoryId, lineItem.id, 'subPayAmount', e.target.value)}
                              placeholder={"Sub Pay"}
                              className="w-32 h-11 px-4 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={lineItem.isHourly}
                            onChange={(e) => handleLineItemChange(propertyBillingCategoryId, lineItem.id, 'isHourly', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Hourly Rate
                          </label>
                        </div>

                        <button
                          onClick={() => handleRemoveLineItem(propertyBillingCategoryId, lineItem.id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => handleAddLineItem(propertyBillingCategoryId)}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Line Item
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={loading || !hasChanges}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>

        {showAddCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-xl p-8 w-full max-w-2xl transform transition-all">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Add Category to Property</h3>
                <button
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setSelectedMasterCategoryId('');
                    setIncludeInWorkOrder(false);
                  }}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="min-h-[200px]">
                  {/* Only show existing categories selection - removed create new category option */}
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="masterCategorySelect" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Select Existing Category
                      </label>
                      <select
                        id="masterCategorySelect"
                        value={selectedMasterCategoryId}
                        onChange={(e) => setSelectedMasterCategoryId(e.target.value)}
                        className="w-full h-12 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                      >
                        <option value="">Select a category...</option>
                        {jobCategories
                          .filter(category => {
                            // Only show categories that aren't already added to this property
                            return !propertyBillingCategories.some(pbc => 
                              pbc.name.toLowerCase() === category.name.toLowerCase()
                            );
                          })
                          .map(category => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                      {jobCategories.filter(category => 
                        !propertyBillingCategories.some(pbc => 
                          pbc.name.toLowerCase() === category.name.toLowerCase()
                        )
                      ).length === 0 ? (
                        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                          All existing categories have been added to this property. Please create a new category in the admin settings instead.
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Choose from the list of available master categories. New categories must be created in the admin settings.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setSelectedMasterCategoryId('');
                    setIncludeInWorkOrder(false);
                  }}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#2D3B4E] border border-gray-300 dark:border-[#4B5563] rounded-lg hover:bg-gray-50 dark:hover:bg-[#374151] focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddCategory}
                  disabled={
                    loading || 
                    !selectedMasterCategoryId // Only check for selected category now
                  }
                  className="px-6 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all hover:shadow-md"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </span>
                  ) : (
                    'Add Selected Category'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Billing Category from Property</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to remove this billing category and all its line items from this property? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete from Property
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
