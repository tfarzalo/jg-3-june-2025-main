import { describe, expect, it } from 'vitest';
import { latestApprovalStatuses } from '../src/lib/approvals/approvalStatus';

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
});
