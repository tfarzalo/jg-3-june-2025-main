// Test script to debug calendar feed URL issues

// Test URLs from the modal
const baseUrl = "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed";
const testToken = "test-token-123";

// Generate test URLs
const eventsUrl = `${baseUrl}?scope=events&token=${testToken}`;
const webcalsUrl = eventsUrl.replace(/^https:\/\//, "webcals://");
const googleUrl = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(eventsUrl)}`;

console.log("=== Calendar Feed URL Testing ===\n");
console.log("1. Direct HTTPS URL:");
console.log(eventsUrl);
console.log("\n2. Apple Calendar URL (webcals://):");
console.log(webcalsUrl);
console.log("\n3. Google Calendar URL:");
console.log(googleUrl);
console.log("\n4. URL Encoding Test:");
console.log("   Original:", eventsUrl);
console.log("   Encoded:", encodeURIComponent(eventsUrl));

// Test common issues
console.log("\n=== Common Issues ===");
console.log("1. Query params in webcals URL: " + (webcalsUrl.includes("?") ? "✓ Present" : "✗ Missing"));
console.log("2. Special characters encoded: " + (googleUrl.includes("%3F") ? "✓ Yes" : "✗ No"));
console.log("3. HTTPS cert valid: Check manually");

// Additional URL format tests
console.log("\n=== Alternative Formats ===");
// Some calendar apps prefer the webcal:// protocol over webcals://
const webcalUrl = eventsUrl.replace(/^https:\/\//, "webcal://");
console.log("4. Webcal (non-secure) URL:");
console.log(webcalUrl);

// Test if URL is too long (some apps have limits)
console.log("\n5. URL Length:");
console.log("   HTTPS URL:", eventsUrl.length, "chars");
console.log("   Webcals URL:", webcalsUrl.length, "chars");
console.log("   Google URL:", googleUrl.length, "chars");
console.log("   (Limit: ~2000 chars for most apps)");

// Test Content-Type header expectations
console.log("\n=== Expected Headers ===");
console.log("Content-Type: text/calendar; charset=utf-8");
console.log("Content-Disposition: attachment; filename=\"calendar-events.ics\"");
console.log("Cache-Control: public, max-age=300");

console.log("\n=== Testing Recommendations ===");
console.log("1. Try the webcal:// URL instead of webcals:// for Apple Calendar");
console.log("2. Test by downloading the ICS file directly (HTTPS URL in browser)");
console.log("3. Check if the ICS file opens in Calendar.app when downloaded");
console.log("4. Verify token is valid in the actual app");
console.log("5. Try 'Add by URL' instead of opening the webcals:// link");
