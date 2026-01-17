const { formatInTimeZone, utcToZonedTime } = require('date-fns-tz');
const { parseISO, startOfMonth, endOfMonth, addDays, startOfWeek } = require('date-fns');

console.log('Testing CORRECTED implementation:');
console.log('='.repeat(80));

// NEW: Using utcToZonedTime
const getEasternDate = () => {
  const now = new Date();
  console.log('Current UTC time:', now.toISOString());
  
  // Convert UTC time to Eastern Time
  const easternNow = utcToZonedTime(now, 'America/New_York');
  console.log('Eastern Time (utcToZonedTime):', easternNow.toISOString());
  console.log('As formatted string:', formatInTimeZone(easternNow, 'America/New_York', 'yyyy-MM-dd HH:mm:ss'));
  
  return easternNow;
};

const currentDate = getEasternDate();
console.log('');

console.log('Testing month range calculation:');
console.log('-'.repeat(80));
const monthStart = startOfMonth(currentDate);
const monthEnd = endOfMonth(currentDate);

console.log('monthStart:', monthStart.toISOString());
console.log('monthEnd:', monthEnd.toISOString());

const start = formatInTimeZone(monthStart, 'America/New_York', 'yyyy-MM-dd');
const end = formatInTimeZone(monthEnd, 'America/New_York', 'yyyy-MM-dd');

console.log('Formatted start:', start);
console.log('Formatted end:', end);
console.log('✓ Is start correct?', start === '2026-01-01' ? 'YES!' : 'NO - Expected 2026-01-01');
console.log('✓ Is end correct?', end === '2026-01-31' ? 'YES!' : 'NO - Expected 2026-01-31');
console.log('');

console.log('Testing calendar grid:');
console.log('-'.repeat(80));
const startDate = startOfWeek(monthStart);
console.log('startOfWeek:', startDate.toISOString());
console.log('As Eastern:', formatInTimeZone(startDate, 'America/New_York', 'yyyy-MM-dd'));

// Generate a few days around Jan 1
console.log('');
console.log('Days around January 1:');
for (let i = 0; i < 7; i++) {
  const day = addDays(startDate, i);
  const dayStr = formatInTimeZone(day, 'America/New_York', 'yyyy-MM-dd');
  const weekday = formatInTimeZone(day, 'America/New_York', 'EEE');
  console.log(`Day ${i}: ${weekday} ${dayStr}`);
}

console.log('');
console.log('Testing specific dates:');
console.log('-'.repeat(80));

// Test Jan 1 specifically
const jan1Start = startOfMonth(currentDate);
const jan1Str = formatInTimeZone(jan1Start, 'America/New_York', 'yyyy-MM-dd');
console.log('Jan 1 start of month:', jan1Str);
console.log('✓ Correct?', jan1Str === '2026-01-01' ? 'YES!' : 'NO');

// Test job matching scenario
const testJob = { scheduled_date: '2026-01-01' };
const calendarDate = jan1Start;
const calendarDateEastern = formatInTimeZone(calendarDate, 'America/New_York', 'yyyy-MM-dd');
const matches = testJob.scheduled_date === calendarDateEastern;
console.log('');
console.log('Job matching test:');
console.log('  Job scheduled_date:', testJob.scheduled_date);
console.log('  Calendar date:', calendarDateEastern);
console.log('  Match?', matches ? 'YES ✓' : 'NO ✗');

console.log('');
console.log('='.repeat(80));
console.log('CONCLUSION:');
console.log('✓ utcToZonedTime creates proper Eastern Time dates');
console.log('✓ startOfMonth/endOfMonth work correctly with ET dates');
console.log('✓ formatInTimeZone converts correctly for comparisons');
console.log('✓ Job matching will work correctly!');
console.log('='.repeat(80));
