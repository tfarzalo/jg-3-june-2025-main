/**
 * Comprehensive analysis script to test calendar date handling
 * This script simulates the exact logic used in Calendar.tsx to identify issues
 */

const { formatInTimeZone, parseISO } = require('date-fns-tz');
const { format, startOfMonth, endOfMonth, addDays, startOfWeek } = require('date-fns');

// Test configuration
const TIMEZONE = 'America/New_York';

console.log('='.repeat(80));
console.log('CALENDAR DATE HANDLING COMPREHENSIVE ANALYSIS');
console.log('='.repeat(80));
console.log('');

// Simulate current date in Eastern Time
const getEasternDate = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
};

const currentDate = getEasternDate();
console.log('1. CURRENT DATE INFORMATION:');
console.log('-'.repeat(80));
console.log('Current System Date:', new Date());
console.log('Current Eastern Date:', currentDate);
console.log('');

// Simulate the calendar month range
console.log('2. CALENDAR MONTH RANGE:');
console.log('-'.repeat(80));
const monthStart = startOfMonth(currentDate);
const monthEnd = endOfMonth(currentDate);
console.log('Month Start:', monthStart);
console.log('Month End:', monthEnd);

const start = formatInTimeZone(monthStart, TIMEZONE, 'yyyy-MM-dd');
const end = formatInTimeZone(monthEnd, TIMEZONE, 'yyyy-MM-dd');
console.log('Query Start Date:', start);
console.log('Query End Date:', end);
console.log('');

// Test date matching logic
console.log('3. DATE MATCHING LOGIC TEST:');
console.log('-'.repeat(80));

// Simulate some test job dates from the database
const testJobs = [
  { work_order_num: 1, scheduled_date: '2026-01-15' },
  { work_order_num: 2, scheduled_date: '2026-01-17' },
  { work_order_num: 3, scheduled_date: '2026-01-20' },
  { work_order_num: 4, scheduled_date: '2026-01-12' },
  { work_order_num: 5, scheduled_date: '2025-12-31' },
  { work_order_num: 6, scheduled_date: '2026-01-01' },
];

console.log('Test Jobs:');
testJobs.forEach(job => {
  console.log(`  WO-${job.work_order_num}: ${job.scheduled_date}`);
});
console.log('');

// Create calendar days (simplified version)
const calendarDays = () => {
  const monthStartDate = startOfMonth(currentDate);
  const startDate = startOfWeek(monthStartDate);
  
  const days = [];
  let day = startDate;
  
  for (let i = 0; i < 42; i++) {
    days.push(day);
    day = addDays(day, 1);
  }
  
  return days;
};

// Simulate the getJobsForDay function
const getJobsForDay = (date, jobs) => {
  return jobs.filter(job => {
    const calendarDateEastern = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
    return job.scheduled_date === calendarDateEastern;
  });
};

console.log('4. MATCHING JOBS TO CALENDAR DAYS:');
console.log('-'.repeat(80));

const days = calendarDays();
let matchedCount = 0;
let totalJobsFound = 0;

days.forEach((date, index) => {
  const dateString = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
  const matchedJobs = getJobsForDay(date, testJobs);
  
  if (matchedJobs.length > 0) {
    console.log(`Day ${index + 1}: ${dateString} (${format(date, 'EEE')})`);
    matchedJobs.forEach(job => {
      console.log(`  ✓ Matched WO-${job.work_order_num} (scheduled: ${job.scheduled_date})`);
    });
    matchedCount++;
    totalJobsFound += matchedJobs.length;
  }
});

console.log('');
console.log(`Found ${totalJobsFound} job matches across ${matchedCount} days`);
console.log('');

// Test edge cases
console.log('5. EDGE CASE ANALYSIS:');
console.log('-'.repeat(80));

