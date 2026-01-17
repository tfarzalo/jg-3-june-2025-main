const { formatInTimeZone, zonedTimeToUtc } = require('date-fns-tz');
const { startOfMonth, endOfMonth, addDays, startOfWeek } = require('date-fns');

console.log('Testing FINAL implementation with noon Eastern Time:');
console.log('='.repeat(80));

const TIMEZONE = 'America/New_York';

// Implementation: Create date at noon Eastern Time
const getEasternDate = () => {
  const now = new Date();
  const easternDateString = formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd');
  const easternNoon = zonedTimeToUtc(`${easternDateString} 12:00:00`, TIMEZONE);
  
  console.log('Current UTC time:', now.toISOString());
  console.log('Eastern date string:', easternDateString);
  console.log('Eastern noon as UTC:', easternNoon.toISOString());
  console.log('Back to Eastern:', formatInTimeZone(easternNoon, TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
  
  return easternNoon;
};

const currentDate = getEasternDate();
console.log('');

console.log('Testing month range calculation:');
console.log('-'.repeat(80));
const monthStart = startOfMonth(currentDate);
const monthEnd = endOfMonth(currentDate);

console.log('monthStart (UTC):', monthStart.toISOString());
console.log('monthEnd (UTC):', monthEnd.toISOString());

const start = formatInTimeZone(monthStart, TIMEZONE, 'yyyy-MM-dd');
const end = formatInTimeZone(monthEnd, TIMEZONE, 'yyyy-MM-dd');

console.log('Formatted start:', start);
console.log('Formatted end:', end);
console.log('✓ Start is 2026-01-01?', start === '2026-01-01' ? 'YES! ✓' : `NO - got ${start}`);
console.log('✓ End is 2026-01-31?', end === '2026-01-31' ? 'YES! ✓' : `NO - got ${end}`);
console.log('');

console.log('Testing calendar grid generation:');
console.log('-'.repeat(80));
const startDate = startOfWeek(monthStart);
console.log('Start of week (UTC):', startDate.toISOString());
console.log('As Eastern:', formatInTimeZone(startDate, TIMEZONE, 'yyyy-MM-dd'));

// Test specific dates
const testJobs = [
  { work_order_num: 1, scheduled_date: '2026-01-01' },
  { work_order_num: 2, scheduled_date: '2026-01-15' },
  { work_order_num: 3, scheduled_date: '2026-01-31' },
];

console.log('');
console.log('Job matching test:');
let matchCount = 0;
for (let i = 0; i < 42; i++) {
  const day = addDays(startDate, i);
  const dayStr = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
  
  const matched = testJobs.filter(job => job.scheduled_date === dayStr);
  if (matched.length > 0) {
    console.log(`${dayStr}: ✓ Matched ${matched.map(j => `WO-${j.work_order_num}`).join(', ')}`);
    matchCount++;
  }
}

console.log('');
console.log('='.repeat(80));
console.log('RESULTS:');
console.log(`✓ Matched ${matchCount} out of ${testJobs.length} test jobs`);
console.log(matchCount === testJobs.length ? '✓ ALL TESTS PASSED!' : '✗ SOME TESTS FAILED');
console.log('='.repeat(80));
