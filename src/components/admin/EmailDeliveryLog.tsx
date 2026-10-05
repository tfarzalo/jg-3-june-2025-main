import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, MailCheck, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../utils/supabase';

type RecipientKind = 'property_contact' | 'subcontractor' | 'internal' | 'external';

interface EmailSend {
  id: string;
  created_at: string;
  provider: string;
  status: string;
  email_type: string;
  subject: string;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  provider_message_id: string | null;
  attachment_count: number;
  estimated_message_bytes: number;
  submitted_at: string | null;
  delivered_at: string | null;
  last_error: string | null;
}

interface EmailEvent {
  outbound_email_send_id: string;
  event_type: string;
  severity: string | null;
  recipient_email: string | null;
  reason: string | null;
  event_at: string;
}

interface RecipientRow {
  email: string;
  channel: 'To' | 'CC' | 'BCC';
  kind: RecipientKind;
  status: string;
  reason: string | null;
  eventAt: string | null;
}

interface DisplaySend extends EmailSend {
  displayType: string;
  aggregateStatus: string;
  recipients: RecipientRow[];
  matchingRecipients: RecipientRow[];
}

const PAGE_SIZE = 25;

const TYPE_LABELS: Record<string, string> = {
  assignment_notification: 'Assignment Notification',
  extra_charge_approval: 'Extra Charge Approval',
  extra_charges: 'Extra Charge Approval',
  sprinkler_notification: 'Sprinkler Notification',
  sprinkler_paint: 'Sprinkler Notification',
  drywall_notification: 'Drywall Repair Notification',
  drywall_repairs: 'Drywall Repair Notification',
  general_work_order: 'General Work Order Update',
  daily_job_summary: 'Daily Job Summary',
  approval_receipt: 'Approval Receipt',
  internal_approval: 'Internal Approval Notification',
  password_reset: 'Password Reset',
  user_onboarding: 'User Onboarding',
  support_notification: 'Support Notification',
  notification: 'Notification',
  other: 'Other',
  general: 'Other',
};

const RECIPIENT_LABELS: Record<RecipientKind, string> = {
  property_contact: 'Property Contact',
  subcontractor: 'Subcontractor',
  internal: 'Internal JG User',
  external: 'External',
};

function normalizeEmail(value: string): string {
  const bracketed = value.match(/<([^<>]+)>/);
  return (bracketed?.[1] || value).trim().toLowerCase();
}

function inferType(emailType: string, subject: string): string {
  if (emailType && !['general', 'other'].includes(emailType)) return emailType;
  const normalized = subject.toLowerCase();
  if (normalized.startsWith('jg daily job summary')) return 'daily_job_summary';
  if (normalized.includes('new job assignment') || normalized.includes('assignment')) return 'assignment_notification';
  if (normalized.includes('extra charge') && normalized.includes('approval')) return 'extra_charge_approval';
  if (normalized.includes('sprinkler')) return 'sprinkler_notification';
  if (normalized.includes('drywall')) return 'drywall_notification';
  if (normalized.includes('work order update')) return 'general_work_order';
  if (normalized.includes('approval receipt') || normalized.includes('approval confirmation')) return 'approval_receipt';
  if (normalized.includes('password')) return 'password_reset';
  if (normalized.includes('welcome') || normalized.includes('account created')) return 'user_onboarding';
  if (normalized.includes('support')) return 'support_notification';
  return 'other';
}

function statusClasses(status: string): string {
  if (status === 'delivered') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (['failed', 'bounced', 'rejected', 'complained', 'permanent_failure'].includes(status)) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  }
  if (['deferred', 'temporary_failure'].includes(status)) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

