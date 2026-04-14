/**
 * SmsNotificationLogs
 *
 * Admin-only component rendered inside AppSettings under the "SMS Logs" tab.
 *
 * Behaviour:
 *  - Queries sms_notification_logs_with_profile (a view that joins profiles).
 *  - Shows the 200 most recent rows, newest first.
 *  - Filterable by status and event_type via dropdowns.
 *  - Search by recipient name / email (client-side on loaded data).
 *  - Status badges use colour coding: sent=green, failed=red, skipped=yellow,
 *    simulated=purple, queued=gray.
 *  - Error / skip reason surfaced inline as a subdued row.
 *  - "Refresh" button re-fetches from DB.
 *  - Never exposes full phone numbers — only the masked phone_last4 field.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  FlaskConical,
  Search,
  Filter,
} from 'lucide-react';
import { supabase } from '../utils/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type SmsStatus = 'queued' | 'sent' | 'failed' | 'skipped' | 'simulated';

interface SmsLogRow {
  id: string;
  event_type: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  user_role: string | null;
  phone_last4: string | null;
  message_body: string | null;
  status: SmsStatus;
  provider_message_sid: string | null;
  provider_status: string | null;
  error_message: string | null;
  skip_reason: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  last_status_at: string | null;
  queue_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const MAX_ROWS = 200;

const STATUS_CONFIG: Record<
  SmsStatus,
  { label: string; icon: React.ElementType; classes: string; dot: string }
> = {
  sent: {
    label: 'Sent',
    icon: CheckCircle2,
    classes:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/40',
    dot: 'bg-green-500',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    classes:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40',
    dot: 'bg-red-500',
  },
  skipped: {
    label: 'Skipped',
    icon: MinusCircle,
    classes:
      'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800/40',
    dot: 'bg-yellow-400',
  },
  simulated: {
    label: 'Simulated',
    icon: FlaskConical,
    classes:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/40',
    dot: 'bg-purple-400',
  },
  queued: {
    label: 'Queued',
    icon: Clock,
    classes:
      'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
};

const EVENT_LABELS: Record<string, string> = {
  direct: 'Direct',
  chat_message: 'Chat',
  job_assigned: 'Job Assigned',
  work_order_submitted: 'Work Order Submitted',
  job_accepted: 'Job Accepted',
  charges_approved: 'Charges Approved',
  job_status_change: 'Job Status Change',
  assignment_reminder: 'Assignment Reminder',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function StatusBadge({ status }: { status: SmsStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${cfg.classes}`}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      {cfg.label}
    </span>
  );
}

function SummaryDot({ status, count }: { status: SmsStatus; count: number }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg || count === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{count}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{cfg.label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SmsNotificationLogs() {
  const [rows, setRows] = useState<SmsLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<SmsStatus | 'all'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('sms_notification_logs_with_profile')
        .select(
          'id, event_type, user_id, full_name, email, user_role, phone_last4, message_body, status, provider_message_sid, provider_status, error_message, skip_reason, delivered_at, failed_at, last_status_at, queue_id, metadata, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(MAX_ROWS);

      if (error) throw error;
      setRows((data as SmsLogRow[]) ?? []);
      setLastFetched(new Date());
      setPage(0);
    } catch (err) {
      console.error('[SmsNotificationLogs] load error:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load SMS logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Collect distinct event types for the filter dropdown
  const distinctEvents = useMemo(() => {
    const set = new Set(rows.map((r) => r.event_type));
    return Array.from(set).sort();
  }, [rows]);

  // Apply filters + search client-side
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (eventFilter !== 'all' && r.event_type !== eventFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (r.full_name ?? '').toLowerCase();
        const email = (r.email ?? '').toLowerCase();
        const event = r.event_type.toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !event.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, eventFilter, search]);

  // Summary counts (of filtered data)
  const counts = useMemo(() => {
    const c: Partial<Record<SmsStatus, number>> = {};
    for (const r of filtered) {
      c[r.status] = (c[r.status] ?? 0) + 1;
    }
    return c;
  }, [filtered]);

  // Paginated slice
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading SMS logs…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">Failed to load SMS logs</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              SMS Notification Logs
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Audit trail of every SMS the system attempted to send — including skips, failures,
              and dry-run simulations. Phone numbers are masked (last 4 digits only).
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex-shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Summary row */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-x-6 gap-y-2">
          {(['sent', 'failed', 'skipped', 'simulated', 'queued'] as SmsStatus[]).map((s) => (
            <SummaryDot key={s} status={s} count={counts[s] ?? 0} />
          ))}
          <span className="text-xs text-gray-400 dark:text-gray-500 self-center ml-auto">
            {lastFetched
              ? `Fetched at ${lastFetched.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · showing last ${MAX_ROWS} rows`
              : ''}
          </span>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, or event…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as SmsStatus | 'all'); setPage(0); }}
              className="text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All statuses</option>
              {(['sent', 'failed', 'skipped', 'simulated', 'queued'] as SmsStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>

          {/* Event type filter */}
          <select
            value={eventFilter}
            onChange={(e) => { setEventFilter(e.target.value); setPage(0); }}
            className="text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All events</option>
            {distinctEvents.map((e) => (
              <option key={e} value={e}>{EVENT_LABELS[e] ?? e}</option>
            ))}
          </select>

          {(statusFilter !== 'all' || eventFilter !== 'all' || search) && (
            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setEventFilter('all'); setSearch(''); setPage(0); }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Log table ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
          {rows.length === 0
            ? 'No SMS logs found. Logs will appear here once the system sends, skips, or fails an SMS.'
            : 'No logs match the current filters.'}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_140px_120px_120px_80px] gap-4 px-6 py-2.5 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <span>Recipient / Event</span>
            <span>Status</span>
            <span>Phone (last 4)</span>
            <span>Message SID</span>
            <span className="text-right">Time</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {paginated.map((row) => (
              <LogRow key={row.id} row={row} />
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-sm rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-sm rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Log row subcomponent ─────────────────────────────────────────────────────

function LogRow({ row }: { row: SmsLogRow }) {
  const [expanded, setExpanded] = useState(false);

  const displayName = row.full_name || row.email || row.user_id?.slice(0, 8) || '—';
  const eventLabel = EVENT_LABELS[row.event_type] ?? row.event_type;

  // Show a sub-detail line when there's an error or skip reason
  const detail = row.error_message || row.skip_reason;

  // Safe metadata rendering: pick a few known-safe keys
  const metaKeys = ['job_id', 'work_order_num', 'conversation_id', 'dispatcher_version', 'dedup_key', 'retry_count', 'source'];
  const metaEntries = row.metadata
    ? Object.entries(row.metadata).filter(([k]) => metaKeys.includes(k))
    : [];

  // Delivery info line
  const deliveryLabel: string | null =
    row.provider_status === 'delivered' && row.delivered_at
      ? `Delivered at ${formatDate(row.delivered_at)}`
      : row.provider_status === 'failed' || row.provider_status === 'undelivered'
      ? `${row.provider_status === 'undelivered' ? 'Undelivered' : 'Delivery failed'}${row.failed_at ? ` at ${formatDate(row.failed_at)}` : ''}`
      : row.provider_status && row.last_status_at
      ? `Twilio: ${row.provider_status} (${formatDate(row.last_status_at)})`
      : null;

  return (
    <>        <div
        className={`grid grid-cols-1 md:grid-cols-[1fr_140px_120px_120px_80px] gap-2 md:gap-4 px-6 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer ${
          expanded ? 'bg-gray-50 dark:bg-gray-800/30' : ''
        }`}
        onClick={() => (detail || deliveryLabel || metaEntries.length > 0) && setExpanded((e) => !e)}
        title={(detail || deliveryLabel || metaEntries.length > 0) ? 'Click to expand details' : undefined}
      >
        {/* Recipient / Event */}
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">{eventLabel}</span>
            {row.email && row.full_name && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{row.email}</span>
            )}
            {(detail || deliveryLabel || metaEntries.length > 0) && (
              <span className="text-xs text-blue-500 dark:text-blue-400">
                {expanded ? '▲ less' : '▼ more'}
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center">
          <StatusBadge status={row.status} />
        </div>

        {/* Phone last 4 */}
        <div className="flex items-center">
          <span className="text-xs font-mono text-gray-600 dark:text-gray-300">
            {row.phone_last4 ? `••••${row.phone_last4}` : '—'}
          </span>
        </div>

        {/* Message SID */}
        <div className="flex items-center">
          {row.provider_message_sid ? (
            <span
              className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate max-w-[110px]"
              title={row.provider_message_sid}
            >
              {row.provider_message_sid.slice(0, 12)}…
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
        {/* Time */}
        <div className="flex items-center md:justify-end">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {formatDate(row.created_at)}
          </span>
        </div>
      </div>

      {/* Expanded detail row */}
      {expanded && (detail || deliveryLabel || metaEntries.length > 0) && (
        <div className="px-6 pb-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-700/50">
          <div className="mt-2 space-y-2">
            {/* Delivery status line */}
            {deliveryLabel && (
              <div className={`flex items-center gap-2 text-xs rounded-md px-3 py-2 ${
                row.provider_status === 'delivered'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800/30'
                  : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800/30'
              }`}>
                <span className="font-mono leading-relaxed">{deliveryLabel}</span>
              </div>
            )}
            {detail && (
              <div
                className={`flex items-start gap-2 text-xs rounded-md px-3 py-2 ${
                  row.status === 'failed'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800/30'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-100 dark:border-yellow-800/30'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span className="font-mono leading-relaxed">{detail}</span>
              </div>
            )}
            {row.message_body && row.status === 'sent' && (
              <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/40 rounded-md px-3 py-2 font-mono leading-relaxed line-clamp-3">
                {row.message_body}
              </div>
            )}
            {metaEntries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {metaEntries.map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 font-mono text-gray-600 dark:text-gray-300"
                  >
                    <span className="text-gray-400 dark:text-gray-500">{k}:</span>
                    <span>{String(v)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
