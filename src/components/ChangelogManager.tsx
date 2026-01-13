import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Plus, Edit2, Trash2, Save, X, Calendar, Loader2 } from 'lucide-react';
import { useChangelog, ChangelogEntry } from '../hooks/useChangelog';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

export function ChangelogManager() {
  const { changelog, loading, refetch } = useChangelog();
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<ChangelogEntry> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    setEditingEntry({
      date: new Date().toISOString().split('T')[0],
      type: 'feature',
      title: '',
      description: ''
    });
    setIsEditing(true);
  };

  const handleEdit = (entry: ChangelogEntry) => {
    // Convert formatted date back to YYYY-MM-DD format
    const date = new Date(entry.date);
    const isoDate = date.toISOString().split('T')[0];
    
    setEditingEntry({
      ...entry,
      date: isoDate
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this changelog entry?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('changelog')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Changelog entry deleted');
      refetch();
    } catch (error) {
      console.error('Error deleting changelog entry:', error);
      toast.error('Failed to delete changelog entry');
    }
  };

  const handleSave = async () => {
    if (!editingEntry?.title || !editingEntry?.type || !editingEntry?.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);

    try {
      if (editingEntry.id) {
        // Update existing entry
        const { error } = await supabase
          .from('changelog')
          .update({
            date: editingEntry.date,
            type: editingEntry.type,
            title: editingEntry.title,
            description: editingEntry.description || null
          })
          .eq('id', editingEntry.id);

        if (error) throw error;
        toast.success('Changelog entry updated');
      } else {
        // Insert new entry
        const { error } = await supabase
          .from('changelog')
          .insert({
            date: editingEntry.date,
            type: editingEntry.type,
            title: editingEntry.title,
            description: editingEntry.description || null,
            is_published: true
          });

        if (error) throw error;
        toast.success('Changelog entry created');
      }

      setIsEditing(false);
      setEditingEntry(null);
      refetch();
    } catch (error) {
      console.error('Error saving changelog entry:', error);
      toast.error('Failed to save changelog entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingEntry(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Changelog Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage application updates and changelog entries
          </p>
        </div>
        <Button onClick={handleAdd} disabled={isEditing}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      {isEditing && editingEntry && (
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6 border-2 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingEntry.id ? 'Edit Entry' : 'New Entry'}
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={editingEntry.date}
                  onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Type *
                </label>
                <select
                  value={editingEntry.type}
                  onChange={(e) => setEditingEntry({ ...editingEntry, type: e.target.value as ChangelogEntry['type'] })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="feature">New Feature</option>
                  <option value="fix">Bug Fix</option>
                  <option value="enhancement">Enhancement</option>
                  <option value="update">Update</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={editingEntry.title}
                onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                placeholder="Enter changelog title"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Description
              </label>
              <textarea
                value={editingEntry.description || ''}
                onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
                placeholder="Enter detailed description (optional)"
                rows={3}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-[#2D3B4E]">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
              <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {changelog.map((entry) => (
            <div
              key={entry.id}
              className="bg-white dark:bg-[#1E293B] rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                      entry.type === 'feature' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                      entry.type === 'fix' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                      entry.type === 'enhancement' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                      'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                    }`}>
                      {entry.type === 'feature' ? 'Feature' :
                       entry.type === 'fix' ? 'Bug Fix' :
                       entry.type === 'enhancement' ? 'Enhancement' : 'Update'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {entry.date}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    {entry.title}
                  </h3>
                  {entry.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {entry.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(entry)}
                    disabled={isEditing}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => entry.id && handleDelete(entry.id)}
                    disabled={isEditing}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {changelog.length === 0 && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No changelog entries yet. Click "Add Entry" to create one.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
