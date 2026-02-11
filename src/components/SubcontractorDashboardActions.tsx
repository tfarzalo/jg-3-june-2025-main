import { useState } from 'react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { CheckCircle, XCircle } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';
import { BlockingLoadingModal } from './ui/BlockingLoadingModal';

type DeclineReasonCode = 'schedule_conflict' | 'too_far' | 'scope_mismatch' | 'rate_issue' | 'other' | '';

interface Props {
  jobId: string;
  workOrderNum: number;
  propertyName?: string | null;
  scheduledDate?: string | null;
  onDecision?: (decision: 'accepted' | 'declined') => void;
  language?: 'en' | 'es';
}

export function SubcontractorDashboardActions({ jobId, workOrderNum, propertyName, scheduledDate, onDecision, language = 'en' }: Props) {
  const [processing, setProcessing] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReasonCode>('');
  const [declineText, setDeclineText] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [subcontractorName, setSubcontractorName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAction, setSubmitAction] = useState<'accepted' | 'declined' | null>(null);

  // Translations
  const t = {
    en: {
      accept: 'Accept',
      accepting: 'Accepting...',
      decline: 'Decline',
      declining: 'Declining...',
      acceptingTitle: 'Accepting Assignment...',
      decliningTitle: 'Declining Assignment...',
      acceptingMessage: 'Please wait while we confirm your acceptance.',
      decliningMessage: 'Please wait while we process your decline.',
      selectReason: 'Select reason',
      reasonLabel: 'Reason',
      scheduleConflict: 'Schedule conflict',
      tooFar: 'Too far / travel distance',
      scopeMismatch: 'Scope mismatch',
      rateIssue: 'Rate/payment issue',
      other: 'Other',
      provideDetails: 'Provide details',
      cancel: 'Cancel',
      confirmDecline: 'Confirm Decline',
      chooseReason: 'Please choose a reason to decline.',
      provideReasonOther: 'Please provide a reason for Other.',
      acceptedToast: 'Assignment accepted',
      declinedToast: 'Assignment declined'
    },
    es: {
      accept: 'Aceptar',
      accepting: 'Aceptando...',
      decline: 'Rechazar',
      declining: 'Rechazando...',
      acceptingTitle: 'Aceptando Asignación...',
      decliningTitle: 'Rechazando Asignación...',
      acceptingMessage: 'Por favor espere mientras confirmamos su aceptación.',
      decliningMessage: 'Por favor espere mientras procesamos su rechazo.',
      selectReason: 'Seleccione razón',
      reasonLabel: 'Razón',
      scheduleConflict: 'Conflicto de horario',
      tooFar: 'Muy lejos / distancia de viaje',
      scopeMismatch: 'Alcance no coincide',
      rateIssue: 'Problema de tarifa/pago',
      other: 'Otro',
      provideDetails: 'Proporcione detalles',
      cancel: 'Cancelar',
      confirmDecline: 'Confirmar Rechazo',
      chooseReason: 'Por favor elija una razón para rechazar.',
      provideReasonOther: 'Por favor proporcione una razón para Otro.',
      acceptedToast: 'Asignación aceptada',
      declinedToast: 'Asignación rechazada'
    }
  };

  const text = t[language];

  const loadSubcontractorName = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.id) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userData.user.id)
      .single();
    setSubcontractorName(profile?.full_name || null);
    return profile?.full_name || null;
  };

  const submitDecision = async (decision: 'accepted' | 'declined') => {
    // Guard: prevent double-submission
    if (isSubmitting || processing) {
      return;
    }

    // Validate decline reason before showing loading modal
    if (decision === 'declined') {
      if (!declineReason) {
        toast.error(text.chooseReason);
        return;
      }
      if (declineReason === 'other' && !declineText.trim()) {
        toast.error(text.provideReasonOther);
        return;
      }
    }

    const startTime = Date.now();
    const MIN_DISPLAY_TIME = 500; // ms - prevents flash on fast networks

    try {
      // Show loading modal immediately
      setSubmitAction(decision);
      setIsSubmitting(true);
      setProcessing(true);

      const subName = subcontractorName || (await loadSubcontractorName());
      const { data, error } = await supabase.rpc('process_assignment_decision_authenticated', {
        p_job_id: jobId,
        p_decision: decision,
        p_decline_reason_code: decision === 'declined' ? declineReason || null : null,
        p_decline_reason_text: decision === 'declined' ? declineText || null : null
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed to submit decision');
      }

      await sendAdminNotifications(decision, subName || 'Subcontractor');

      // Ensure minimum display time to avoid flash
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_DISPLAY_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_TIME - elapsed));
      }

      // Success: close modal, show toast, trigger callback
      setIsSubmitting(false);
      setSubmitAction(null);
      toast.success(decision === 'accepted' ? text.acceptedToast : text.declinedToast);
      onDecision?.(decision);
      setShowDecline(false);
      setDeclineReason('');
      setDeclineText('');
    } catch (err) {
      console.error('Error in dashboard decision', err);
      
      // Ensure minimum display time even on error
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_DISPLAY_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_TIME - elapsed));
      }

      // Error: close modal, show error toast, keep UI intact
      setIsSubmitting(false);
      setSubmitAction(null);
      toast.error(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setProcessing(false);
    }
  };

  const sendAdminNotifications = async (decision: 'accepted' | 'declined', subName: string) => {
    try {
      const { data: recipients, error: recError } = await supabase
        .from('sub_assignment_notification_recipients')
        .select('user_id, profiles!inner(full_name, email)')
        .returns<Array<{ 
          user_id: string; 
          profiles: { full_name: string; email: string } 
        }>>();
      if (recError || !recipients) {
        console.warn('No assignment alert recipients configured or failed to load', recError);
        return;
      }

      const subject = `[Assignment ${decision}] WO-${String(workOrderNum).padStart(6, '0')} - ${propertyName || 'Job'}`;
      const readableDate = scheduledDate ? formatDate(scheduledDate) : null;
      const summary = `Subcontractor ${subName} ${decision} assignment for ${propertyName || 'job'} (WO-${String(workOrderNum).padStart(6, '0')})${readableDate ? ` scheduled ${readableDate}` : ''}.`;

      const htmlCard = `
        <div style="font-family: Arial, sans-serif; color: #111827; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e5e7eb; max-width: 520px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">${decision === 'accepted' ? 'Accepted' : 'Declined'} by ${subName}</p>
          <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700;">${propertyName || 'Job'} • WO-${String(workOrderNum).padStart(6, '0')}</h2>
          ${readableDate ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Scheduled: ${readableDate}</p>` : ''}
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Decision: <strong style="color:${decision === 'accepted' ? '#16a34a' : '#dc2626'}; text-transform: capitalize;">${decision}</strong></p>
          ${decision === 'declined' ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #374151;">Reason: ${declineReason || 'n/a'}${declineText ? ` — ${declineText}` : ''}</p>` : ''}
          <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b7280;">This is an automated assignment notification.</p>
        </div>
      `;

      for (const rec of recipients) {
        const email = rec.profiles?.email;
        const fullName = rec.profiles?.full_name || 'Team';
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
          p_reference_id: jobId,
          p_reference_type: 'job'
        });
      }
    } catch (err) {
      console.error('Error sending sub assignment notifications', err);
    }
  };

  return (
    <>
      {/* Blocking Loading Modal */}
      <BlockingLoadingModal
        open={isSubmitting}
        title={submitAction === 'accepted' ? text.acceptingTitle : text.decliningTitle}
        message={submitAction === 'accepted' ? text.acceptingMessage : text.decliningMessage}
      />

      <div className="flex items-center space-x-2">
        <button
          onClick={() => submitDecision('accepted')}
          disabled={processing || isSubmitting}
          className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          {isSubmitting && submitAction === 'accepted' ? text.accepting : text.accept}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowDecline(prev => !prev)}
            disabled={processing || isSubmitting}
            className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            <XCircle className="h-4 w-4 mr-1" />
            {isSubmitting && submitAction === 'declined' ? text.declining : text.decline}
          </button>
          {showDecline && (
            <div className="absolute z-10 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">{text.reasonLabel}</label>
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value as DeclineReasonCode)}
                className="w-full border-gray-300 rounded-lg text-sm"
                disabled={processing || isSubmitting}
              >
                <option value="">{text.selectReason}</option>
                <option value="schedule_conflict">{text.scheduleConflict}</option>
                <option value="too_far">{text.tooFar}</option>
                <option value="scope_mismatch">{text.scopeMismatch}</option>
                <option value="rate_issue">{text.rateIssue}</option>
                <option value="other">{text.other}</option>
              </select>
              {declineReason === 'other' && (
                <textarea
                  rows={3}
                  className="w-full mt-2 border-gray-300 rounded-lg text-sm"
                  value={declineText}
                  onChange={(e) => setDeclineText(e.target.value)}
                  placeholder={text.provideDetails}
                  disabled={processing || isSubmitting}
                />
              )}
              <div className="mt-3 flex justify-end space-x-2">
                <button
                  onClick={() => setShowDecline(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                  disabled={processing || isSubmitting}
                >
                  {text.cancel}
                </button>
                <button
                  onClick={() => submitDecision('declined')}
                  className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                  disabled={processing || isSubmitting}
                >
                  {text.confirmDecline}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
