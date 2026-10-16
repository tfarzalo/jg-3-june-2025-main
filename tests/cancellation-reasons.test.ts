import { describe, expect, it } from 'vitest';
import { extractJobCancellationReason } from '../src/lib/jobs/cancellationReasons';

describe('job cancellation reason parsing', () => {
  it('extracts a subcontractor reason and removes the trip-charge audit suffix', () => {
    expect(extractJobCancellationReason(
      'Job cancelled by subcontractor: Resident did not provide access; Cancellation Trip Charge added ($50.00 bill / $25.00 sub pay)'
    )).toBe('Resident did not provide access');
  });

  it('extracts a subcontractor reason when no trip charge was added', () => {
    expect(extractJobCancellationReason(
      'Job cancelled by subcontractor: Unit was not ready; no Cancellation Trip Charge added'
    )).toBe('Unit was not ready');
  });

  it('keeps legacy subcontractor cancellations readable', () => {
    expect(extractJobCancellationReason(
      'Job cancelled by subcontractor; Cancellation Trip Charge added ($50.00 bill / $25.00 sub pay)'
    )).toBe('No reason recorded');
  });

  it('continues to extract admin cancellation reasons', () => {
    expect(extractJobCancellationReason(
      'Job cancelled by admin: Unit still occupied; Cancellation Trip Charge added ($50.00 bill / $25.00 sub pay)'
    )).toBe('Unit still occupied');
  });
});
