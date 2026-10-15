import { Users } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useMemo, useState, type CSSProperties } from 'react';
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
  const { onlineUsers } = usePresence();
  const [tooltip, setTooltip] = useState<{ user: ActivityUser; left: number; top: number } | null>(null);
  const users = useMemo(() => Array.from(onlineUsers.values()) as ActivityUser[], [onlineUsers]);
  const subcontractors = users.filter((user) => user.role === 'subcontractor');
  const admins = users.filter((user) => user.role !== 'subcontractor');
  const activelyWorking = users.filter((user) => (
    (user.context_type === 'job' || user.context_type === 'work_order') && (user.activity_level ?? 0) >= 0.2
  )).length;

  const showTooltip = (element: HTMLButtonElement, user: ActivityUser) => {
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
      <button
        type="button"
        key={user.user_id}
        className="pulse-wave__event absolute z-[2] -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${(x / 220) * 100}%`, top: `${(y / 56) * 100}%`, backgroundColor: color, opacity: 0.35 + heat * 0.65 }}
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
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-xs font-bold text-gray-800 dark:text-slate-100">User Activity</h3>
              <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Live Only</span>
            </div>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-500">Currently online</p>
          </div>
        </div>
        <span className="text-2xl font-black leading-none text-gray-950 dark:text-white">{users.length}</span>
      </div>

      <div className="relative mt-3 h-[61px] overflow-hidden rounded-lg bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent">
        <svg viewBox="0 0 220 56" preserveAspectRatio="none" className="pulse-wave__svg h-14" aria-label={`${admins.length} admins and ${subcontractors.length} subcontractors online`}>
          <g style={{ color: ADMIN_COLOR }} opacity={lineOpacity(users)}>
            <path className="pulse-wave__trail" d={buildPresenceLine(users, 28)} />
            <path className="pulse-wave__line" pathLength="100" d={buildPresenceLine(users, 28)} style={{ '--pulse-duration': '5s', '--pulse-delay': '-1s' } as CSSProperties} />
            <circle className="pulse-wave__moving-dot" r="2.25">
              <animateMotion dur="5s" begin="-1s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.2;1" calcMode="linear" path={buildPresenceLine(users, 28)} />
              <animate attributeName="opacity" values="0.72;0.72;0;0" keyTimes="0;0.2;0.23;1" dur="5s" begin="-1s" repeatCount="indefinite" />
            </circle>
          </g>
        </svg>
        {renderPoints(users, 28, ADMIN_COLOR)}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] font-semibold">
        <span style={{ color: ADMIN_COLOR }}>{admins.length} Admin</span>
        <span style={{ color: SUBCONTRACTOR_COLOR }}>{subcontractors.length} Subs <span className="ml-1 text-gray-300 dark:text-slate-600">|</span></span>
        <span className="text-gray-500 dark:text-slate-400">{activelyWorking} Working</span>
      </div>
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
