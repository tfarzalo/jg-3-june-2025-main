import React, { useEffect, useState } from 'react';
import { Wrench, LogIn, LogOut, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

interface MaintenancePageProps {
  message?: string;
  /** When true, renders as a closeable modal preview (for admin use) */
  isPreview?: boolean;
  onClosePreview?: () => void;
}

/* ── Animated progress bar that loops ── */
function ProgressBar() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const duration = 3200;
    const step = (ts: number) => {
      if (!start) start = ts;
      const pct = Math.min(((ts - start) / duration) * 100, 100);
      setWidth(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(step);
      } else {
        setTimeout(() => { start = null; setWidth(0); raf = requestAnimationFrame(step); }, 700);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="w-full h-1.5 bg-gray-200 dark:bg-[#1E293B] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${width}%`,
          background: 'linear-gradient(90deg, #276EF1, #6366f1)',
          transition: 'width 60ms linear',
        }}
      />
    </div>
  );
}

/* ── Auth panel at the bottom ── */
function AuthPanel() {
  const { session, signOut } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || 'Sign-in failed');
      toast.error(err.message || 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    setLoading(false);
  };

  /* Signed in */
  if (session) {
    return (
      <div className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700/60">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Signed in as <span className="text-gray-900 dark:text-white font-medium">{session.user.email}</span>
          </span>
        </div>
        <button
          onClick={handleSignOut}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
            bg-white dark:bg-[#0F172A] hover:bg-gray-100 dark:hover:bg-slate-800
            border border-gray-200 dark:border-gray-600
            text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
          Sign out
        </button>
      </div>
    );
  }

  /* Toggle button */
  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium w-full justify-center
          bg-gray-50 dark:bg-[#1E293B] hover:bg-gray-100 dark:hover:bg-slate-700/60
          border border-gray-200 dark:border-gray-700/60
          text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Admin sign-in
      </button>
    );
  }

  /* Sign-in form */
  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-[#1E293B] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/40 flex items-center justify-center">
            <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Admin Sign-in</span>
        </div>
        <button
          onClick={() => { setShowForm(false); setError(null); }}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none transition-colors"
        >×</button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSignIn} className="space-y-2.5">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0F172A]
            px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        />
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0F172A]
              px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
          <button type="button" onClick={() => setShowPw(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg
            bg-blue-600 hover:bg-blue-700 disabled:opacity-50
            py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
            : <><LogIn className="w-4 h-4" /> Sign in</>}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main MaintenancePage export
   ═══════════════════════════════════════════ */
export function MaintenancePage({
  message = 'We are currently performing scheduled maintenance and improvements. Please check back shortly.',
  isPreview = false,
  onClosePreview,
}: MaintenancePageProps) {

  const content = (
    <div className="w-full max-w-lg mx-auto">
      {/* Card */}
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #276EF1, #6366f1, #8b5cf6)' }} />

        <div className="px-8 py-10">
          {/* Preview badge */}
          {isPreview && (
            <div className="flex items-center justify-between mb-6">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50
                text-amber-700 dark:text-amber-300">
                <Eye className="w-3 h-3" />
                Preview Mode
              </span>
              <button
                onClick={onClosePreview}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                ✕ Close
              </button>
            </div>
          )}

          {/* Icon + heading */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-5">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl
                bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700/40">
                <Wrench className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500" />
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
              Under Maintenance
            </h1>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-4">
              Enhancements in Progress
            </p>

            {/* Progress bar */}
            <div className="w-full mb-2">
              <ProgressBar />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 tracking-wide uppercase font-medium animate-pulse">
              Deploying updates…
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700/60 mb-6" />

          {/* Message */}
          <div className="flex items-start gap-3 mb-6 p-4 rounded-xl
            bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-700/30">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {message}
            </p>
          </div>

          {/* Status pill */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
              bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/40
              text-blue-700 dark:text-blue-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              Maintenance active — back shortly
            </div>
          </div>

          {/* Auth panel */}
          <AuthPanel />
        </div>

        {/* Footer */}
        <div className="px-8 py-3 bg-gray-50 dark:bg-[#0F172A]/60 border-t border-gray-100 dark:border-gray-700/60">
          <p className="text-xs text-center text-gray-400 dark:text-gray-600">
            JG Painting Pros — Portal v2.0
          </p>
        </div>
      </div>
    </div>
  );

  /* ── Preview modal wrapper ── */
  if (isPreview) {
    return (
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  /* ── Full-screen maintenance gate ── */
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6
      bg-gray-50 dark:bg-[#0F172A] overflow-y-auto">
      {/* Subtle dot pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #6366f1 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10 w-full">
        {content}
      </div>
    </div>
  );
}
