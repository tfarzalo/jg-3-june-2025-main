import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';

export type EmailVerificationStatus = 'unverified' | 'verification_sent' | 'verified' | 'delivery_problem';
export type VerificationRecipient = {
  recipientType: 'profile' | 'property_contact' | 'property_system_contact';
  recipientId: string;
  recipientKey?: string;
  name: string;
  email: string;
};

export const normalizeVerificationEmail = (email: string) => email.trim().toLowerCase();

export function useEmailVerificationStatuses(emails: string[]) {
  const emailKey = [...new Set(emails.map(normalizeVerificationEmail).filter(Boolean))].sort().join('\u0000');
  const normalized = useMemo(
    () => emailKey ? emailKey.split('\u0000') : [],
    [emailKey],
  );
  const [statuses, setStatuses] = useState<Record<string, EmailVerificationStatus>>({});

  const refresh = useCallback(async () => {
    if (!normalized.length) {
      setStatuses({});
      return;
    }
    const { data, error } = await supabase
      .from('recipient_email_verifications')
      .select('normalized_email,status')
      .in('normalized_email', normalized);
    if (error) {
      console.error('Unable to load recipient email verification statuses:', error);
      return;
    }
    const next: Record<string, EmailVerificationStatus> = {};
    for (const row of data || []) next[row.normalized_email] = row.status as EmailVerificationStatus;
    setStatuses(next);
  }, [normalized]);

  useEffect(() => { void refresh(); }, [refresh]);

  const statusFor = useCallback((email: string): EmailVerificationStatus => (
    statuses[normalizeVerificationEmail(email)] || 'unverified'
  ), [statuses]);

  return { statusFor, refresh };
}
