import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, AlertTriangle, Ruler } from 'lucide-react';

interface UnitSize {
  id: string;
  unit_size_label: string;
  created_at?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 flex-shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export function UnitSizeManager() {
  const [unitSizes, setUnitSizes] = useState<UnitSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmModalProps>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => setConfirm(prev => ({ ...prev, isOpen: false })),
  });

  useEffect(() => {
    fetchUnitSizes();
  }, []);

  const fetchUnitSizes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('unit_sizes')
        .select('id, unit_size_label, created_at')
        .order('unit_size_label', { ascending: true });
      if (error) throw error;
      setUnitSizes(data || []);
    } catch (err) {
      console.error('Error fetching unit sizes:', err);
      toast.error('Failed to load unit sizes');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    if (unitSizes.some(u => u.unit_size_label.toLowerCase() === label.toLowerCase())) {
      toast.error('That unit size already exists');
      return;
    }
    try {
      setProcessingId('new');
      const { data, error } = await supabase
        .from('unit_sizes')
        .insert({ unit_size_label: label })
        .select('id, unit_size_label, created_at')
        .single();
      if (error) throw error;
      setUnitSizes(prev => [...prev, data].sort((a, b) => a.unit_size_label.localeCompare(b.unit_size_label)));
      setNewLabel('');
      setIsAdding(false);
      toast.success('Unit size created');
    } catch (err) {
      console.error('Error creating unit size:', err);
      toast.error('Failed to create unit size');
    } finally {
      setProcessingId(null);
    }
  };

  const promptDelete = (unitSize: UnitSize) => {
    setConfirm({
      isOpen: true,
      title: 'Delete Unit Size',
      message: `Are you sure you want to delete "${unitSize.unit_size_label}"?\n\nIf this unit size is used in property billing, it cannot be removed.`,
      onConfirm: () => performDelete(unitSize),
      onCancel: () => setConfirm(prev => ({ ...prev, isOpen: false })),
    });
  };

  const performDelete = async (unitSize: UnitSize) => {
    try {
      setProcessingId(unitSize.id);
      const { data: refs, error: refErr } = await supabase
        .from('billing_details')
        .select('id')
        .eq('unit_size_id', unitSize.id)
        .limit(1);
      if (refErr) throw refErr;
      if (refs && refs.length > 0) {
        toast.error('Cannot delete: unit size is in use');
        setProcessingId(null);
        setConfirm(prev => ({ ...prev, isOpen: false }));
        return;
      }
      const { error } = await supabase
        .from('unit_sizes')
        .delete()
        .eq('id', unitSize.id);
      if (error) throw error;
      setUnitSizes(prev => prev.filter(u => u.id !== unitSize.id));
      toast.success('Unit size deleted');
    } catch (err) {
      console.error('Error deleting unit size:', err);
      toast.error('Failed to delete unit size');
    } finally {
      setProcessingId(null);
      setConfirm(prev => ({ ...prev, isOpen: false }));
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
        <div className="flex items-center space-x-2">
          <Ruler className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Unit Sizes</h2>
        </div>
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 text-sm font-medium text白 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Unit Size
        </button>
      </div>

      {isAdding && (
        <>
        <form onSubmit={handleAdd} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
              <input
                type="text"
                required
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                placeholder="e.g. Studio, 1 Bedroom, 2 Bedroom"
              />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setNewLabel(''); }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processingId === 'new'}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {processingId === 'new' ? 'Creating...' : 'Create Unit Size'}
            </button>
          </div>
        </form>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={processingId === 'new'}
            onClick={() => document.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))}
            className="px-3 py-1.5 text-sm font-medium text白 bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {processingId === 'new' ? 'Creating...' : 'Create Unit Size'}
          </button>
        </div>
        </>
      )}

      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {unitSizes.map(size => (
              <tr key={size.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {size.unit_size_label}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => promptDelete(size)}
                    disabled={!!processingId}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {unitSizes.length === 0 && (
              <tr>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400" colSpan={2}>
                  No unit sizes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={confirm.isOpen}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </div>
  );
}
