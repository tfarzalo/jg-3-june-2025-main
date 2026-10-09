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
  manualApprovalRecorded: boolean;
}) {
  if (input.usedAt || input.decision) return 'completed';
  if (input.approvalType !== 'extra_charges') return 'preview';
  if (input.invalidatedAt) return 'invalidated';
  if (input.hasNewerRequest) return 'superseded';
  if (input.jobPhase === 'Cancelled') return 'cancelled';
  if (input.manualApprovalRecorded) return 'manually_approved';
  if (input.jobPhase !== 'Pending Work Order') return 'job_changed';
  return null;
}

function getDecisionSource(input: {
  hasDecision: boolean;
  manualApprovalEventInCurrentCycle: boolean;
  latestChangeIsManualApproval: boolean;
}) {
  const manualApprovalRecorded = input.hasDecision
    ? input.manualApprovalEventInCurrentCycle
    : input.latestChangeIsManualApproval;
  return manualApprovalRecorded ? 'internal_manual' : 'approval_link';
}

const pendingRequest = {
  approvalType: 'extra_charges',
  usedAt: null,
  decision: null,
  invalidatedAt: null,
  jobPhase: 'Pending Work Order',
  hasNewerRequest: false,
  manualApprovalRecorded: false,
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

  it('identifies an undecided request moved manually into Work Order', () => {
    expect(getApprovalUnavailableReason({
      ...pendingRequest,
      jobPhase: 'Work Order',
      manualApprovalRecorded: true,
    })).toBe('manually_approved');
  });

  it('does not label a direct phase bypass as an internal manual approval', () => {
    expect(getApprovalUnavailableReason({
      ...pendingRequest,
      jobPhase: 'Work Order',
      manualApprovalRecorded: false,
    })).toBe('job_changed');
  });
});

describe('approval decision source', () => {
  it('treats a completed approval-link response as external even when identity was entered', () => {
    expect(getDecisionSource({
      hasDecision: true,
      manualApprovalEventInCurrentCycle: false,
      latestChangeIsManualApproval: false,
    })).toBe('approval_link');
  });

  it('classifies a completed admin approval from its current-cycle manual audit event', () => {
    expect(getDecisionSource({
      hasDecision: true,
      manualApprovalEventInCurrentCycle: true,
      latestChangeIsManualApproval: true,
    })).toBe('internal_manual');
  });

  it('does not let a manual event from an older approval cycle relabel a later response', () => {
    expect(getDecisionSource({
      hasDecision: true,
      manualApprovalEventInCurrentCycle: false,
      latestChangeIsManualApproval: true,
    })).toBe('approval_link');
  });
});