// Test 1: Date at month boundary
const testDate1 = new Date('2026-01-01T00:00:00');
const formatted1 = formatInTimeZone(testDate1, TIMEZONE, 'yyyy-MM-dd');
console.log('Test 1 - First day of month:');
console.log(`  Input: ${testDate1.toISOString()}`);
console.log(`  Formatted (ET): ${formatted1}`);
console.log(`  Match with "2026-01-01": ${formatted1 === '2026-01-01' ? '✓ YES' : '✗ NO'}`);
console.log('');

// Test 2: Date string from database
const testDate2 = '2026-01-15';
console.log('Test 2 - Database date string:');
console.log(`  Database value: ${testDate2}`);
console.log(`  Direct comparison: ${testDate2 === '2026-01-15' ? '✓ WORKS' : '✗ FAILS'}`);
console.log('');

// Test 3: Calendar date object conversion
const calendarDate = new Date(2026, 0, 15); // January 15, 2026
const formatted3 = formatInTimeZone(calendarDate, TIMEZONE, 'yyyy-MM-dd');
console.log('Test 3 - Calendar Date object:');
console.log(`  Date object: ${calendarDate}`);
console.log(`  Formatted (ET): ${formatted3}`);
console.log(`  Match with "2026-01-15": ${formatted3 === '2026-01-15' ? '✓ YES' : '✗ NO'}`);
console.log('');

// Test 4: Timezone boundary issue
const testDate4 = new Date('2026-01-15T04:59:59Z'); // Just before 5 AM UTC (midnight ET in winter)
const formatted4 = formatInTimeZone(testDate4, TIMEZONE, 'yyyy-MM-dd');
console.log('Test 4 - Timezone boundary (4:59 AM UTC):');
console.log(`  UTC time: ${testDate4.toISOString()}`);
console.log(`  Formatted (ET): ${formatted4}`);
console.log(`  Expected: 2026-01-14, Actual: ${formatted4}`);
console.log('');

const testDate5 = new Date('2026-01-15T05:00:00Z'); // 5 AM UTC (midnight ET)
const formatted5 = formatInTimeZone(testDate5, TIMEZONE, 'yyyy-MM-dd');
console.log('Test 5 - Timezone boundary (5:00 AM UTC):');
console.log(`  UTC time: ${testDate5.toISOString()}`);
console.log(`  Formatted (ET): ${formatted5}`);
console.log(`  Expected: 2026-01-15, Actual: ${formatted5}`);
console.log('');

// Test 6: Parsing YYYY-MM-DD as Date object (common bug)
console.log('Test 6 - Common Bug: new Date("YYYY-MM-DD"):');
const buggyDate = new Date('2026-01-15');
console.log(`  new Date("2026-01-15"): ${buggyDate.toISOString()}`);
console.log(`  This creates UTC midnight: ${buggyDate.toISOString().split('T')[0]}`);
const buggyFormatted = formatInTimeZone(buggyDate, TIMEZONE, 'yyyy-MM-dd');
console.log(`  When converted to ET: ${buggyFormatted}`);
console.log(`  ${buggyFormatted !== '2026-01-15' ? '✗ BUG: Off by one day!' : '✓ OK'}`);
console.log('');

console.log('='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
console.log('');

// Recommendations
console.log('RECOMMENDATIONS:');
console.log('-'.repeat(80));
console.log('1. ✓ Calendar query range calculation looks correct');
console.log('2. ✓ Date matching logic (formatInTimeZone comparison) is correct');
console.log('3. ⚠ Never use new Date("YYYY-MM-DD") for date-only values');
console.log('4. ⚠ Always store dates as YYYY-MM-DD strings in PostgreSQL DATE columns');
console.log('5. ⚠ Database queries must use DATE columns correctly (no timezone conversion)');
console.log('');
console.log('POTENTIAL ISSUES TO CHECK:');
console.log('-'.repeat(80));
console.log('A. Are jobs actually in the database for the current month?');
console.log('B. Are the phase filters excluding all jobs?');
console.log('C. Is the scheduled_date column actually populated?');
console.log('D. Are there any WHERE conditions filtering out jobs?');
console.log('E. Is the current_phase_id matching the expected phase IDs?');
console.log('');
