import React, { useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { useWhatsNew } from '../../hooks/useWhatsNew';
import {
  type WhatsNewEntry,
  formatWhatsNewDate,
  getWhatsNewAccentClasses,
  getWhatsNewBadgeClasses,
  isWhatsNewCurrentDate,
  renderWhatsNewIcon,
} from '../../lib/whatsNew/whatsNewOptions';

interface WhatsNewModalProps {
  forceOpen?: boolean;
  previewEntries?: WhatsNewEntry[];
  onPreviewClose?: () => void;
}

export function WhatsNewModal({
  forceOpen = false,
  previewEntries,
  onPreviewClose,
}: WhatsNewModalProps = {}) {
  const { entries, loading, shouldShowModal, dismiss } = useWhatsNew();
  const [closing, setClosing] = useState(false);
  const [olderUpdatesExpanded, setOlderUpdatesExpanded] = useState(false);

  const effectiveEntries = previewEntries ?? entries;
  const isOpen = forceOpen ? effectiveEntries.length > 0 : shouldShowModal;
  const [featuredEntry, previousEntries] = useMemo(() => {
    const [first, ...rest] = effectiveEntries;
    return [first, rest.slice(0, 4)];
  }, [effectiveEntries]);
  const [currentDateEntries, olderDateEntries] = useMemo(() => {
    const current = previousEntries.filter((entry) =>
      isWhatsNewCurrentDate(entry.updated_at || entry.created_at)
    );
    const older = previousEntries.filter((entry) =>
      !isWhatsNewCurrentDate(entry.updated_at || entry.created_at)
    );
    return [current, older];
  }, [previousEntries]);

  const handleClose = async () => {
    if (onPreviewClose) {
      onPreviewClose();
      return;
    }

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

  if ((loading && !forceOpen) || !isOpen || !featuredEntry) {
    return null;
  }

  const featuredAccent = getWhatsNewAccentClasses(featuredEntry.icon_color);
  const renderUpdateCard = (entry: WhatsNewEntry, isCurrent: boolean) => {
    const accent = getWhatsNewAccentClasses(entry.icon_color);

    return (
      <div
        key={entry.id}
        className={`flex min-h-[144px] items-start gap-4 rounded-2xl border px-4 py-4 transition ${
          isCurrent
            ? 'border-slate-200/80 bg-slate-50/80 text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300'
            : 'border-slate-200/70 bg-slate-100/70 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500'
        }`}
      >
        <div className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white ${accent.pill} ${!isCurrent ? 'opacity-45 grayscale' : ''}`}>
          {renderWhatsNewIcon(entry.icon_name, 'h-4 w-4')}
        </div>
        <div className="flex min-h-[112px] min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-sm font-semibold ${isCurrent ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-500'}`}>
                {entry.title}
              </p>
              {entry.badge_label && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${getWhatsNewBadgeClasses(entry.badge_label)} ${!isCurrent ? 'opacity-50 grayscale' : 'opacity-80'}`}>
                  {entry.badge_label}
                </span>
              )}
            </div>
            <p
              className={`mt-2 text-sm leading-6 ${isCurrent ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {entry.description}
            </p>
          </div>
          <span className="whitespace-nowrap text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {formatWhatsNewDate(entry.updated_at)}
          </span>
        </div>
      </div>
    );
  };

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

          <div className={`mb-5 inline-flex items-center gap-3 rounded-full border bg-white/80 px-4 py-2 backdrop-blur dark:bg-slate-900/60 ${featuredAccent.border}`}>
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg ${featuredAccent.pill}`}>
              {renderWhatsNewIcon(featuredEntry.icon_name, 'h-5 w-5')}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 dark:text-slate-200">
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
              Other Updates / Notes / News
            </p>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          {previousEntries.length > 0 ? (
            <div className="grid gap-3">
              {currentDateEntries.map((entry) => renderUpdateCard(entry, true))}

              {olderDateEntries.length > 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:border-slate-700/60 dark:bg-slate-900/30">
                  <button
                    type="button"
                    onClick={() => setOlderUpdatesExpanded((value) => !value)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Previous Date Updates
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        {olderDateEntries.length} older item{olderDateEntries.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition dark:bg-slate-800 dark:text-slate-300 ${olderUpdatesExpanded ? 'rotate-180' : ''}`}>
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>

                  {olderUpdatesExpanded && (
                    <div className="grid gap-3 border-t border-slate-200/80 px-4 py-4 dark:border-slate-700/60">
                      {olderDateEntries.map((entry) => renderUpdateCard(entry, false))}
                    </div>
                  )}
                </div>
              )}
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
