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
  const [currentDateEntries, olderDateEntries] = useMemo(() => {
    const current = effectiveEntries.filter((entry) =>
      isWhatsNewCurrentDate(entry.updated_at || entry.created_at)
    );
    const older = effectiveEntries.filter((entry) =>
      !isWhatsNewCurrentDate(entry.updated_at || entry.created_at)
    );
    return [current, older];
  }, [effectiveEntries]);

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

  if ((loading && !forceOpen) || !isOpen || effectiveEntries.length === 0) {
    return null;
  }

  const renderUpdateCard = (entry: WhatsNewEntry, isCurrent: boolean) => {
    const accent = getWhatsNewAccentClasses(entry.icon_color);
    const effectiveDate = entry.updated_at || entry.created_at;

    return (
      <div
        key={entry.id}
        className={`flex min-h-[138px] items-start gap-4 rounded-[24px] border px-5 py-5 transition ${
          isCurrent
            ? 'border-slate-200/90 bg-slate-50/90 text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300'
            : 'border-slate-200/80 bg-slate-100/80 text-slate-400 dark:border-slate-800 dark:bg-slate-900/35 dark:text-slate-500'
        }`}
      >
        <div className={`inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] text-white ${accent.pill} ${!isCurrent ? 'opacity-50 grayscale' : ''}`}>
          {renderWhatsNewIcon(entry.icon_name, 'h-5 w-5')}
        </div>

        <div className="flex min-h-[92px] min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className={`text-[17px] font-semibold leading-tight ${isCurrent ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                {entry.title}
              </h3>
              {entry.badge_label && (
                <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${getWhatsNewBadgeClasses(entry.badge_label)} ${!isCurrent ? 'opacity-55 grayscale' : ''}`}>
                  {entry.badge_label}
                </span>
              )}
            </div>

            <p
              className={`mt-3 text-[14px] leading-7 ${isCurrent ? 'text-slate-500 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}
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

          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
            {formatWhatsNewDate(effectiveDate)}
          </p>
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

      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_36px_100px_rgba(15,23,42,0.32)] dark:border-slate-700/60 dark:bg-[#0F172A]">
        <div className="relative border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_35%),linear-gradient(135deg,_#ffffff,_#f8fafc)] px-6 py-5 dark:border-slate-700/60 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_35%),linear-gradient(135deg,_#0f172a,_#111827)]">
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:opacity-50 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close what's new"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          <div className="pr-14">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
              What&apos;s New
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Latest Updates, Notes, and News
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Entries appear in the order set in What&apos;s New settings.
            </p>
          </div>
        </div>

        <div className="max-h-[74vh] overflow-y-auto px-4 py-4 md:px-5 md:py-5">
          <div className="grid gap-4">
            {currentDateEntries.map((entry) => renderUpdateCard(entry, true))}

            {olderDateEntries.length > 0 && (
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 dark:border-slate-700/60 dark:bg-slate-900/30">
                <button
                  type="button"
                  onClick={() => setOlderUpdatesExpanded((value) => !value)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div>
                    <p className="text-[16px] font-semibold text-slate-700 dark:text-slate-200">
                      Previous Date Updates
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                      {olderDateEntries.length} older item{olderDateEntries.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition dark:bg-slate-800 dark:text-slate-300 ${olderUpdatesExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>

                {olderUpdatesExpanded && (
                  <div className="grid gap-4 border-t border-slate-200/80 px-4 py-4 md:px-5 md:py-5 dark:border-slate-700/60">
                    {olderDateEntries.map((entry) => renderUpdateCard(entry, false))}
                  </div>
                )}
              </div>
            )}

            {effectiveEntries.length === 0 && (
              <div className="rounded-[30px] border border-dashed border-slate-200 px-6 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No updates available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
