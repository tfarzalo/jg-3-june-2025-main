import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getEmailTemplateMode, resolveEmailSendMode } from '../src/lib/emailTemplateMode';

const modalSource = readFileSync(
  new URL('../src/components/EnhancedPropertyNotificationModal.tsx', import.meta.url),
  'utf8',
);

describe('drywall notification template behavior', () => {
  it('uses the saved template type instead of inferring approval from charges or trigger phase', () => {
    expect(modalSource).toContain("const isApprovalEmail = sendMode === 'approval';");
    expect(modalSource).not.toContain("triggerPhase.includes('extra_charges')");
    expect(modalSource).not.toContain('|| hasApprovalRequiredExtraCharges;');
  });

  it('loads notification recipients for drywall sends', () => {
    expect(modalSource).toContain('initializeRecipient(sendMode)');
  });

  it('warns when a notification-only template is selected for a job with charges', () => {
    expect(modalSource).toContain('notificationHasApprovalRequiredCharges');
    expect(modalSource).toContain('This job includes extra charges, and the selected email template is notification-only.');
    expect(modalSource).toContain('This email will not include an approval request or approval link.');
    expect(modalSource).not.toContain('Send a separate Extra Charges approval request');
  });

  it('keeps builder template types authoritative in every launch context', () => {
    expect(getEmailTemplateMode('approval')).toBe('approval');
    expect(getEmailTemplateMode(' notification ')).toBe('notification');
    expect(resolveEmailSendMode('sprinkler_paint', 'notification')).toBe('notification');
    expect(resolveEmailSendMode('drywall_repairs', 'notification')).toBe('notification');
    expect(resolveEmailSendMode('sprinkler_paint', 'approval')).toBe('approval');
    expect(resolveEmailSendMode('extra_charges', 'notification')).toBe('notification');
    expect(resolveEmailSendMode('extra_charges', 'approval')).toBe('approval');
  });

  it('classifies outbound email from the resolved template mode', () => {
    expect(modalSource).toContain("emailType: isApprovalEmail");
    expect(modalSource).not.toContain("emailType: effectiveNotificationType === 'extra_charges'");
  });

  it('uses the launch context only until a template is selected', () => {
    expect(resolveEmailSendMode('extra_charges')).toBe('approval');
    expect(resolveEmailSendMode('drywall_repairs')).toBe('notification');
  });
});
