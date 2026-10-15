import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modalSource = readFileSync(
  new URL('../src/components/EnhancedPropertyNotificationModal.tsx', import.meta.url),
  'utf8',
);

describe('drywall notification template behavior', () => {
  it('uses the saved template type instead of inferring approval from charges or trigger phase', () => {
    expect(modalSource).toContain("return templateType === 'approval';");
    expect(modalSource).toContain(
      "const isApprovalEmail = notificationType === 'extra_charges' || isSelectedApprovalTemplate;",
    );
    expect(modalSource).not.toContain("triggerPhase.includes('extra_charges')");
    expect(modalSource).not.toContain('|| hasApprovalRequiredExtraCharges;');
  });

  it('loads notification recipients for drywall sends', () => {
    expect(modalSource).toContain("const mode = notificationType === 'extra_charges'");
  });

  it('warns when a notification-only template is selected for a job with charges', () => {
    expect(modalSource).toContain('notificationHasApprovalRequiredCharges');
    expect(modalSource).toContain('This job includes extra charges, and the selected email template is notification-only.');
    expect(modalSource).toContain('This email will not include an approval request or approval link.');
    expect(modalSource).not.toContain('Send a separate Extra Charges approval request');
  });
});
