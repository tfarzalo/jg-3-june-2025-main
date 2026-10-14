import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const approvalPageSource = readFileSync(
  new URL('../src/pages/ApprovalPage.tsx', import.meta.url),
  'utf8',
);

const jobDetailsSource = readFileSync(
  new URL('../src/components/JobDetails.tsx', import.meta.url),
  'utf8',
);

describe('approval UI continuity', () => {
  it('offers approval at the top and bottom only while the public request is actionable', () => {
    expect(approvalPageSource.match(/Approve Extra Charges - \$\{/g)).toHaveLength(2);
    expect(approvalPageSource).toContain('{!isReadOnly && (');
    expect(approvalPageSource).toContain("setPendingAction('approve')");
    expect(approvalPageSource).toContain("setShowApproverForm(true)");
  });

  it('keeps the approval page available after an unanswered job leaves Pending Work Order', () => {
    expect(jobDetailsSource).toContain("const interruptedApprovalWithLink = interruptedApproval && Boolean(latestApprovalPageToken)");
    expect(jobDetailsSource).toContain("'Approval Process Interrupted'");
    expect(jobDetailsSource).toContain('The original approval page remains available as a view-only record.');
    expect(jobDetailsSource).toContain('(needsExtraChargesApproval || interruptedApprovalWithLink) && latestApprovalPageToken');
  });

  it('explains when the job advanced without any approval request', () => {
    expect(jobDetailsSource).toContain("'Approval Process Bypassed'");
    expect(jobDetailsSource).toContain('without a customer approval link being sent and without a manual approval being recorded.');
  });
});
