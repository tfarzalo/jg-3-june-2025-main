import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, X, DollarSign, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/utils/supabase';

interface BillingCategory {
  id: string;
  property_id: string;
  name: string;
  sort_order: number;
}

interface UnitSize {
  id: string;
  unit_size_label: string;
}

interface BillingDetail {
  id: string;
  category_id: string;
  unit_size_id: string;
  bill_amount: number;
  sub_pay_amount: number;
  profit_amount: number | null;
  is_hourly: boolean;
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
  const [categories, setCategories] = useState<BillingCategory[]>([]);
  const [unitSizes, setUnitSizes] = useState<UnitSize[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetail[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newUnitSize, setNewUnitSize] = useState('');
  const [showNewUnitSizeForm, setShowNewUnitSizeForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [categoryLineItems, setCategoryLineItems] = useState<CategoryLineItems>({});

  useEffect(() => {
    if (!propertyId) {
      navigate('/dashboard/properties');
      return;
    }
    Promise.all([
      fetchCategories(),
      fetchUnitSizes(),
      fetchBillingDetails()
    ]);
  }, [propertyId, navigate]);

  useEffect(() => {
    // Initialize line items from billing details
    const initialLineItems: CategoryLineItems = {};
    billingDetails.forEach(detail => {
      if (!initialLineItems[detail.category_id]) {
        initialLineItems[detail.category_id] = [];
      }
      initialLineItems[detail.category_id].push({
        id: crypto.randomUUID(),
        unitSizeId: detail.unit_size_id,
        billAmount: detail.bill_amount.toString(),
        subPayAmount: detail.sub_pay_amount.toString(),
        isHourly: detail.is_hourly
      });
    });
    setCategoryLineItems(initialLineItems);
  }, [billingDetails]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_categories')
        .select('*')
        .eq('property_id', propertyId)
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
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

  const fetchBillingDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_details')
        .select('*')
        .eq('property_id', propertyId);

      if (error) throw error;
      setBillingDetails(data || []);
    } catch (err) {
      console.error('Error fetching billing details:', err);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    try {
      const { data, error } = await supabase
        .from('billing_categories')
        .insert([{
          property_id: propertyId,
          name: newCategory,
          sort_order: categories.length + 1
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setCategories([...categories, data]);
        setCategoryLineItems(prev => ({ ...prev, [data.id]: [] }));
      }
      setNewCategory('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('billing_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      setCategories(categories.filter(cat => cat.id !== categoryId));
      const newLineItems = { ...categoryLineItems };
      delete newLineItems[categoryId];
      setCategoryLineItems(newLineItems);
      setShowDeleteConfirm(null);
      setHasChanges(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const handleAddUnitSize = async () => {
    if (!newUnitSize.trim()) return;

    try {
      // First check if unit size already exists
      const { data: existingUnitSize, error: checkError } = await supabase
        .from('unit_sizes')
        .select('id')
        .eq('unit_size_label', newUnitSize)
        .maybeSingle();

      if (checkError) throw checkError;

      // If unit size exists, show error and return
      if (existingUnitSize) {
        setError('A unit size with this name already exists');
        return;
      }

      // If unit size doesn't exist, create it
      const { data, error } = await supabase
        .from('unit_sizes')
        .insert([{
          unit_size_label: newUnitSize
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setUnitSizes([...unitSizes, data]);
      }
      setNewUnitSize('');
      setShowNewUnitSizeForm(false);
      setError(null); // Clear any previous error
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add unit size');
    }
  };

  const handleAddLineItem = (categoryId: string) => {
    setCategoryLineItems(prev => ({
      ...prev,
      [categoryId]: [
        ...(prev[categoryId] || []),
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
  };

  const handleRemoveLineItem = (categoryId: string, lineItemId: string) => {
    setCategoryLineItems(prev => ({
      ...prev,
      [categoryId]: prev[categoryId].filter(item => item.id !== lineItemId)
    }));
    setHasChanges(true);
  };

  const handleLineItemChange = (
    categoryId: string,
    lineItemId: string,
    field: keyof CategoryLineItem,
    value: string | boolean
  ) => {
    setCategoryLineItems(prev => ({
      ...prev,
      [categoryId]: prev[categoryId].map(item =>
        item.id === lineItemId ? { ...item, [field]: value } : item
      )
    }));
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    setLoading(true);
    setError(null);

    try {
      const updates = [];

      for (const categoryId in categoryLineItems) {
        for (const lineItem of categoryLineItems[categoryId]) {
          if (!lineItem.unitSizeId || !lineItem.billAmount || !lineItem.subPayAmount) continue;

          const billAmountNum = parseFloat(lineItem.billAmount);
          const subPayAmountNum = parseFloat(lineItem.subPayAmount);
          const profitAmount = lineItem.isHourly ? null : billAmountNum - subPayAmountNum;

          updates.push({
            property_id: propertyId,
            category_id: categoryId,
            unit_size_id: lineItem.unitSizeId,
            bill_amount: billAmountNum,
            sub_pay_amount: subPayAmountNum,
            profit_amount: profitAmount,
            is_hourly: lineItem.isHourly
          });
        }
      }

      // First delete all existing billing details for this property
      const { error: deleteError } = await supabase
        .from('billing_details')
        .delete()
        .eq('property_id', propertyId);

      if (deleteError) throw deleteError;

      // Then insert the new billing details
      if (updates.length > 0) {
        const { error: insertError } = await supabase
          .from('billing_details')
          .insert(updates);

        if (insertError) throw insertError;
      }

      setHasChanges(false);
      navigate(`/dashboard/properties/${propertyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save billing details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Property Billing Details</h1>
          <div className="flex space-x-3">
            <button
              onClick={handleSaveAll}
              disabled={loading || !hasChanges}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save All Changes'}
            </button>
            <button
              onClick={() => navigate(`/dashboard/properties/${propertyId}`)}
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

        {/* Add New Category */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Category</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Enter category name"
              className="flex-1 rounded-lg bg-gray-50 dark:bg-[#0F172A] border-gray-300 dark:border-[#2D3B4E] text-gray-900 dark:text-white"
            />
            <button
              onClick={handleAddCategory}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Category
            </button>
          </div>
        </div>

        {/* Categories */}
        {categories.length === 0 ? (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow text-center">
            <p className="text-gray-500 dark:text-gray-400">No categories have been created yet. Add a new category to get started.</p>
          </div>
        ) : (
          categories.map(category => (
            <div key={category.id} className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{category.name}</h2>
                  <button
                    onClick={() => setShowDeleteConfirm(category.id)}
                    className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    title="Delete Category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowNewUnitSizeForm(true)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    + Add Unit Size
                  </button>
                  <button
                    onClick={() => handleAddLineItem(category.id)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    + Add Unit Billing
                  </button>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                {categoryLineItems[category.id]?.map(lineItem => (
                  <div key={lineItem.id} className="flex items-center space-x-4">
                    <select
                      value={lineItem.unitSizeId}
                      onChange={(e) => handleLineItemChange(category.id, lineItem.id, 'unitSizeId', e.target.value)}
                      className="w-48 rounded-lg bg-gray-50 dark:bg-[#0F172A] border-gray-300 dark:border-[#2D3B4E] text-gray-900 dark:text-white"
                    >
                      <option value="">Select Unit Size</option>
                      {unitSizes.map(size => (
                        <option key={size.id} value={size.id}>
                          {size.unit_size_label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <input
                        type="number"
                        value={lineItem.billAmount}
                        onChange={(e) => handleLineItemChange(category.id, lineItem.id, 'billAmount', e.target.value)}
                        placeholder={lineItem.isHourly ? "Hourly Rate" : "Bill Amount"}
                        className="w-24 rounded-lg bg-gray-50 dark:bg-[#0F172A] border-gray-300 dark:border-[#2D3B4E] text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <input
                        type="number"
                        value={lineItem.subPayAmount}
                        onChange={(e) => handleLineItemChange(category.id, lineItem.id, 'subPayAmount', e.target.value)}
                        placeholder={lineItem.isHourly ? "Hourly Pay" : "Sub Pay Amount"}
                        className="w-24 rounded-lg bg-gray-50 dark:bg-[#0F172A] border-gray-300 dark:border-[#2D3B4E] text-gray-900 dark:text-white"
                      />
                    </div>
                    <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={lineItem.isHourly}
                        onChange={(e) => handleLineItemChange(category.id, lineItem.id, 'isHourly', e.target.checked)}
                        className="rounded bg-gray-50 dark:bg-[#0F172A] border-gray-300 dark:border-[#2D3B4E] text-blue-600 focus:ring-blue-500"
                      />
                      <span>Hourly Rate</span>
                    </label>
                    {!lineItem.isHourly && (
                      <div className="flex items-center">
                        <span className="text-gray-700 dark:text-gray-400 mr-2">Profit:</span>
                        <span className="text-gray-900 dark:text-white">
                          ${(parseFloat(lineItem.billAmount || '0') - parseFloat(lineItem.subPayAmount || '0')).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveLineItem(category.id, lineItem.id)}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Add New Unit Size Form */}
        {showNewUnitSizeForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Unit Size</h3>
              <input
                type="text"
                value={newUnitSize}
                onChange={(e) => setNewUnitSize(e.target.value)}
                placeholder="Enter unit size name"
                className="w-full rounded-lg bg-gray-50 dark:bg-[#0F172A] border-gray-300 dark:border-[#2D3B4E] text-gray-900 dark:text-white mb-4"
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowNewUnitSizeForm(false);
                    setNewUnitSize('');
                    setError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUnitSize}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Unit Size
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Category Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Category</h3>
              <p className="text-gray-700 dark:text-gray-400 mb-4">
                Are you sure you want to delete this category? This will also delete all billing details associated with this category.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCategory(showDeleteConfirm)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Category
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}