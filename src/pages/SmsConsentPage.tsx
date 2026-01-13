import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <MessageSquare className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            SMS Messaging Consent
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            This page explains how Thunderlight Media uses SMS messaging and how you can manage your preferences.
          </p>
        </header>

        <section
          id="sms-consent"
          aria-labelledby="sms-consent-heading"
          className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-gray-200 dark:border-[#243349] p-8 space-y-6"
        >
          <h2
            id="sms-consent-heading"
            className="text-2xl font-semibold text-gray-900 dark:text-white"
          >
            SMS Messaging Consent
          </h2>

          <div className="space-y-4 text-gray-700 dark:text-gray-200 leading-relaxed">
            <p>
              By providing your mobile number to Thunderlight Media through any of our forms,
              checkouts, scheduling tools, or communication channels, you give your express
              consent to receive text messages from <strong>Thunderlight Media</strong>.
            </p>

            <p>
              Messages may include project updates, account notifications, appointment reminders,
              service information, and occasional promotional or operational alerts.
              Message frequency may vary. Message and data rates may apply.
            </p>

            <p>
              You may opt out at any time by replying <strong>STOP</strong> to any message from us.
              For assistance, reply <strong>HELP</strong>. Your consent is not a condition of purchase.
            </p>

            <p>
              This public page serves as documentation of our messaging policy and the terms
              under which users provide consent. By submitting your number anywhere on our platform,
              you acknowledge this disclosure and agree to receive SMS communications from
              <strong>Thunderlight Media</strong>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
