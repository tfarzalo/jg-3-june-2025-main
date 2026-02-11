import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, AlertTriangle, Lock, Pencil, Check, X } from 'lucide-react';

interface JobCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_default: boolean;
  is_system: boolean;
  is_hidden?: boolean;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  isDangerous?: boolean;
}

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', isDangerous = false }: ConfirmationModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-full flex-shrink-0 ${isDangerous ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              isDangerous 
                ? 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export function JobCategoryManager() {
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', is_default: false });
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  
  const [modalConfig, setModalConfig] = useState<Omit<ConfirmationModalProps, 'onCancel'> & { onCancel?: () => void }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_categories')
        .select('*')
        .eq('is_hidden', false)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching job categories:', err);
      toast.error('Failed to load job categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;

    try {
      setProcessingId('new');
      
      const maxSortOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.sort_order)) 
        : 0;
      
      const { data, error } = await supabase
        .from('job_categories')
        .insert({
          name: newCategory.name.trim(),
          description: newCategory.description.trim() || null,
          is_default: newCategory.is_default,
          sort_order: maxSortOrder + 1,
          is_system: false
        })
        .select()
        .single();

      if (error) throw error;

      setCategories([...categories, data]);
      setNewCategory({ name: '', description: '', is_default: false });
      setIsAdding(false);
      toast.success('Category created successfully');
    } catch (err) {
      console.error('Error creating category:', err);
      toast.error('Failed to create category');
    } finally {
      setProcessingId(null);
    }
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleToggleDefault = async (category: JobCategory) => {
    const toggle = async () => {
      try {
        setProcessingId(category.id);
        const newValue = !category.is_default;
        
        const { error } = await supabase
          .from('job_categories')
          .update({ is_default: newValue })
          .eq('id', category.id);

        if (error) throw error;

        setCategories(categories.map(c => 
          c.id === category.id ? { ...c, is_default: newValue } : c
        ));
        
        toast.success(`Category ${newValue ? 'marked as default' : 'removed from defaults'}`);
      } catch (err) {
        console.error('Error updating category:', err);
        toast.error('Failed to update category');
      } finally {
        setProcessingId(null);
        closeModal();
      }
    };

    if (category.is_default) {
      setModalConfig({
        isOpen: true,
        title: 'Remove Default Status',
        message: `Are you sure you want to remove "${category.name}" from default categories?\n\nThis means it will no longer be automatically added to new properties.`,
        onConfirm: toggle,
        isDangerous: false,
        confirmLabel: 'Remove Default'
      });
    } else {
      toggle();
    }
  };

  const handleDelete = async (category: JobCategory) => {
    const performDelete = async () => {
      try {
        setProcessingId(category.id);

        // 1. First, find all related billing_categories (linked by name)
        const { data: billingCats } = await supabase
          .from('billing_categories')
          .select('id')
          .eq('name', category.name);

        if (billingCats && billingCats.length > 0) {
          const billingCatIds = billingCats.map(bc => bc.id);

          // 2. Delete billing details associated with these billing categories
          const { error: bdError } = await supabase
            .from('billing_details')
            .delete()
            .in('category_id', billingCatIds);
          
          if (bdError) console.error("Error deleting billing details:", bdError);

          // 3. Delete the billing categories themselves
          const { error: bcError } = await supabase
            .from('billing_categories')
            .delete()
            .in('id', billingCatIds);
            
          if (bcError) {
             console.error("Error deleting billing categories:", bcError);
             // We continue even if this fails, as the main goal is to hide the category
          }
        }

        // 4. Instead of deleting, mark as hidden (Soft Delete)
        // This preserves foreign key relationships for existing jobs/work orders
        const { error } = await supabase
          .from('job_categories')
          .update({ is_hidden: true })
          .eq('id', category.id);

        if (error) {
             console.error("Supabase error hiding job category:", error);
             throw error;
        }

        setCategories(categories.filter(c => c.id !== category.id));
        toast.success('Category deleted successfully');
      } catch (err: any) {
        console.error('Error deleting category:', err);
        // Even if it fails, try to refresh list to see if it was partial or if state is stale
        fetchCategories();
        
        // Show more detailed error if possible
        const errorMessage = err?.message || 'Failed to delete category.';
        toast.error(errorMessage);
      } finally {
        setProcessingId(null);
        closeModal();
      }
    };

    setModalConfig({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category.name}"?\n\nThis may affect existing jobs and cannot be undone.`,
      onConfirm: performDelete,
      isDangerous: true,
      confirmLabel: 'Delete Category'
    });
  };

  const startEditing = (category: JobCategory) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleRename = async (category: JobCategory) => {
    const trimmedName = editingName.trim();
    
    // Validate
    if (!trimmedName) {
      toast.error('Category name cannot be empty');
      return;
    }

    if (trimmedName === category.name) {
      // No change, just cancel
      cancelEditing();
      return;
    }

    // Check for duplicate (case-insensitive, client-side check for better UX)
    const duplicate = categories.find(
      c => c.id !== category.id && c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      toast.error('A category with that name already exists');
      return;
    }

    try {
      setProcessingId(category.id);

      // Call the RPC function to safely rename
      const { data, error } = await supabase.rpc('rename_job_category', {
        p_category_id: category.id,
        p_new_name: trimmedName
      });

      if (error) {
        // Handle specific error codes
        if (error.code === '42501') {
          toast.error("You don't have permission to rename categories");
        } else if (error.code === '23505') {
          toast.error('A category with that name already exists');
        } else if (error.message.includes('System categories')) {
          toast.error('System categories cannot be renamed');
        } else if (error.message.includes('not found')) {
          toast.error('Category not found');
        } else {
          toast.error(error.message || 'Failed to rename category');
        }
        throw error;
      }

      // Update local state with the renamed category
      setCategories(categories.map(c => 
        c.id === category.id ? { ...c, name: trimmedName } : c
      ));
      
      toast.success('Category renamed successfully');
      cancelEditing();
    } catch (err) {
      console.error('Error renaming category:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, category: JobCategory) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename(category);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Job Categories</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage global job categories. Default categories are automatically added to all properties.
          </p>
        </div>
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </button>
      </div>

      {isAdding && (
        <>
        <form onSubmit={handleAdd} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={newCategory.name}
                onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                placeholder="e.g. Cabinet Painting"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newCategory.description}
                onChange={e => setNewCategory({ ...newCategory, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newCategory.is_default}
                onChange={e => setNewCategory({ ...newCategory, is_default: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Set as Default (Add to all properties)</span>
            </label>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === 'new'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {processingId === 'new' ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </form>
        </>
      )}

      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {categories.map((category) => (
              <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === category.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, category)}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        disabled={processingId === category.id}
                        className="text-sm font-medium px-2 py-1 border border-blue-500 dark:border-blue-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        style={{ width: '200px' }}
                      />
                      <button
                        onClick={() => handleRename(category)}
                        disabled={processingId === category.id}
                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                        title="Save"
                      >
                        {processingId === category.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={processingId === category.id}
                        className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                      {category.name}
                      {category.is_default && (
                        <Lock className="w-3 h-3 ml-2 text-gray-400" />
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {category.description || '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleToggleDefault(category)}
                    disabled={!!processingId || !!editingId}
                    className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      category.is_default
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    } ${'cursor-pointer hover:bg-opacity-80'}`}
                  >
                    {category.is_default ? 'Default' : 'Optional'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {!category.is_system && editingId !== category.id && (
                      <button
                        onClick={() => startEditing(category)}
                        disabled={!!processingId || !!editingId}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                        title={category.is_system ? "System category can't be renamed" : "Rename category"}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {!category.is_default && editingId !== category.id && (
                      <button
                        onClick={() => handleDelete(category)}
                        disabled={!!processingId || !!editingId}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex items-start">
        <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium mb-1">About Default Categories</p>
          <p>
            Categories marked as "Default" will be automatically added to all properties' billing configuration. 
            They cannot be removed from a property's billing setup, ensuring they are always available for job billing breakdown.
          </p>
        </div>
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Rename Category
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                You are renaming a category. This action will update the category name everywhere it is used.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Category Name
                </label>
                <input
                  type="text"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, categories.find(c => c.id === editingId)!)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                  placeholder="Enter new category name"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelEditing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRename(categories.find(c => c.id === editingId)!)}
                  disabled={processingId !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {processingId === categories.find(c => c.id === editingId)!.id ? 'Renaming...' : 'Rename Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => {
          if (modalConfig.onCancel) modalConfig.onCancel();
          closeModal();
        }}
        isDangerous={modalConfig.isDangerous}
        confirmLabel={modalConfig.confirmLabel}
      />
    </div>
  );
}
