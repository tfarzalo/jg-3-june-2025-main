import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '../utils/supabase';

type State = 'loading' | 'verified' | 'already_verified' | 'expired' | 'invalid';

export default function EmailVerificationPage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let active = true;
    void supabase.functions.invoke('verify-recipient-email', { body: { token } })
      .then(({ data }) => {
        if (!active) return;
        const next = data?.state;
        setState(['verified', 'already_verified', 'expired'].includes(next) ? next : 'invalid');
      })
      .catch(() => { if (active) setState('invalid'); });
    return () => { active = false; };
  }, [token]);

  const content = {
    loading: { icon: <Loader2 className="h-12 w-12 animate-spin text-blue-600" />, title: 'Verifying Email', body: 'Please wait while we verify this email address.' },
    verified: { icon: <CheckCircle2 className="h-12 w-12 text-green-600" />, title: 'Email Verified', body: 'This email address has been verified for JG Painting Pros notifications.' },
    already_verified: { icon: <CheckCircle2 className="h-12 w-12 text-green-600" />, title: 'Email Already Verified', body: 'This verification link has already been used successfully.' },
    expired: { icon: <Clock3 className="h-12 w-12 text-amber-600" />, title: 'Expired Verification Link', body: 'This link has expired. Please ask your JG Painting Pros contact to send a new initial email.' },
    invalid: { icon: <XCircle className="h-12 w-12 text-red-600" />, title: 'Invalid Verification Link', body: 'This verification link is invalid or cannot be used.' },
  }[state];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-[#0F172A]">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-[#2D3B4E] dark:bg-[#1E293B]">
        <div className="mx-auto mb-5 flex justify-center">{content.icon}</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{content.title}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{content.body}</p>
        {state === 'verified' && (
          <div className="mt-6 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-left text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            Verification confirms the address, but email providers still control message placement.
          </div>
        )}
      </section>
    </main>
  );
}
