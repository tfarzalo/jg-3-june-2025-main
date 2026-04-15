import React from 'react';
import { MessageSquare, MapPin, Phone, Mail, ShieldCheck, BellOff, Info, CheckCircle2 } from 'lucide-react';

const CONSENT_VERSION = 'v1.0';
const EFFECTIVE_DATE  = 'April 14, 2026';

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ── Header ── */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
            <MessageSquare className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            SMS Messaging Consent &amp; Policy
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Policy version {CONSENT_VERSION} &nbsp;·&nbsp; Effective {EFFECTIVE_DATE}
          </p>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto text-base leading-relaxed">
            This page describes how <strong>JG Painting Pros, Inc.</strong> uses SMS text messaging
            to communicate with team members and subcontractors, and explains your rights and choices
            regarding those messages.
          </p>
        </header>

        {/* ── Business Info ── */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 flex flex-col sm:flex-row gap-6">
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Business</p>
            <p className="text-gray-900 dark:text-white font-semibold text-lg">JG Painting Pros, Inc.</p>
            <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
              <span>21444 Country Club Drive<br />Cornelius, NC 28031</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Contact</p>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm">
              <Phone className="h-4 w-4 flex-shrink-0 text-blue-500" />
              <span>Available via app messaging</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm">
              <Mail className="h-4 w-4 flex-shrink-0 text-blue-500" />
              <span>admin@jgpaintingprosinc.com</span>
            </div>
          </div>
        </div>

        {/* ── Who We Message ── */}
        <section className="bg-white dark:bg-[#1E293B] rounded-2xl shadow border border-gray-200 dark:border-[#243349] p-8 space-y-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Who We Message</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            JG Painting Pros, Inc. sends SMS notifications exclusively to <strong>registered team members and
            subcontractors</strong> who have created an account within our internal job-management platform
            and have explicitly provided a mobile number for SMS notifications.
          </p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            We do <strong>not</strong> send marketing messages to the general public. All messages are
            operational in nature and directly related to job assignments, work orders, scheduling, and
            internal workflow communications.
          </p>
        </section>

        {/* ── Message Types ── */}
        <section className="bg-white dark:bg-[#1E293B] rounded-2xl shadow border border-gray-200 dark:border-[#243349] p-8 space-y-5">
          <div className="flex items-center gap-3">
            <Info className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Types of Messages We Send</h2>
          </div>
          <ul className="space-y-3">
            {[
              { label: 'Job Assignments', desc: 'Notification when a new job has been assigned to you.' },
              { label: 'Job Acceptances', desc: 'Confirmation when a subcontractor accepts an assigned job.' },
              { label: 'Work Order Submissions', desc: 'Alert when a work order is submitted for a job you manage.' },
              { label: 'Charge Approvals',  desc: 'Notification when charges on a job are approved.' },
              { label: 'New Chat Messages', desc: 'Alert when you receive a new in-app chat message.' },
            ].map(({ label, desc }) => (
              <li key={label} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-gray-300 text-sm">
                  <strong>{label}:</strong> {desc}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-gray-500 dark:text-gray-400 text-sm border-t border-gray-100 dark:border-gray-700 pt-4">
            Message frequency varies based on job activity. Standard message and data rates may apply
            depending on your mobile carrier plan.
          </p>
        </section>

        {/* ── Consent Statement ── */}
        <section className="bg-white dark:bg-[#1E293B] rounded-2xl shadow border border-gray-200 dark:border-[#243349] p-8 space-y-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Express Written Consent</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            By entering your mobile phone number in the <strong>SMS Phone</strong> field within your
            user profile on the JG Painting Pros platform and checking the consent box, you provide
            your <strong>express written consent</strong> to receive automated and non-automated SMS
            text messages from JG Painting Pros, Inc. at the number provided.
          </p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Your consent is entirely voluntary. <strong>Consent is not a condition of employment,
            contract, or any other business relationship.</strong> You may use the platform normally
            without providing SMS consent; however, you will not receive SMS job notifications.
          </p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            By accepting consent you confirm that you are the account holder or have the authority
            to authorize messages to the provided number, and that you are 18 years of age or older.
          </p>
        </section>

        {/* ── Opt Out ── */}
        <section className="bg-white dark:bg-[#1E293B] rounded-2xl shadow border border-gray-200 dark:border-[#243349] p-8 space-y-5">
          <div className="flex items-center gap-3">
            <BellOff className="h-6 w-6 text-orange-500 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">How to Opt Out</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            You may withdraw your consent and stop receiving SMS messages at any time using
            any of the following methods:
          </p>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
            <li className="flex items-start gap-2">
              <span className="font-bold text-orange-500 mt-0.5">·</span>
              Reply <strong>STOP</strong> to any SMS message you receive from us.
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-orange-500 mt-0.5">·</span>
              Notify JG Painting Pros, Inc. management to remove your phone number from the SMS communications list.
            </li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
            After opting out, you may receive one final confirmation message. For help, reply
            <strong> HELP</strong> to any message or contact us at admin@jgpaintingprosinc.com.
          </p>
        </section>

        {/* ── Privacy ── */}
        <section className="bg-white dark:bg-[#1E293B] rounded-2xl shadow border border-gray-200 dark:border-[#243349] p-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Privacy & Data Use</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
            Your mobile phone number is stored securely and used solely for the purpose of sending
            operational SMS notifications described on this page. We do not sell, rent, share, or
            transfer your mobile number to third parties for marketing purposes. Your number may
            be shared with our SMS delivery provider (Twilio, Inc.) solely to facilitate message
            delivery on our behalf.
          </p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
            We retain a record of your consent (including date, time, and consent version) for
            compliance purposes in accordance with the Telephone Consumer Protection Act (TCPA).
          </p>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center text-xs text-gray-400 dark:text-gray-500 space-y-1 pb-4">
          <p>JG Painting Pros, Inc. &nbsp;·&nbsp; 21444 Country Club Drive, Cornelius, NC 28031</p>
          <p>Policy version {CONSENT_VERSION} &nbsp;·&nbsp; Effective {EFFECTIVE_DATE}</p>
          <p>
            Questions? Contact us at{' '}
            <a href="mailto:admin@jgpaintingprosinc.com" className="underline hover:text-blue-500">
              admin@jgpaintingprosinc.com
            </a>
          </p>
        </footer>

      </div>
    </div>
  );
}
