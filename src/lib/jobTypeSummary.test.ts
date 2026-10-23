import { describe, expect, it } from 'vitest';
import { getJobTypeLabel, summarizeJobTypes } from './jobTypeSummary';

describe('job type summaries', () => {
  it('counts Clean alongside the existing job types', () => {
    const jobs = [
      { job_type: { job_type_label: 'Paint' } },
      { job_type: [{ job_type_label: 'Clean' }] },
      { job_type: { job_type_label: 'Callback' } },
      { job_type: { job_type_label: 'Repair' } },
    ];

    expect(summarizeJobTypes(jobs)).toEqual({
      paint: 1,
      clean: 1,
      callback: 1,
      repair: 1,
      other: 0,
      total: 4,
    });
  });

  it('keeps unknown and future job types in the total without calling them Paint', () => {
    const jobs = [
      { job_type: { job_type_label: 'Future Type' } },
      { job_type: null },
    ];

    expect(summarizeJobTypes(jobs)).toMatchObject({ paint: 0, other: 2, total: 2 });
    expect(getJobTypeLabel(jobs[1])).toBe('Unknown');
  });

  it('normalizes label casing and whitespace for counts', () => {
    expect(summarizeJobTypes([
      { job_type: { job_type_label: ' clean ' } },
      { job_type: { job_type_label: 'PAINT' } },
    ])).toMatchObject({ clean: 1, paint: 1, total: 2 });
  });
});
