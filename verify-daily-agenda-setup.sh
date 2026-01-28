#!/bin/bash

###############################################################################
# Daily Agenda Automation - Verification Script
# 
# Run this after deployment to verify everything is working correctly.
###############################################################################

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   🔍 Daily Agenda Automation Verification                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

###############################################################################
# Helper Functions
###############################################################################

print_check() {
    echo "${BLUE}Checking:${NC} $1"
}

print_pass() {
    echo "${GREEN}✓ PASS:${NC} $1"
    PASSED=$((PASSED + 1))
}

print_fail() {
    echo "${RED}✗ FAIL:${NC} $1"
    FAILED=$((FAILED + 1))
}

print_warn() {
    echo "${YELLOW}⚠ WARN:${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

print_info() {
    echo "${BLUE}ℹ INFO:${NC} $1"
}

###############################################################################
# Check 1: CRON_SECRET exists
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
print_check "CRON_SECRET is set"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

if supabase secrets list 2>/dev/null | grep -q "CRON_SECRET"; then
    print_pass "CRON_SECRET is set in Supabase"
else
    print_fail "CRON_SECRET not found. Run: openssl rand -base64 32 | xargs -I {} supabase secrets set CRON_SECRET={}"
fi

###############################################################################
# Check 2: Functions deployed
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
print_check "Edge Functions are deployed"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

if supabase functions list 2>/dev/null | grep -q "daily-agenda-cron-trigger"; then
    print_pass "daily-agenda-cron-trigger function is deployed"
else
    print_fail "daily-agenda-cron-trigger not found. Run: supabase functions deploy daily-agenda-cron-trigger"
fi

if supabase functions list 2>/dev/null | grep -q "send-daily-agenda-email"; then
    print_pass "send-daily-agenda-email function is deployed"
else
    print_warn "send-daily-agenda-email not found (should already exist)"
fi

###############################################################################
# Check 3: Database objects exist
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
print_check "Database objects exist"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

print_info "Connecting to database to check tables and cron job..."
echo "You may be prompted for your database password."
echo ""

# Create a temporary SQL file
TMP_SQL=$(mktemp)
cat > "$TMP_SQL" << 'EOF'
-- Check tracking table
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_summary_log')
        THEN '✓ PASS: daily_summary_log table exists'
        ELSE '✗ FAIL: daily_summary_log table not found'
    END as tracking_table_check;

-- Check cron extension
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
        THEN '✓ PASS: pg_cron extension is installed'
        ELSE '✗ FAIL: pg_cron extension not found'
    END as cron_extension_check;

-- Check cron job
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-agenda-email-cron')
        THEN '✓ PASS: daily-agenda-email-cron job is scheduled'
        ELSE '✗ FAIL: daily-agenda-email-cron job not found'
    END as cron_job_check;

-- Show cron job details if it exists
SELECT 
    jobid, 
    jobname, 
    schedule,
    active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';

-- Check database config
SELECT 
    CASE 
        WHEN current_setting('app.supabase_url', true) IS NOT NULL 
        THEN '✓ PASS: app.supabase_url is configured'
        ELSE '✗ FAIL: app.supabase_url not set'
    END as url_config_check;

SELECT 
    CASE 
        WHEN current_setting('app.cron_secret', true) IS NOT NULL 
        THEN '✓ PASS: app.cron_secret is configured'
        ELSE '✗ FAIL: app.cron_secret not set'
    END as secret_config_check;
EOF

# Run the checks
if ! psql -d $(supabase db remote connection-string) -f "$TMP_SQL" 2>/dev/null; then
    print_fail "Could not connect to database. Make sure you're logged in with: supabase login"
else
    echo ""
    print_pass "Database checks completed (see results above)"
fi

rm "$TMP_SQL"

###############################################################################
# Check 4: Recent sends (if any)
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
print_check "Recent email sends"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

print_info "Checking for recent email sends..."

TMP_SQL2=$(mktemp)
cat > "$TMP_SQL2" << 'EOF'
SELECT 
    COUNT(*) as total_sends,
    COUNT(*) FILTER (WHERE success = true) as successful,
    COUNT(*) FILTER (WHERE success = false) as failed,
    MAX(sent_at) as last_send
FROM daily_summary_log;

-- Show last 5 sends
SELECT 
    sent_at,
    success,
    recipient_count,
    triggered_by,
    COALESCE(error_message, 'None') as error
FROM daily_summary_log 
ORDER BY sent_at DESC 
LIMIT 5;
EOF

if psql -d $(supabase db remote connection-string) -f "$TMP_SQL2" 2>/dev/null; then
    print_pass "Email send history retrieved (see above)"
else
    print_warn "Could not retrieve email send history"
fi

rm "$TMP_SQL2"

###############################################################################
# Check 5: Cron execution history
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
print_check "Cron execution history"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

print_info "Checking cron execution history..."

TMP_SQL3=$(mktemp)
cat > "$TMP_SQL3" << 'EOF'
SELECT 
    start_time,
    end_time,
    status,
    return_message
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-cron')
ORDER BY start_time DESC 
LIMIT 5;
EOF

if psql -d $(supabase db remote connection-string) -f "$TMP_SQL3" 2>/dev/null; then
    print_pass "Cron execution history retrieved (see above)"
else
    print_warn "Could not retrieve cron execution history (may not have run yet)"
fi

rm "$TMP_SQL3"

###############################################################################
# Summary
###############################################################################
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   📊 Verification Summary                                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "${GREEN}Passed:${NC} $PASSED"
echo "${RED}Failed:${NC} $FAILED"
echo "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Send a test email via UI: Settings → Daily Agenda Email Settings"
    echo "  2. Monitor logs: supabase functions logs daily-agenda-cron-trigger --tail"
    echo "  3. Wait for first automated send at 7:00 AM EST"
    echo ""
else
    echo "${RED}✗ Some checks failed. Please review the errors above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Missing secret: supabase secrets set CRON_SECRET=\$(openssl rand -base64 32)"
    echo "  - Missing function: supabase functions deploy daily-agenda-cron-trigger"
    echo "  - Missing table: supabase db push supabase/migrations/20260123_daily_summary_tracking.sql"
    echo "  - Missing cron: supabase db push supabase/migrations/20260123_setup_daily_cron.sql"
    echo ""
fi

###############################################################################
# Additional Info
###############################################################################
echo "Additional commands:"
echo "  ${BLUE}View function logs:${NC}"
echo "    supabase functions logs daily-agenda-cron-trigger --tail"
echo ""
echo "  ${BLUE}Check cron job status:${NC}"
echo "    supabase db remote connect"
echo "    SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-cron';"
echo ""
echo "  ${BLUE}View recent sends:${NC}"
echo "    supabase db remote connect"
echo "    SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 10;"
echo ""
echo "For full documentation, see:"
echo "  - DAILY_AGENDA_AUTOMATION_SETUP_GUIDE.md"
echo "  - DAILY_AGENDA_QUICK_REF.txt"
echo ""
