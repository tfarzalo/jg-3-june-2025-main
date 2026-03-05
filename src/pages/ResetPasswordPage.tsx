import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const MIN_PASSWORD_LENGTH = 8;

type PageState = 'loading' | 'ready' | 'completed' | 'error';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const parseJsonSafe = async (res: Response) => {
    const text = await res.text();
    if (!text || text.trim().length === 0) return {};
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('ResetPasswordPage: failed to parse response', err, text);
      throw new Error(text || 'Unexpected response from server');
    }
  };

  useEffect(() => {
    if (!token) {
      setError('Missing password reset token.');
      setState('error');
      return;
    }

    const validateToken = async () => {
      try {
        setState('loading');
        const validateUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-password-reset?token=${token}`;
        const res = await fetch(validateUrl, { method: 'GET' });
        const data = await parseJsonSafe(res);

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Invalid or expired reset link');
        }

        setRole(data.role ?? null);
        setState('ready');
      } catch (err: any) {
        console.error('ResetPasswordPage: token validation failed', err);
        setError(err?.message || 'Invalid or expired reset link');
        setState('error');
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Reset link is missing a token.');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-password-reset`;
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await parseJsonSafe(res);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Unable to update password');
      }

      setState('completed');
      toast.success('Password updated. You can sign in with your new password.');
    } catch (err: any) {
      console.error('ResetPasswordPage: submit failed', err);
      setError(err?.message || 'Unable to update password');
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCardBody = () => {
    if (state === 'loading') {
      return (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500" />
          <p className="text-sm text-gray-500 dark:text-gray-300">Checking your reset link…</p>
        </div>
      );
    }

    if (state === 'completed') {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 dark:border-green-500/40 dark:bg-green-900/40 dark:text-green-100">
            Password updated successfully. You can now sign in.
          </div>
          <button
            onClick={() => navigate('/auth')}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Return to login
          </button>
        </div>
      );
    }

    if (state === 'error') {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/40 dark:bg-red-900/40 dark:text-red-100">
            {error || 'Invalid or expired reset link.'}
          </div>
          <button
            onClick={() => navigate('/auth')}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Back to login
          </button>
        </div>
      );
    }

    return (
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Set a new password for your {role ? role.replace('_', ' ') : 'admin'} account.
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="new-password" className="sr-only">New password</label>
            <input
              id="new-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0F172A] px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="New password"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="sr-only">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0F172A] px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm password"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/40 dark:text-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        >
          {submitting ? 'Updating password…' : 'Update password'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel and go back
        </button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 bg-white dark:bg-[#1E293B] p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center space-y-1">
          <div className="mx-auto h-16 w-16 flex items-center justify-center">
            <img
              src="https://tbwtfimnbmvbgesidbxh.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1750132407578_jg-logo-icon.png"
              alt="JG Portal Logo"
              className="h-16 w-auto object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="h-10 w-10 text-gray-400">
                      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path>
                      <path d="M7 7h.01"></path>
                    </svg>
                  `;
                }
              }}
            />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Create a new password</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Secure reset for admin, JG management, and subcontractor accounts.</p>
        </div>
        {renderCardBody()}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
