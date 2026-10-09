import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Siren, VolumeX, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminAttention, type AdminAttentionItem } from '../../hooks/useAdminAttention';

interface AdminAttentionMenuProps {
  enabled: boolean;
}

const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const statusStyles: Record<AdminAttentionItem['kind'], { icon: React.ElementType; badge: string; iconClass: string }> = {
  approval_declined: { icon: XCircle, badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300', iconClass: 'text-red-600 dark:text-red-400' },
  assignment_declined: { icon: AlertTriangle, badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300', iconClass: 'text-red-600 dark:text-red-400' },
  approval_approved: { icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', iconClass: 'text-emerald-600 dark:text-emerald-400' },
  approval_required: { icon: AlertTriangle, badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', iconClass: 'text-amber-600 dark:text-amber-400' },
  approval_waiting: { icon: Clock3, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300', iconClass: 'text-blue-600 dark:text-blue-400' },
};

export function AdminAttentionMenu({ enabled }: AdminAttentionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pulseTimeoutRef = useRef<number | null>(null);
  const knownVersionsRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const { items, activeItems, loading, error, acknowledge } = useAdminAttention(enabled);
  const activeIds = new Set(activeItems.map(item => item.id));

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);

  useEffect(() => {
    if (open || activeItems.length === 0) {
      setPulse(false);
      return;
    }

    const triggerPulse = () => {
      setPulse(true);
      if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = window.setTimeout(() => setPulse(false), 1400);
    };

    const activeVersions = new Set(activeItems.map(item => item.version));
    const hasNewItem = [...activeVersions].some(version => !knownVersionsRef.current.has(version));
    if (hasNewItem) triggerPulse();
    knownVersionsRef.current = activeVersions;

    const interval = window.setInterval(triggerPulse, 30000);
    return () => {
      window.clearInterval(interval);
      if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
    };
  }, [activeItems, open]);

  if (!enabled) return null;

  const openItem = (item: AdminAttentionItem) => {
    acknowledge(item);
    setOpen(false);
    navigate(item.route);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`relative p-2 h-11 w-11 flex items-center justify-center rounded-full transition-colors ${
          activeItems.length
            ? 'text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/30 dark:hover:bg-red-950/50'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-[#1E293B]'
        }`}
        aria-label={`Attention needed${activeItems.length ? `, ${activeItems.length} active` : ''}`}
        aria-expanded={open}
        title="Attention needed"
        data-testid="admin-attention-trigger"
      >
        {pulse && <span className="absolute inset-1 rounded-full bg-red-400/30 animate-ping" aria-hidden="true" />}
        <Siren className={`relative h-5 w-5 transition-transform ${pulse ? 'scale-110' : 'scale-100'}`} />
        {activeItems.length > 0 && (
          <span className="absolute -top-1 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm dark:border-[#0F172A]">
            {activeItems.length > 99 ? '99+' : activeItems.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[390px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl z-50 dark:border-[#2D3B4E] dark:bg-[#1E293B]" data-testid="admin-attention-panel">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-[#2D3B4E]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <Siren className="h-4 w-4 text-red-600 dark:text-red-400" />
                  Attention Needed
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Time-sensitive items keeping jobs from moving forward. Only today&apos;s items are shown.
                </p>
              </div>
              {activeItems.length > 0 && (
                <div className="flex flex-none items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-red-100 px-1.5 font-bold tabular-nums dark:bg-red-950/60">
                    {activeItems.length}
                  </span>
                  <span>active</span>
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[65vh] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Checking for items needing attention…</div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-sm text-red-600 dark:text-red-400">Attention queue could not be loaded.</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Everything is moving</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">No time-sensitive job items need attention.</p>
              </div>
            ) : items.map(item => {
              const style = statusStyles[item.kind];
              const ItemIcon = style.icon;
              const active = activeIds.has(item.id);
              return (
                <div key={item.id} className={`border-b border-gray-100 px-4 py-3 last:border-0 dark:border-[#2D3B4E] ${active ? 'bg-red-50/40 dark:bg-red-950/10' : 'opacity-65'}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-50 dark:bg-[#0F172A]">
                      <ItemIcon className={`h-4 w-4 ${style.iconClass}`} />
                    </div>
                    <button type="button" onClick={() => openItem(item)} className="min-w-0 flex-1 text-left group">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">{item.title}</span>
                        <span className="flex-none text-[11px] text-gray-400">{relativeTime(item.updatedAt)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-300">{item.detail}</p>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>{item.statusLabel}</span>
                    </button>
                  </div>
                  <div className="mt-2 flex justify-end">
                    {active ? (
                      <button type="button" onClick={() => acknowledge(item)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white">
                        <VolumeX className="h-3.5 w-3.5" />
                        Silence alert
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><VolumeX className="h-3 w-3" /> Silenced until this item changes</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
