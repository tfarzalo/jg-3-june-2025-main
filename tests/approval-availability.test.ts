import { describe, expect, it } from 'vitest';

// Mirrors the self-contained edge-function decision matrix. The edge function
// intentionally has no local imports because dashboard deployment bundles only
// its index.ts file.
function getApprovalUnavailableReason(input: {
  approvalType: string;
  usedAt?: string | null;
  decision?: string | null;
  invalidatedAt?: string | null;
  jobPhase?: string | null;
  hasNewerRequest: boolean;
}) {
  if (input.usedAt || input.decision) return 'completed';
  if (input.approvalType !== 'extra_charges') return 'preview';
  if (input.invalidatedAt) return 'invalidated';
  if (input.jobPhase === 'Cancelled') return 'cancelled';
  if (input.jobPhase !== 'Pending Work Order') return 'job_changed';
  if (input.hasNewerRequest) return 'superseded';
  return null;
}

const pendingRequest = {
  approvalType: 'extra_charges',
  usedAt: null,
  decision: null,
  invalidatedAt: null,
  jobPhase: 'Pending Work Order',
  hasNewerRequest: false,
};

describe('customer approval availability', () => {
  it('is actionable immediately after creation', () => {
    expect(getApprovalUnavailableReason(pendingRequest)).toBeNull();
  });

  it('remains actionable after the internal window because time is not an input', () => {
    const sixteenMinutesLater = { ...pendingRequest };
    expect(getApprovalUnavailableReason(sixteenMinutesLater)).toBeNull();
  });

  it('rejects an already approved request', () => {
    expect(getApprovalUnavailableReason({
      ...pendingRequest,
      usedAt: '2026-10-06T20:00:00Z',
      decision: 'approved',
    })).toBe('completed');
  });

  it('rejects a request for a cancelled job', () => {
    expect(getApprovalUnavailableReason({
      ...pendingRequest,
      jobPhase: 'Cancelled',
    })).toBe('cancelled');
  });

  it('rejects a superseded request', () => {
    expect(getApprovalUnavailableReason({
      ...pendingRequest,
      hasNewerRequest: true,
    })).toBe('superseded');
  });

  it('rejects a preserved but invalidated request', () => {
    expect(getApprovalUnavailableReason({
      ...pendingRequest,
      invalidatedAt: '2026-10-06T20:00:00Z',
    })).toBe('invalidated');
  });

  it('rejects a request after the job has left Pending Work Order', () => {
    expect(getApprovalUnavailableReason({
      ...pendingRequest,
      jobPhase: 'Quality Control',
    })).toBe('job_changed');
  });
});
