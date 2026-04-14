/**
 * Unit tests for supabase/functions/_shared/smsTemplates.ts
 *
 * Tests cover:
 *   - buildSmsTemplateData: normalization from all input combinations
 *   - renderSmsTemplate: output for each event type
 *   - Fallback behavior when payload data is missing
 *   - Dynamic content when work order number and property name are present
 *   - No malformed strings from partial payloads
 *   - Each event type generates the expected style of message
 *
 * Run with:  npx vitest run tests/smsTemplates.test.ts
 *
 * Note: This test file imports directly from the TypeScript source.
 * The functions do not depend on Deno — they are pure functions safe
 * to test in Node/Vitest.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSmsTemplateData,
  renderSmsTemplate,
  formatSmsDate,
  type RawJobContext,
  type RawWorkOrderContext,
  type SmsEventType,
} from '../supabase/functions/_shared/smsTemplates';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fullJobCtx: RawJobContext = {
  work_order_num:      1234,
  unit_number:         '12B',
  property_name:       'Oak Ridge Apartments',
  property_address:    '100 Oak Ridge Dr',
  job_type:            'Interior Paint',
  scheduled_date:      '2026-05-10T09:00:00.000Z',
  assigned_to_name:    'Maria Garcia',
  assignment_deadline: '2026-05-03T17:00:00.000Z',
};

const fullWoCtx: RawWorkOrderContext = {
  work_order_num: 5678,
  unit_number:    '3A',
  property_name:  'Sunrise Commons',
  bill_amount:    350.00,
};

const recipientName = 'James Taylor';
const senderName    = 'Carlos Mendez';

// ─── buildSmsTemplateData ─────────────────────────────────────────────────────

describe('buildSmsTemplateData', () => {
  it('normalises full job context correctly', () => {
    const data = buildSmsTemplateData(fullJobCtx, null, senderName, {}, recipientName);
    expect(data.workOrderLabel).toBe('WO-001234');
    expect(data.workOrderNum).toBe(1234);
    expect(data.propertyName).toBe('Oak Ridge Apartments');
    expect(data.unitNumber).toBe('12B');
    expect(data.recipientName).toBe('James'); // first name only
    expect(data.subcontractorName).toBe(senderName);
    expect(data.scheduledDate).toBeTruthy(); // formatted date string
    expect(data.assignmentDeadline).toBeTruthy();
    expect(data.isMultiJob).toBe(false);
    expect(data.jobCount).toBe(1);
  });

  it('normalises full work order context correctly', () => {
    const data = buildSmsTemplateData(null, fullWoCtx, null, {}, recipientName);
    expect(data.workOrderLabel).toBe('WO-005678');
    expect(data.propertyName).toBe('Sunrise Commons');
    expect(data.unitNumber).toBe('3A');
    expect(data.chargeAmount).toBe('$350.00');
  });

  it('prefers DB job context over caller context for work order number', () => {
    const data = buildSmsTemplateData(
      fullJobCtx,
      null,
      null,
      { workOrderNum: 9999 },
      null
    );
    expect(data.workOrderNum).toBe(1234); // DB wins
    expect(data.workOrderLabel).toBe('WO-001234');
  });

  it('falls back to callerCtx.workOrderNum when no DB context', () => {
    const data = buildSmsTemplateData(null, null, null, { workOrderNum: 42 }, null);
    expect(data.workOrderNum).toBe(42);
    expect(data.workOrderLabel).toBe('WO-000042');
  });

  it('falls back to first element of callerCtx.workOrderNums[]', () => {
    const data = buildSmsTemplateData(null, null, null, { workOrderNums: [100, 200] }, null);
    expect(data.workOrderNum).toBe(100);
    expect(data.workOrderLabel).toBe('WO-000100');
  });

  it('detects multi-job from jobCount in callerCtx', () => {
    const data = buildSmsTemplateData(null, null, null, { jobCount: 3 }, null);
    expect(data.isMultiJob).toBe(true);
    expect(data.jobCount).toBe(3);
  });

  it('detects multi-job from jobIds array length', () => {
    const data = buildSmsTemplateData(null, null, null, { jobIds: ['a', 'b', 'c'] }, null);
    expect(data.isMultiJob).toBe(true);
    expect(data.jobCount).toBe(3);
  });

  it('returns null for all fields when all inputs are null', () => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    expect(data.recipientName).toBeNull();
    expect(data.subcontractorName).toBeNull();
    expect(data.workOrderLabel).toBeNull();
    expect(data.workOrderNum).toBeNull();
    expect(data.propertyName).toBeNull();
    expect(data.unitNumber).toBeNull();
    expect(data.chargeAmount).toBeNull();
    expect(data.isMultiJob).toBe(false);
    expect(data.jobCount).toBe(1);
  });

  it('extracts first name from "John Smith"', () => {
    const data = buildSmsTemplateData(null, null, null, {}, 'John Smith');
    expect(data.recipientName).toBe('John');
  });

  it('uses full name when no space (single name)', () => {
    const data = buildSmsTemplateData(null, null, null, {}, 'Prince');
    expect(data.recipientName).toBe('Prince');
  });

  it('resolves senderName from callerCtx.subcontractorName when senderName is null', () => {
    const data = buildSmsTemplateData(null, null, null, { subcontractorName: 'Bob Jones' }, null);
    expect(data.subcontractorName).toBe('Bob Jones');
  });

  it('resolves senderName from callerCtx.submittedByUserId context key', () => {
    // submittedByUserId lookup is async (needs DB) — test the sync fallback path
    const data = buildSmsTemplateData(null, null, null, { submitterName: 'Ana Ruiz' }, null);
    expect(data.subcontractorName).toBe('Ana Ruiz');
  });
});

// ─── renderSmsTemplate ────────────────────────────────────────────────────────

describe('renderSmsTemplate — chat_received', () => {
  it('includes sender name and greeting when both present', () => {
    const data = buildSmsTemplateData(null, null, 'Alice Brown', {}, 'Bob Smith');
    const msg  = renderSmsTemplate('chat_received', data);
    expect(msg).toContain('Bob,');
    expect(msg).toContain('Alice Brown');
    expect(msg).toContain('sent you a message');
    expect(msg).toContain('JG Painting:');
  });

  it('falls back gracefully when no sender or recipient name', () => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate('chat_received', data);
    expect(msg).toContain('Someone');
    expect(msg).toContain('sent you a message');
    expect(msg).not.toMatch(/,\s*,/); // no double commas
  });

  it('produces no double spaces or malformed punctuation', () => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate('chat_received', data);
    expect(msg).not.toMatch(/\s{2,}/);
    expect(msg).not.toMatch(/\s[.,]/);
  });
});

describe('renderSmsTemplate — job_assigned', () => {
  it('includes recipient name, WO label, property, unit when all present', () => {
    const data = buildSmsTemplateData(fullJobCtx, null, null, {}, recipientName);
    const msg  = renderSmsTemplate('job_assigned', data);
    expect(msg).toContain('James,');
    expect(msg).toContain('WO-001234');
    expect(msg).toContain('Oak Ridge Apartments');
    expect(msg).toContain('Unit 12B');
    expect(msg).toContain('Log in to accept');
  });

  it('falls back to generic text when no context', () => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate('job_assigned', data);
    expect(msg).toContain('been assigned');
    expect(msg).toContain('a new job');
    expect(msg).toContain('a property');
    expect(msg).not.toMatch(/undefined/i);
    expect(msg).not.toMatch(/null/i);
  });

  it('uses multi-job phrasing when jobCount > 1', () => {
    const data = buildSmsTemplateData(null, null, null, { jobCount: 3, workOrderNums: [1, 2, 3] }, 'Maria Lopez');
    const msg  = renderSmsTemplate('job_assigned', data);
    expect(msg).toContain('3 jobs');
    expect(msg).toContain('review and accept');
  });

  it('includes deadline when available', () => {
    const data = buildSmsTemplateData(fullJobCtx, null, null, {}, null);
    const msg  = renderSmsTemplate('job_assigned', data);
    expect(msg).toContain('Respond by');
  });

  it('omits deadline section when not available', () => {
    const ctxNoDeadline: RawJobContext = { ...fullJobCtx, assignment_deadline: null };
    const data = buildSmsTemplateData(ctxNoDeadline, null, null, {}, null);
    const msg  = renderSmsTemplate('job_assigned', data);
    expect(msg).not.toContain('Respond by');
  });

  it('produces no double spaces or malformed punctuation', () => {
    const data = buildSmsTemplateData(fullJobCtx, null, null, {}, recipientName);
    const msg  = renderSmsTemplate('job_assigned', data);
    expect(msg).not.toMatch(/\s{2,}/);
    expect(msg).not.toMatch(/\s[.,]/);
  });
});

describe('renderSmsTemplate — job_accepted', () => {
  it('includes sub name, WO label, and property', () => {
    const data = buildSmsTemplateData(
      fullJobCtx,
      null,
      senderName,
      { subcontractorName: senderName },
      recipientName
    );
    const msg = renderSmsTemplate('job_accepted', data);
    expect(msg).toContain(senderName);
    expect(msg).toContain('WO-001234');
    expect(msg).toContain('Oak Ridge Apartments');
    expect(msg).toContain('accepted');
  });

  it('falls back to "A subcontractor" when no sub name', () => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate('job_accepted', data);
    expect(msg).toContain('A subcontractor');
    expect(msg).toContain('accepted');
    expect(msg).not.toMatch(/undefined/i);
  });

  it('uses callerCtx.subcontractorName as sub name', () => {
    const data = buildSmsTemplateData(null, null, null, { subcontractorName: 'Dana Lee' }, null);
    const msg  = renderSmsTemplate('job_accepted', data);
    expect(msg).toContain('Dana Lee');
  });
});

describe('renderSmsTemplate — work_order_submitted', () => {
  it('includes sub name, WO label, property from DB context', () => {
    const data = buildSmsTemplateData(
      { work_order_num: 777, property_name: 'Maple Heights', unit_number: '4C' },
      null,
      'Tony Reyes',
      {},
      recipientName
    );
    const msg = renderSmsTemplate('work_order_submitted', data);
    expect(msg).toContain('Tony Reyes');
    expect(msg).toContain('WO-000777');
    expect(msg).toContain('Maple Heights');
    expect(msg).toContain('Unit 4C');
    expect(msg).toContain('Review in the app');
  });

  it('includes bill amount when present', () => {
    const data = buildSmsTemplateData(null, fullWoCtx, 'Sue Park', {}, null);
    const msg  = renderSmsTemplate('work_order_submitted', data);
    expect(msg).toContain('$350.00');
  });

  it('falls back gracefully when no context', () => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate('work_order_submitted', data);
    expect(msg).toContain('A subcontractor');
    expect(msg).toContain('a work order');
    expect(msg).not.toMatch(/undefined/i);
    expect(msg).not.toMatch(/null/i);
  });

  it('resolves sub name from callerCtx.submittedByUserId path via subcontractorName fallback', () => {
    const data = buildSmsTemplateData(null, null, null, { subcontractorName: 'Kim Cho' }, null);
    const msg  = renderSmsTemplate('work_order_submitted', data);
    expect(msg).toContain('Kim Cho');
  });
});

describe('renderSmsTemplate — charges_approved', () => {
  it('includes recipient first name, amount, WO label, and property', () => {
    const data = buildSmsTemplateData(
      fullJobCtx,
      null,
      null,
      { extraChargesTotal: 250 },
      recipientName
    );
    const msg = renderSmsTemplate('charges_approved', data);
    expect(msg).toContain("James, your");
    expect(msg).toContain('($250.00)');
    expect(msg).toContain('WO-001234');
    expect(msg).toContain('Oak Ridge Apartments');
    expect(msg).toContain('approved');
    expect(msg).toContain('You may proceed');
  });

  it('uses "Your" fallback when no recipient name', () => {
    const data = buildSmsTemplateData(fullJobCtx, null, null, {}, null);
    const msg  = renderSmsTemplate('charges_approved', data);
    expect(msg).toMatch(/^JG Painting: Your/);
  });

  it('omits amount when not provided', () => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate('charges_approved', data);
    expect(msg).not.toContain('$');
    expect(msg).toContain('approved');
  });

  it('falls back gracefully when no context', () => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate('charges_approved', data);
    expect(msg).toContain('approved');
    expect(msg).toContain('You may proceed');
    expect(msg).not.toMatch(/undefined/i);
    expect(msg).not.toMatch(/null/i);
  });
});

// ─── Message hygiene ──────────────────────────────────────────────────────────

describe('message hygiene', () => {
  const events: SmsEventType[] = [
    'chat_received',
    'job_assigned',
    'job_accepted',
    'work_order_submitted',
    'charges_approved',
  ];

  it.each(events)('%s: no double spaces with full context', (event) => {
    const data = buildSmsTemplateData(fullJobCtx, fullWoCtx, senderName, {
      subcontractorName: senderName,
      extraChargesTotal: 100,
      senderName,
    }, recipientName);
    const msg = renderSmsTemplate(event, data);
    expect(msg).not.toMatch(/\s{2,}/);
  });

  it.each(events)('%s: no double spaces with empty context', (event) => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate(event, data);
    expect(msg).not.toMatch(/\s{2,}/);
  });

  it.each(events)('%s: always starts with "JG Painting:"', (event) => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate(event, data);
    expect(msg.startsWith('JG Painting:')).toBe(true);
  });

  it.each(events)('%s: stays within 320 chars', (event) => {
    const data = buildSmsTemplateData(fullJobCtx, fullWoCtx, senderName, {
      subcontractorName: senderName,
      extraChargesTotal: 500,
    }, recipientName);
    const msg = renderSmsTemplate(event, data);
    expect(msg.length).toBeLessThanOrEqual(320);
  });

  it.each(events)('%s: no "undefined" or "null" in output', (event) => {
    const data = buildSmsTemplateData(null, null, null, {}, null);
    const msg  = renderSmsTemplate(event, data);
    expect(msg).not.toMatch(/\bundefined\b/i);
    expect(msg).not.toMatch(/\bnull\b/i);
  });
});

// ─── formatSmsDate ────────────────────────────────────────────────────────────

describe('formatSmsDate', () => {
  it('returns null for null input', () => {
    expect(formatSmsDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(formatSmsDate(undefined)).toBeNull();
  });

  it('formats a valid ISO date', () => {
    const result = formatSmsDate('2026-05-10T09:00:00.000Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
