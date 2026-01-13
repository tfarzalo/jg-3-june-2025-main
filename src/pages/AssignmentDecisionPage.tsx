import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../lib/dateUtils';

type DeclineReasonCode =
  | 'schedule_conflict'
  | 'too_far'
  | 'scope_mismatch'
  | 'rate_issue'
  | 'other'
  | null;

interface TokenDetails {
  success: boolean;
  error?: string;
  is_valid?: boolean;
  token?: {
    expires_at: string;
    used_at: string | null;
    decision: 'accepted' | 'declined' | null;
    decision_at: string | null;
    subcontractor_id?: string;
  };
  job?: {
    id: string;
    work_order_num: number;
    scheduled_date: string;
    assignment_status?: string | null;
  };
  property?: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  subcontractor?: {
    full_name: string | null;
    email: string | null;
  };
}

export default function AssignmentDecisionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [details, setDetails] = useState<TokenDetails | null>(null);
  const [declineReason, setDeclineReason] = useState<DeclineReasonCode>(null);
  const [declineText, setDeclineText] = useState('');

  useEffect(() => {
    if (!token) {
      setDetails({ success: false, error: 'Missing assignment token' });
      setLoading(false);
      return;
    }
    fetchDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_assignment_token_details', { p_token: token });
      if (error || !data) {
        setDetails({ success: false, error: error?.message || 'Unable to load assignment details' });
      } else {
        setDetails(data as TokenDetails);
      }
    } catch (err) {
      console.error('Error fetching assignment token details', err);
      setDetails({ success: false, error: 'Unable to load assignment details' });
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision: 'accepted' | 'declined') => {
    if (!token) return;
    if (decision === 'declined' && (!declineReason || (declineReason === 'other' && !declineText.trim()))) {
      toast.error('Please select a reason and add a note for Other.');
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('process_assignment_token', {
        p_token: token,
        p_decision: decision,
        p_decline_reason_code: decision === 'declined' ? declineReason : null,
        p_decline_reason_text: decision === 'declined' ? declineText || null : null
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed to submit decision');
      }

      await sendAdminNotifications(decision);

      toast.success(decision === 'accepted' ? 'Assignment accepted' : 'Assignment declined');
      await fetchDetails();
    } catch (err) {
      console.error('Error submitting assignment decision', err);
      toast.error(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setProcessing(false);
    }
  };

  const isUsed = useMemo(() => {
    if (!details?.token) return false;
    return Boolean(details.token.used_at || details.token.decision);
  }, [details]);

  const expired = useMemo(() => {
    if (!details?.token?.expires_at) return false;
    return new Date(details.token.expires_at).getTime() < Date.now();
  }, [details]);

  const sendAdminNotifications = async (decision: 'accepted' | 'declined') => {
    if (!details?.job) return;
    try {
      const { data: recipients, error: recError } = await supabase
        .from('sub_assignment_notification_recipients')
        .select('user_id, profiles!inner(full_name, email)');
      if (recError || !recipients) {
        console.warn('No assignment alert recipients or failed to load', recError);
        return;
      }

      const subject = `[Assignment ${decision}] WO-${String(details.job.work_order_num).padStart(6, '0')} - ${details.property?.name || 'Job'}`;
      const readableDate = details.job.scheduled_date ? formatDate(details.job.scheduled_date) : null;
      const summary = `Subcontractor ${details.subcontractor?.full_name || 'Unknown'} ${decision} assignment for ${details.property?.name || 'job'} (WO-${String(details.job.work_order_num).padStart(6, '0')})${readableDate ? ` scheduled ${readableDate}` : ''}.`;
      const htmlCard = `
        <div style="font-family: Arial, sans-serif; color: #111827; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e5e7eb; max-width: 520px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">${decision === 'accepted' ? 'Accepted' : 'Declined'} by ${details.subcontractor?.full_name || 'Subcontractor'}</p>
          <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700;">${details.property?.name || 'Job'} • WO-${String(details.job.work_order_num).padStart(6, '0')}</h2>
          ${readableDate ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Scheduled: ${readableDate}</p>` : ''}
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Decision: <strong style="color:${decision === 'accepted' ? '#16a34a' : '#dc2626'}; text-transform: capitalize;">${decision}</strong></p>
          ${decision === 'declined' ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #374151;">Reason: ${declineReason || 'n/a'}${declineText ? ` — ${declineText}` : ''}</p>` : ''}
          <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b7280;">This is an automated assignment notification.</p>
        </div>
      `;

      for (const rec of recipients) {
        const email = rec.profiles?.email;
        if (email) {
          await supabase.functions.invoke('send-email', {
            body: {
              to: email,
              subject,
              text: `${summary}

Reason: ${decision === 'declined' ? (declineReason || 'n/a') : 'n/a'}${declineText ? ` - ${declineText}` : ''}`,
              html: htmlCard
            }
          });
        }
        await supabase.rpc('send_notification', {
          p_user_id: rec.user_id,
          p_title: subject,
          p_message: summary,
          p_type: 'system',
          p_reference_id: details.job.id,
          p_reference_type: 'job'
        });
      }
    } catch (err) {
      console.error('Failed to send admin notifications for assignment decision', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-3 text-gray-600">
          <Clock className="h-5 w-5 animate-spin" />
          <span>Loading assignment…</span>
        </div>
      </div>
    );
  }

  if (!details?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full bg-white shadow rounded-lg p-6">
          <div className="flex items-center text-red-600 mb-3">
            <AlertCircle className="h-5 w-5 mr-2" />
            <h1 className="text-lg font-semibold">Invalid link</h1>
          </div>
          <p className="text-gray-700">{details?.error || 'This assignment link is not valid.'}</p>
        </div>
      </div>
    );
  }

  const jobLabel = details.job?.work_order_num
    ? `WO-${String(details.job.work_order_num).padStart(6, '0')}`
    : 'Assignment';
  const propertyLine = details.property?.name || 'Job Assignment';
  const addressLine = [
    details.property?.address,
    [details.property?.city, details.property?.state].filter(Boolean).join(', '),
    details.property?.zip
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white shadow-lg rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm uppercase text-gray-500 font-semibold">Assignment</p>
            <h1 className="text-2xl font-bold text-gray-900">{jobLabel}</h1>
            <p className="text-gray-600 mt-1">{propertyLine}</p>
            {addressLine && <p className="text-gray-500 text-sm mt-1">{addressLine}</p>}
            {details.job?.scheduled_date && (
              <p className="text-sm text-gray-600 mt-1">
                Scheduled: {formatDate(details.job.scheduled_date)}
              </p>
            )}
          </div>
          {isUsed ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span className="font-semibold capitalize">{details.token?.decision || 'completed'}</span>
            </div>
          ) : expired ? (
            <div className="flex items-center text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="font-semibold">Expired</span>
            </div>
          ) : (
            <div className="flex items-center text-blue-600">
              <Clock className="h-5 w-5 mr-2" />
              <span className="font-semibold">Action Needed</span>
            </div>
          )}
        </div>

        {isUsed && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-800 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span>
              Decision recorded: <strong className="capitalize">{details.token?.decision}</strong>
              {details.token?.decision_at && (
                <> on {formatDate(details.token.decision_at)}</>
              )}
            </span>
          </div>
        )}

        {expired && !isUsed && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 text-yellow-800 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>This link has expired.</span>
          </div>
        )}

        {!isUsed && !expired && (
          <>
            <div className="space-y-2 mb-6">
              <p className="text-gray-700">
                Please accept or decline this assignment. Declining will return the job to the unassigned pool.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <button
                onClick={() => handleDecision('accepted')}
                disabled={processing}
                className="inline-flex items-center justify-center px-4 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {processing ? 'Processing…' : 'Accept Assignment'}
              </button>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Decline Reason</label>
                <select
                  value={declineReason || ''}
                  onChange={(e) => setDeclineReason((e.target.value || null) as DeclineReasonCode)}
                  className="w-full border-gray-300 rounded-lg"
                  disabled={processing}
                >
                  <option value="">Select a reason</option>
                  <option value="schedule_conflict">Schedule conflict</option>
                  <option value="too_far">Too far / travel distance</option>
                  <option value="scope_mismatch">Scope mismatch</option>
                  <option value="rate_issue">Rate/payment issue</option>
                  <option value="other">Other</option>
                </select>
                {declineReason === 'other' && (
                  <textarea
                    className="w-full mt-2 border-gray-300 rounded-lg"
                    rows={3}
                    value={declineText}
                    onChange={(e) => setDeclineText(e.target.value)}
                    placeholder="Provide additional detail"
                    disabled={processing}
                  />
                )}
                <button
                  onClick={() => handleDecision('declined')}
                  disabled={processing}
                  className="mt-3 inline-flex items-center justify-center w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {processing ? 'Processing…' : 'Decline Assignment'}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="text-sm text-gray-500 flex items-center justify-between">
          <span>
            Link expires: {details.token?.expires_at ? formatDate(details.token.expires_at) : 'N/A'}
          </span>
          <button
            onClick={() => navigate('/dashboard/subcontractor')}
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
