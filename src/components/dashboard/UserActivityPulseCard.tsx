import { Users } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { usePresence } from '../../hooks/usePresence';

interface ActivityUser {
  user_id: string;
  display_name?: string;
  email?: string;
  role?: string;
  activity_level?: number;
  last_activity_at?: string;
  context_type?: 'job' | 'work_order' | 'dashboard' | 'other';
  current_path?: string;
  job_id?: string | null;
}

const ADMIN_COLOR = '#3B82F6';
const SUBCONTRACTOR_COLOR = '#F97316';

function buildPresenceLine(users: ActivityUser[], baseline: number) {
  if (!users.length) return `M0 ${baseline} H220`;
  const segments = [`M0 ${baseline}`];
  users.forEach((user, index) => {
    const x = ((index + 1) / (users.length + 1)) * 220;
    const heat = Math.max(0.08, Math.min(1, user.activity_level ?? 0.08));
    const y = baseline - 3 - heat * 10;
    segments.push(`H${x - 8} L${x} ${y} L${x + 8} ${baseline}`);
  });
  segments.push(`H220`);
  return segments.join(' ');
}

function lineOpacity(users: ActivityUser[]) {
  if (!users.length) return 0.14;
  const average = users.reduce((total, user) => total + (user.activity_level ?? 0.08), 0) / users.length;
  return 0.2 + average * 0.7;
}

function contextLabel(user: ActivityUser) {
  if (user.context_type === 'work_order') return user.job_id ? `Working on job ${user.job_id.slice(0, 8)}…` : 'Working on a work order';
  if (user.context_type === 'job') return user.job_id ? `Viewing job ${user.job_id.slice(0, 8)}…` : 'Viewing a job';
  if (user.context_type === 'dashboard') return 'Viewing the dashboard';
  return 'Using the application';
}

export function UserActivityPulseCard() {
  const { onlineUsers, isConnected } = usePresence();
  const [tooltip, setTooltip] = useState<{ user: ActivityUser; left: number; top: number } | null>(null);
  const users = useMemo(() => Array.from(onlineUsers.values()) as ActivityUser[], [onlineUsers]);
  const subcontractors = users.filter((user) => user.role === 'subcontractor');
  const admins = users.filter((user) => user.role !== 'subcontractor');
  const activelyWorking = users.filter((user) => (
    (user.context_type === 'job' || user.context_type === 'work_order') && (user.activity_level ?? 0) >= 0.2
  )).length;

  const showTooltip = (element: SVGCircleElement, user: ActivityUser) => {
    const bounds = element.getBoundingClientRect();
    setTooltip({
      user,
      left: Math.max(120, Math.min(window.innerWidth - 120, bounds.left + bounds.width / 2)),
      top: bounds.top - 8,
    });
  };

  const renderPoints = (group: ActivityUser[], baseline: number, color: string) => group.map((user, index) => {
    const x = ((index + 1) / (group.length + 1)) * 220;
    const heat = Math.max(0.08, Math.min(1, user.activity_level ?? 0.08));
    const y = baseline - 3 - heat * 10;
    return (
      <circle
        key={user.user_id}
        cx={x}
        cy={y}
        r="3.5"
        fill={color}
        opacity={0.35 + heat * 0.65}
        className="cursor-pointer transition-opacity"
        tabIndex={0}
        role="button"
        aria-label={`${user.display_name || user.email || 'User'}, ${user.role || 'user'}, ${contextLabel(user)}`}
        onMouseEnter={(event) => showTooltip(event.currentTarget, user)}
        onMouseLeave={() => setTooltip(null)}
        onFocus={(event) => showTooltip(event.currentTarget, user)}
        onBlur={() => setTooltip(null)}
      />
    );
  });

  return (
    <article className="group relative min-h-[150px] overflow-hidden rounded-xl border border-cyan-400/40 bg-gray-50/70 p-3 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950/35">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
            <Users className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-xs font-bold text-gray-800 dark:text-slate-100">User Activity</h3>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-500">Currently online</p>
          </div>
        </div>
        <span className="text-2xl font-black leading-none text-gray-950 dark:text-white">{users.length}</span>
      </div>

      <div className="mt-3 h-[61px] rounded-lg bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent">
        <svg viewBox="0 0 220 56" preserveAspectRatio="none" className="h-14 w-full overflow-visible" aria-label={`${admins.length} admins and ${subcontractors.length} subcontractors online`}>
          <path d={buildPresenceLine(admins, 20)} fill="none" stroke={ADMIN_COLOR} strokeWidth="1.5" opacity={lineOpacity(admins)} vectorEffect="non-scaling-stroke" />
          <path d={buildPresenceLine(subcontractors, 45)} fill="none" stroke={SUBCONTRACTOR_COLOR} strokeWidth="1.5" opacity={lineOpacity(subcontractors)} vectorEffect="non-scaling-stroke" />
          {renderPoints(admins, 20, ADMIN_COLOR)}
          {renderPoints(subcontractors, 45, SUBCONTRACTOR_COLOR)}
        </svg>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] font-semibold">
        <span style={{ color: ADMIN_COLOR }}>{admins.length} Admin</span>
        <span style={{ color: SUBCONTRACTOR_COLOR }}>{subcontractors.length} Subs <span className="ml-1 text-gray-300 dark:text-slate-600">|</span></span>
        <span className="text-gray-500 dark:text-slate-400">{activelyWorking} Working</span>
      </div>
      <span className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />

      {tooltip && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[100] w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-gray-200 bg-white/95 p-2.5 text-left shadow-xl backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/95"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5 dark:border-slate-700">
            <span className="truncate text-[11px] font-bold text-gray-950 dark:text-white">{tooltip.user.display_name || tooltip.user.email || 'Unknown user'}</span>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-600 dark:bg-slate-800 dark:text-slate-300">{tooltip.user.role || 'User'}</span>
          </div>
          <p className="mt-1.5 text-[10px] font-medium text-gray-700 dark:text-slate-200">{contextLabel(tooltip.user)}</p>
          <p className="mt-1 text-[9px] text-gray-500 dark:text-slate-400">
            Activity {Math.round((tooltip.user.activity_level ?? 0.08) * 100)}%
            {tooltip.user.last_activity_at ? ` · active ${formatDistanceToNow(new Date(tooltip.user.last_activity_at), { addSuffix: true })}` : ''}
          </p>
        </div>,
        document.body,
      )}
    </article>
  );
}
