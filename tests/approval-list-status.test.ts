import { describe, expect, it } from 'vitest';
import {
  latestApprovalStatuses,
  legacyExtraChargeDecisionFromReason,
} from '../src/lib/approvals/approvalStatus';

describe('pending work order approval status', () => {
  it('uses the newest request as the authoritative status', () => {
    expect(latestApprovalStatuses([
      { job_id: 'job-1', decision: 'declined', created_at: '2026-10-01T00:00:00Z' },
      { job_id: 'job-1', decision: null, created_at: '2026-10-02T00:00:00Z' },
    ])).toEqual({ 'job-1': 'sent' });
  });

  it('distinguishes failed delivery, approval, and high-priority decline', () => {
    expect(latestApprovalStatuses([
      { job_id: 'not-sent', decision: null, invalidated_at: '2026-10-02T00:01:00Z', created_at: '2026-10-02T00:00:00Z' },
      { job_id: 'approved', decision: 'approved', created_at: '2026-10-02T00:00:00Z' },
      { job_id: 'declined', decision: 'declined', created_at: '2026-10-02T00:00:00Z' },
    ])).toEqual({
      'not-sent': 'not_sent',
      approved: 'approved',
      declined: 'declined',
    });
  });

  it('requires a new notice when a completed approval was superseded by changed charges', () => {
    expect(latestApprovalStatuses([
      {
        job_id: 'changed-after-approval',
        decision: 'approved',
        invalidated_at: '2026-10-08T20:00:00Z',
        created_at: '2026-10-08T19:00:00Z',
      },
    ])).toEqual({ 'changed-after-approval': 'not_sent' });
  });

  it('labels a customer-facing charge modification explicitly', () => {
    expect(latestApprovalStatuses([
      {
        job_id: 'modified',
        decision: 'approved',
        invalidated_at: '2026-10-08T20:00:00Z',
        invalidation_reason: 'extra_charge_details_changed',
        created_at: '2026-10-08T19:00:00Z',
      },
    ])).toEqual({ modified: 'modified' });
  });
});

describe('legacy extra-charge phase-history decisions', () => {
  it('does not treat first-charge pending workflow language as approved', () => {
    expect(legacyExtraChargeDecisionFromReason(
      'Customer-billable extra charges were added - job moved to Pending Work Order for approval',
    )).toBeNull();
  });

  it.each([
    'Extra charges approval required',
    'Extra charges approval email sent to manager@example.com',
    'Extra charges were modified after an approval request',
  ])('does not infer a decision from %s', (reason) => {
    expect(legacyExtraChargeDecisionFromReason(reason)).toBeNull();
  });

  it('recognizes only explicit legacy approval and decline decisions', () => {
    expect(legacyExtraChargeDecisionFromReason(
      'Extra charges approved manually by Office Admin - job advanced to Work Order',
    )).toBe('approved');
    expect(legacyExtraChargeDecisionFromReason(
      'Extra charges declined by Property Manager. Reason: Not authorized',
    )).toBe('declined');
    expect(legacyExtraChargeDecisionFromReason(
      'Extra charges rejected by Property Manager',
    )).toBe('declined');
  });
});