export function EmailDeliveryLog() {
  const [sends, setSends] = useState<EmailSend[]>([]);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [internalEmails, setInternalEmails] = useState<Set<string>>(new Set());
  const [subcontractorEmails, setSubcontractorEmails] = useState<Set<string>>(new Set());
  const [propertyEmails, setPropertyEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [recipientFilter, setRecipientFilter] = useState<'external_focus' | RecipientKind | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sendResult, eventResult, profileResult, contactResult, propertyResult] = await Promise.all([
        supabase.from('outbound_email_sends').select('id, created_at, provider, status, email_type, subject, to_emails, cc_emails, bcc_emails, provider_message_id, attachment_count, estimated_message_bytes, submitted_at, delivered_at, last_error').order('created_at', { ascending: false }).limit(500),
        supabase.from('outbound_email_events').select('outbound_email_send_id, event_type, severity, recipient_email, reason, event_at').order('event_at', { ascending: false }).limit(2000),
        supabase.from('profiles').select('email, role').not('email', 'is', null),
        supabase.from('property_contacts').select('email, secondary_email'),
        supabase.from('properties').select('community_manager_email, community_manager_secondary_email, maintenance_supervisor_email, maintenance_supervisor_secondary_email, primary_contact_email, primary_contact_secondary_email, ap_email, ap_secondary_email'),
      ]);

      if (sendResult.error) throw sendResult.error;
      if (eventResult.error) throw eventResult.error;
      if (profileResult.error) throw profileResult.error;

      const nextInternal = new Set<string>();
      const nextSubcontractors = new Set<string>();
      for (const profile of profileResult.data || []) {
        if (!profile.email) continue;
        const email = normalizeEmail(profile.email);
        if (profile.role === 'subcontractor') nextSubcontractors.add(email);
        else nextInternal.add(email);
      }

      const nextProperty = new Set<string>();
      if (!contactResult.error) {
        for (const contact of contactResult.data || []) {
          if (contact.email) nextProperty.add(normalizeEmail(contact.email));
          if (contact.secondary_email) nextProperty.add(normalizeEmail(contact.secondary_email));
        }
      }
      if (!propertyResult.error) {
        for (const property of propertyResult.data || []) {
          for (const value of [
            property.community_manager_email,
            property.community_manager_secondary_email,
            property.maintenance_supervisor_email,
            property.maintenance_supervisor_secondary_email,
            property.primary_contact_email,
            property.primary_contact_secondary_email,
            property.ap_email,
            property.ap_secondary_email,
          ]) {
            if (value) nextProperty.add(normalizeEmail(value));
          }
        }
      }

      setSends((sendResult.data || []) as EmailSend[]);
      setEvents((eventResult.data || []) as EmailEvent[]);
      setInternalEmails(nextInternal);
      setSubcontractorEmails(nextSubcontractors);
      setPropertyEmails(nextProperty);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load email delivery activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, recipientFilter]);

  const displaySends = useMemo<DisplaySend[]>(() => {
    const latestEvents = new Map<string, EmailEvent>();
    for (const event of events) {
      if (!event.recipient_email) continue;
      const key = `${event.outbound_email_send_id}:${normalizeEmail(event.recipient_email)}`;
      if (!latestEvents.has(key)) latestEvents.set(key, event);
    }

    const classify = (email: string): RecipientKind => {
      if (internalEmails.has(email)) return 'internal';
      if (subcontractorEmails.has(email)) return 'subcontractor';
      if (propertyEmails.has(email)) return 'property_contact';
      return 'external';
    };

    return sends.map((send) => {
      const seen = new Set<string>();
      const recipients: RecipientRow[] = [];
      const addRecipients = (values: string[] = [], channel: RecipientRow['channel']) => {
        for (const value of values || []) {
          const email = normalizeEmail(value);
          if (!email || seen.has(email)) continue;
          seen.add(email);
          const event = latestEvents.get(`${send.id}:${email}`);
          const eventStatus = event?.event_type === 'failed'
            ? event.severity === 'temporary' ? 'deferred' : 'bounced'
            : event?.event_type;
          recipients.push({
            email,
            channel,
            kind: classify(email),
            status: eventStatus || send.status,
            reason: event?.reason || send.last_error,
            eventAt: event?.event_at || send.delivered_at || send.submitted_at,
          });
        }
      };
      addRecipients(send.to_emails, 'To');
      addRecipients(send.cc_emails, 'CC');
      addRecipients(send.bcc_emails, 'BCC');

      const matchingRecipients = recipients.filter((recipient) => {
        if (recipientFilter === 'all') return true;
        if (recipientFilter === 'external_focus') return recipient.kind !== 'internal';
        return recipient.kind === recipientFilter;
      });
      const recipientStatuses = recipients.map((recipient) => recipient.status);
      const deliveredCount = recipientStatuses.filter((status) => status === 'delivered').length;
      const terminalFailureCount = recipientStatuses.filter((status) => ['failed', 'bounced', 'rejected', 'complained', 'permanent_failure'].includes(status)).length;
      const aggregateStatus = recipients.length > 0 && deliveredCount === recipients.length
        ? 'delivered'
        : deliveredCount > 0 && terminalFailureCount > 0
          ? 'partially delivered'
          : recipientStatuses.some((status) => ['deferred', 'temporary_failure'].includes(status))
            ? 'deferred'
            : send.status === 'delivered'
              ? 'submitted'
              : send.status;
      return { ...send, displayType: inferType(send.email_type, send.subject), aggregateStatus, recipients, matchingRecipients };
    }).filter((send) => {
      if (!send.matchingRecipients.length) return false;
      if (typeFilter !== 'all' && send.displayType !== typeFilter) return false;
      if (statusFilter !== 'all' && !send.matchingRecipients.some((recipient) => recipient.status === statusFilter)) return false;
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return send.subject.toLowerCase().includes(needle)
        || send.matchingRecipients.some((recipient) => recipient.email.includes(needle));
    });
  }, [events, internalEmails, propertyEmails, recipientFilter, search, sends, statusFilter, subcontractorEmails, typeFilter]);

  const typeOptions = useMemo(() => Array.from(new Set(sends.map((send) => inferType(send.email_type, send.subject)))).sort(), [sends]);
  const totalPages = Math.max(1, Math.ceil(displaySends.length / PAGE_SIZE));
  const pageRows = displaySends.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visibleRecipients = displaySends.flatMap((send) => send.matchingRecipients);
  const deliveredCount = visibleRecipients.filter((recipient) => recipient.status === 'delivered').length;
  const problemCount = visibleRecipients.filter((recipient) => ['failed', 'bounced', 'rejected', 'complained', 'permanent_failure'].includes(recipient.status)).length;

  const toggleExpanded = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#1E293B]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <MailCheck className="h-5 w-5 text-blue-600" /> Email Delivery
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              External and subcontractor recipients are shown by default. Internal To, CC, and BCC recipients remain available in message details and filters.
            </p>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Messages', displaySends.length],
            ['Visible recipients', visibleRecipients.length],
            ['Delivered', deliveredCount],
            ['Problems', problemCount],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative block">
            <span className="sr-only">Search email activity</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject or recipient" className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </label>
          <select value={recipientFilter} onChange={(event) => setRecipientFilter(event.target.value as typeof recipientFilter)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
            <option value="external_focus">External + Subcontractors</option>
            <option value="property_contact">Property Contacts</option>
            <option value="subcontractor">Subcontractors</option>
            <option value="external">Other External</option>
            <option value="internal">Internal JG Users</option>
            <option value="all">All Recipients</option>
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
            <option value="all">All Notification Types</option>
            {typeOptions.map((type) => <option key={type} value={type}>{TYPE_LABELS[type] || type}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="delivered">Delivered</option>
            <option value="deferred">Deferred</option>
            <option value="temporary_failure">Temporary Failure</option>
            <option value="bounced">Bounced</option>
            <option value="rejected">Rejected</option>
            <option value="complained">Complaint</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#1E293B]">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Loading email delivery activity…</div>
        ) : pageRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">No email activity matches these filters.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pageRows.map((send) => {
              const isExpanded = expanded.has(send.id);
              const delivered = send.matchingRecipients.filter((recipient) => recipient.status === 'delivered').length;
              return (
                <div key={send.id}>
                  <button type="button" onClick={() => toggleExpanded(send.id)} className="grid w-full gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 md:grid-cols-[1.6rem_minmax(0,2fr)_minmax(0,1.3fr)_8rem_8rem] md:items-center">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-white">{send.subject}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDate(send.created_at)} · {TYPE_LABELS[send.displayType] || send.displayType}</p>
                    </div>
                    <div className="min-w-0 text-sm text-gray-700 dark:text-gray-300">
                      <p className="truncate">{send.matchingRecipients.map((recipient) => recipient.email).join(', ')}</p>
                      <p className="mt-1 text-xs text-gray-500">{delivered} of {send.matchingRecipients.length} delivered</p>
                    </div>
                    <span className={`w-fit rounded-full px-2 py-1 text-xs font-medium ${statusClasses(send.aggregateStatus)}`}>{send.aggregateStatus.replaceAll('_', ' ')}</span>
                    <div className="text-xs text-gray-500 md:text-right">{send.provider}<br />{formatBytes(send.estimated_message_bytes)}</div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/40">
                      <div className="mb-3 grid gap-2 text-xs text-gray-500 md:grid-cols-3">
                        <span>Attachments: {send.attachment_count}</span>
                        <span>Submitted: {formatDate(send.submitted_at)}</span>
                        <span className="truncate" title={send.provider_message_id || ''}>Message ID: {send.provider_message_id || '—'}</span>
                      </div>
                      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                          <thead className="bg-gray-100 dark:bg-gray-800"><tr>{['Recipient', 'Type', 'Field', 'Status', 'Latest event'].map((heading) => <th key={heading} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{heading}</th>)}</tr></thead>
                          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-[#1E293B]">
                            {send.recipients.map((recipient) => (
                              <tr key={`${recipient.channel}:${recipient.email}`} className={recipient.kind === 'internal' ? 'opacity-65' : ''}>
                                <td className="px-3 py-2 text-gray-900 dark:text-white">{recipient.email}{recipient.reason && <p className="mt-1 max-w-xl text-xs text-red-600 dark:text-red-300">{recipient.reason}</p>}</td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{RECIPIENT_LABELS[recipient.kind]}</td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{recipient.channel}</td>
                                <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses(recipient.status)}`}>{recipient.status.replaceAll('_', ' ')}</span></td>
                                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatDate(recipient.eventAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-600">Previous</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-600">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
