// Test minimal ICS generation
const lines = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Test//Calendar Feed//EN",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "BEGIN:VEVENT",
  "UID:test-123@app",
  "DTSTAMP:20251113T120000Z",
  "DTSTART:20251115T140000Z",
  "DTEND:20251115T150000Z",
  "SUMMARY:Test Event",
  "DESCRIPTION:This is a test event",
  "END:VEVENT",
  "END:VCALENDAR"
];

const body = lines.join("\r\n");
console.log(body);
console.log("\nLength:", body.length);
console.log("Valid ICS:", body.includes("BEGIN:VCALENDAR") && body.includes("END:VCALENDAR"));
