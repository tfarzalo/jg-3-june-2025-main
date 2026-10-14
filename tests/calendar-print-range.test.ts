import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendarSource = readFileSync(
  new URL('../src/components/calendar-dev-3/DevCalendar3Page.tsx', import.meta.url),
  'utf8',
);

describe('calendar print range selection', () => {
  it('opens a date-selection modal before building the print snapshot', () => {
    expect(calendarSource).toContain('onClick={openPrintRangeModal}');
    expect(calendarSource).toContain('Choose dates to print');
    expect(calendarSource).toContain('Specific date');
    expect(calendarSource).toContain('Date range');
  });

  it('constrains printing to the currently loaded calendar period', () => {
    expect(calendarSource).toContain('min={dateOnlyFromDate(visibleRange.start)}');
    expect(calendarSource).toContain('max={dateOnlyFromDate(visibleRange.end)}');
    expect(calendarSource).toContain("printRangeMode === 'single' ? printStartDate : printEndDate");
  });
});
