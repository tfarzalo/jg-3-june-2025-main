import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, MailCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase';
import type { EmailVerificationStatus, VerificationRecipient } from '../../lib/emailVerification';

type Props = {
  recipient: VerificationRecipient;
  status: EmailVerificationStatus;
  onSent: () => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
};

const statusStyle: Record<EmailVerificationStatus, string> = {
  unverified: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  verification_sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  verified: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  delivery_problem: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
};

const statusLabel: Record<EmailVerificationStatus, string> = {
  unverified: 'Unverified',
  verification_sent: 'Verification Sent',
  verified: 'Verified',
  delivery_problem: 'Delivery Problem',
};

function StatusIcon({ status }: { status: EmailVerificationStatus }) {
  if (status === 'verified') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'verification_sent') return <Clock3 className="h-3.5 w-3.5" />;
  if (status === 'delivery_problem') return <AlertTriangle className="h-3.5 w-3.5" />;
  return null;
}

export function EmailVerificationControl({ recipient, status, onSent, disabled, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const reverify = status === 'verified';

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-initial-email', {
        body: {
          recipientType: recipient.recipientType,
          recipientId: recipient.recipientId,
          recipientKey: recipient.recipientKey,
        },
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.success) throw new Error(data?.error || 'The initial email could not be sent.');
      toast.success(`Initial verification email sent to ${recipient.email}.`);
      setOpen(false);
      await onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The initial email could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className={`flex ${compact ? 'items-center' : 'items-start'} flex-wrap gap-2`}>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[status]}`}>
          <StatusIcon status={status} />
          {statusLabel[status]}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {reverify ? 'Reverify' : 'Send Initial Email'}
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="presentation">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-[#1E293B]" role="dialog" aria-modal="true" aria-labelledby="initial-email-title">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-[#2D3B4E]">
              <div>
                <h2 id="initial-email-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  {reverify ? 'Reverify Email' : 'Send Initial Email'}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  This sends a simple JG Painting Pros email asking the recipient to verify their address and recognize JG Painting Pros as a legitimate sender.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={sending} className="ml-3 text-gray-400 hover:text-gray-600 disabled:opacity-40" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Recipient</p>
                <p className="mt-1 break-words text-sm font-medium text-gray-900 dark:text-white">{recipient.name || 'Unnamed recipient'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</p>
                <p className="mt-1 break-all text-sm text-gray-900 dark:text-white">{recipient.email}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-[#2D3B4E]">
              <button type="button" onClick={() => setOpen(false)} disabled={sending} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                Cancel
              </button>
              <button type="button" onClick={send} disabled={sending} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
                {sending ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
