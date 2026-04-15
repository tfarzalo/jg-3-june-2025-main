import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useWhatsNew } from '../../hooks/useWhatsNew';
import {
  formatWhatsNewDate,
  getWhatsNewBadgeClasses,
  renderWhatsNewIcon,
} from '../../lib/whatsNew/whatsNewOptions';

export function WhatsNewModal() {
  const { entries, loading, shouldShowModal, dismiss } = useWhatsNew();
  const [closing, setClosing] = useState(false);

  const [featuredEntry, previousEntries] = useMemo(() => {
    const [first, ...rest] = entries;
    return [first, rest];
  }, [entries]);

  const handleClose = async () => {
    try {
      setClosing(true);
      await dismiss();
    } catch (err) {
      console.error('Failed to dismiss what\'s new modal:', err);
      toast.error('Failed to dismiss What\'s New');
    } finally {
      setClosing(false);
    }
  };

  if (loading || !shouldShowModal || !featuredEntry) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.35)] dark:border-slate-700/60 dark:bg-[#0F172A]">
        <div className="relative overflow-hidden border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.2),_transparent_30%),linear-gradient(135deg,_#ffffff,_#f8fafc)] px-8 py-8 dark:border-slate-700/60 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.18),_transparent_30%),linear-gradient(135deg,_#0f172a,_#111827)]">
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:opacity-50 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close what's new"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-sky-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-sky-500/30 dark:bg-slate-900/60">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg dark:bg-sky-400 dark:text-slate-950">
              {renderWhatsNewIcon(featuredEntry.icon_name, 'h-5 w-5')}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
                What&apos;s New
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Fresh updates for admin and management users
              </p>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {featuredEntry.badge_label && (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${getWhatsNewBadgeClasses(featuredEntry.badge_label)}`}>
                  {featuredEntry.badge_label}
                </span>
              )}
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {formatWhatsNewDate(featuredEntry.updated_at)}
              </span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {featuredEntry.title}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              {featuredEntry.description}
            </p>
          </div>
        </div>

        <div className="px-8 py-7">
          <div className="flex items-center gap-3 pb-4">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              Previous Highlights
            </p>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          {previousEntries.length > 0 ? (
            <div className="grid gap-3">
              {previousEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400"
                >
                  <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {renderWhatsNewIcon(entry.icon_name, 'h-4 w-4')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {entry.title}
                      </p>
                      {entry.badge_label && (
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${getWhatsNewBadgeClasses(entry.badge_label)} opacity-75`}>
                          {entry.badge_label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {entry.description}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {formatWhatsNewDate(entry.updated_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              This is the first featured update.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
