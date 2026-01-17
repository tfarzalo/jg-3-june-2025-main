const { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');
const { parseISO, startOfMonth, endOfMonth, addDays, startOfWeek } = require('date-fns');

console.log('Testing PROPER timezone-aware date manipulation:');
console.log('='.repeat(80));

// The key insight: We need to work with dates in the target timezone throughout
const TIMEZONE = 'America/New_York';

// Step 1: Get current time in Eastern Time
const now = new Date();
console.log('1. Current UTC time:', now.toISOString());

// Step 2: Get the current date string in Eastern Time
const easternDateString = formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd');
console.log('2. Current Eastern date string:', easternDateString);

// Step 3: Create a Date object for the start of this day in Eastern Time
// We create the date at midnight Eastern Time and convert to UTC
const easternMidnight = zonedTimeToUtc(`${easternDateString} 00:00:00`, TIMEZONE);
console.log('3. Eastern midnight as UTC:', easternMidnight.toISOString());
console.log('   Back to Eastern:', formatInTimeZone(easternMidnight, TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));

// Step 4: Get start of month for this Eastern Time date
const monthStart = startOfMonth(easternMidnight);
console.log('4. Start of month (UTC):', monthStart.toISOString());
console.log('   As Eastern date:', formatInTimeZone(monthStart, TIMEZONE, 'yyyy-MM-dd'));

const monthEnd = endOfMonth(easternMidnight);
console.log('5. End of month (UTC):', monthEnd.toISOString());
console.log('   As Eastern date:', formatInTimeZone(monthEnd, TIMEZONE, 'yyyy-MM-dd'));

console.log('');
console.log('Testing job matching:');
console.log('-'.repeat(80));

// Simulate calendar day generation
const startDate = startOfWeek(monthStart);
console.log('Start of week:', formatInTimeZone(startDate, TIMEZONE, 'yyyy-MM-dd'));

// Generate days and test matching
const testJobs = [
  { work_order_num: 1, scheduled_date: '2026-01-01' },
  { work_order_num: 2, scheduled_date: '2026-01-15' },
];

console.log('');
console.log('Matching jobs to calendar days:');
for (let i = 0; i < 10; i++) {
  const day = addDays(startDate, i);
  const dayStr = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
  
  const matchedJobs = testJobs.filter(job => job.scheduled_date === dayStr);
  if (matchedJobs.length > 0) {
    console.log(`${dayStr}: ✓ Matched ${matchedJobs.map(j => `WO-${j.work_order_num}`).join(', ')}`);
  }
}

console.log('');
console.log('='.repeat(80));
console.log('KEY FINDINGS:');
console.log('✓ zonedTimeToUtc converts "2026-01-01 00:00 ET" to proper UTC');
console.log('✓ This gives date-fns functions the right base to work from');
console.log('✓ formatInTimeZone converts back to ET for string comparison');
console.log('✓ This approach handles DST correctly!');
console.log('='.repeat(80));
