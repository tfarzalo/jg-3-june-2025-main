import { describe, expect, it } from 'vitest';
import {
  assignmentStatusPresentation,
  notificationStatusPresentation,
} from '../src/components/calendar-dev-3/calendarStatus';

describe('calendar assignment and delivery status presentation', () => {
  it('keeps subcontractor acceptance independent from email delivery', () => {
    expect(assignmentStatusPresentation('pending')?.label).toBe('Pending Acceptance');
    expect(notificationStatusPresentation('pending')?.label).toBe('Not sent — marked to send later');
  });

  it('only presents a sent notification as sent', () => {
    expect(notificationStatusPresentation('sent')?.shortLabel).toBe('Sent');
    expect(notificationStatusPresentation('processing')?.shortLabel).toBe('Sending');
    expect(notificationStatusPresentation('failed')?.shortLabel).toBe('Failed');
  });

  it('preserves accepted and declined assignment outcomes', () => {
    expect(assignmentStatusPresentation('accepted')?.label).toBe('Accepted');
    expect(assignmentStatusPresentation('declined')?.label).toBe('Declined');
  });

  it('does not invent a status when no authoritative value exists', () => {
    expect(assignmentStatusPresentation(null)).toBeNull();
    expect(notificationStatusPresentation(null)).toBeNull();
  });

  it('does not show pending acceptance for an unassigned job', () => {
    expect(assignmentStatusPresentation('pending', null)).toBeNull();
    expect(assignmentStatusPresentation('pending', 'subcontractor-id')?.label).toBe('Pending Acceptance');
  });
});
