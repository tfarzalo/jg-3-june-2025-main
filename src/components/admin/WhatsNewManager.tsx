import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Eye, EyeOff, Loader2, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import { Button } from '../ui/Button';
import {
  type WhatsNewBadgeLabel,
  type WhatsNewEntry,
  type WhatsNewIconName,
  WHATS_NEW_BADGE_OPTIONS,
  WHATS_NEW_ICON_OPTIONS,
  formatWhatsNewDate,
  getWhatsNewBadgeClasses,
  renderWhatsNewIcon,
} from '../../lib/whatsNew/whatsNewOptions';

type DraftEntry = {
  id?: string;
  title: string;
  description: string;
  icon_name: WhatsNewIconName;
  badge_label: WhatsNewBadgeLabel | '';
  is_published: boolean;
};

const EMPTY_DRAFT: DraftEntry = {
  title: '',
  description: '',
  icon_name: 'sparkles',
  badge_label: '',
  is_published: true,
};

export function WhatsNewManager() {
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [entries, setEntries] = useState<WhatsNewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DraftEntry | null>(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whats_new_entries')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setEntries((data ?? []) as WhatsNewEntry[]);
    } catch (err) {
      console.error('Error loading what\'s new entries:', err);
      toast.error('Failed to load What\'s New entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roleLoading && isSuperAdmin) {
      fetchEntries();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [isSuperAdmin, roleLoading]);

  const publishedCount = useMemo(
    () => entries.filter((entry) => entry.is_published).length,
    [entries]
  );

  const startCreate = () => setEditingEntry({ ...EMPTY_DRAFT });

  const startEdit = (entry: WhatsNewEntry) => {
    setEditingEntry({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      icon_name: entry.icon_name,
      badge_label: entry.badge_label ?? '',
      is_published: entry.is_published,
    });
  };

  const cancelEdit = () => setEditingEntry(null);

  const saveEntry = async () => {
    if (!editingEntry) return;
    if (!editingEntry.title.trim() || !editingEntry.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const actorId = authData.user?.id ?? null;

      const payload = {
        title: editingEntry.title.trim(),
        description: editingEntry.description.trim(),
        icon_name: editingEntry.icon_name,
        badge_label: editingEntry.badge_label || null,
        is_published: editingEntry.is_published,
        published_at: new Date().toISOString(),
        updated_by: actorId,
        ...(editingEntry.id ? {} : { created_by: actorId }),
      };

      if (editingEntry.id) {
        const { error } = await supabase
          .from('whats_new_entries')
          .update(payload)
          .eq('id', editingEntry.id);
        if (error) throw error;
        toast.success('What\'s New entry updated');
      } else {
        const { error } = await supabase
          .from('whats_new_entries')
          .insert(payload);
        if (error) throw error;
        toast.success('What\'s New entry created');
      }

      setEditingEntry(null);
      await fetchEntries();
    } catch (err) {
      console.error('Error saving What\'s New entry:', err);
      toast.error('Failed to save What\'s New entry');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm('Delete this What\'s New item?')) return;

    try {
      const { error } = await supabase
        .from('whats_new_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('What\'s New entry deleted');
      await fetchEntries();
    } catch (err) {
      console.error('Error deleting What\'s New entry:', err);
      toast.error('Failed to delete What\'s New entry');
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-12">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-8 border border-amber-200 dark:border-amber-700/40">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Super Admin Only</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Only the super admin account can manage What&apos;s New announcements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white px-8 py-7 shadow-sm dark:border-slate-700/60 dark:bg-[#1E293B]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <Sparkles className="h-3.5 w-3.5" />
              What&apos;s New
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
              Feature Spotlight Manager
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Create the modal highlights that admin and management users see after new features or updates ship.
              Editing a published entry makes it appear again on the next app load.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-slate-500 dark:text-slate-400">Published items</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{publishedCount}</p>
            </div>
            <Button onClick={startCreate} disabled={Boolean(editingEntry)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>
      </div>

      {editingEntry && (
        <div className="rounded-3xl border border-sky-200 bg-white p-8 shadow-sm dark:border-sky-700/40 dark:bg-[#1E293B]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
                {editingEntry.id ? 'Edit What\'s New Item' : 'New What\'s New Item'}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Configure the card shown in the announcement modal.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Item Title
                </label>
                <input
                  type="text"
                  value={editingEntry.title}
                  onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                  placeholder="Example: Snapshot-backed completed jobs"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Item Description
                </label>
                <textarea
                  value={editingEntry.description}
                  onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
                  placeholder="Describe the new functionality in a way that helps admin and management users understand the value quickly."
                  rows={5}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Callout Badge
                  </label>
                  <select
                    value={editingEntry.badge_label}
                    onChange={(e) => setEditingEntry({ ...editingEntry, badge_label: e.target.value as DraftEntry['badge_label'] })}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white"
                  >
                    <option value="">No badge</option>
                    {WHATS_NEW_BADGE_OPTIONS.map((badge) => (
                      <option key={badge} value={badge}>
                        {badge}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Publish immediately</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Published items appear to admin and management users.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingEntry({ ...editingEntry, is_published: !editingEntry.is_published })}
                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${editingEntry.is_published ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${editingEntry.is_published ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Feature Icon
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {WHATS_NEW_ICON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEditingEntry({ ...editingEntry, icon_name: option.value })}
                      className={`rounded-2xl border px-3 py-4 text-left transition ${editingEntry.icon_name === option.value ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-300' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300'}`}
                    >
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                        {renderWhatsNewIcon(option.value, 'h-4 w-4')}
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-wide">
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,_#f8fafc,_#eef2ff)] p-5 dark:border-slate-700 dark:bg-[linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(30,41,59,0.95))]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Live Preview
                </p>
                <div className="rounded-[22px] border border-white/70 bg-white/90 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-950/70">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-sky-400 dark:text-slate-950">
                      {renderWhatsNewIcon(editingEntry.icon_name, 'h-5 w-5')}
                    </div>
                    {editingEntry.badge_label && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getWhatsNewBadgeClasses(editingEntry.badge_label)}`}>
                        {editingEntry.badge_label}
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {editingEntry.title || 'Your title will appear here'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {editingEntry.description || 'Your description preview will appear here.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
            <Button onClick={saveEntry} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingEntry.id ? 'Save Changes' : 'Publish Item'}
            </Button>
            <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-[#1E293B]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Recent What&apos;s New Items</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Published items trigger the announcement modal on the next app load when they are newer than a user&apos;s last seen timestamp.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/40 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="flex min-w-0 gap-4">
                <div className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                  {renderWhatsNewIcon(entry.icon_name, 'h-5 w-5')}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white">{entry.title}</h4>
                    {entry.badge_label && (
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${getWhatsNewBadgeClasses(entry.badge_label)}`}>
                        {entry.badge_label}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${entry.is_published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {entry.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {entry.is_published ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {entry.description}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Updated {formatWhatsNewDate(entry.updated_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 lg:flex-shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(entry)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteEntry(entry.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}

          {entries.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No What&apos;s New items yet. Create one to start announcing new features.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
