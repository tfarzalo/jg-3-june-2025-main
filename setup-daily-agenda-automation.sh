#!/bin/bash

###############################################################################
# Daily Agenda Email Automation - Complete Setup Script
# 
# This script guides you through setting up the automated daily agenda email.
# Run each section manually and verify before proceeding to the next.
###############################################################################

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   📧 Daily Agenda Email Automation Setup                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

###############################################################################
# STEP 1: Generate and Set Cron Secret
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "${BLUE}STEP 1: Generate and Set Cron Secret${NC}"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Generating secure random secret..."
CRON_SECRET=$(openssl rand -base64 32)
echo ""
echo "${GREEN}✓ Generated secret:${NC}"
echo "${YELLOW}${CRON_SECRET}${NC}"
echo ""
echo "SAVE THIS SECRET - You'll need it for Step 4!"
echo ""

read -p "Press ENTER to set this secret in Supabase..."

echo "Setting CRON_SECRET in Supabase..."
supabase secrets set CRON_SECRET="${CRON_SECRET}"

echo ""
echo "${GREEN}✓ Step 1 Complete!${NC}"
echo ""

###############################################################################
# STEP 2: Deploy Database Migrations
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "${BLUE}STEP 2: Deploy Database Migrations${NC}"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

read -p "Press ENTER to deploy tracking table migration..."

echo "Deploying tracking table migration..."
supabase db push supabase/migrations/20260123_daily_summary_tracking.sql

echo ""
echo "${GREEN}✓ Step 2 Complete!${NC}"
echo ""

###############################################################################
# STEP 3: Deploy Edge Function
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "${BLUE}STEP 3: Deploy Cron Trigger Function${NC}"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

read -p "Press ENTER to deploy the cron trigger function..."

echo "Deploying daily-agenda-cron-trigger function..."
supabase functions deploy daily-agenda-cron-trigger

echo ""
echo "${GREEN}✓ Step 3 Complete!${NC}"
echo ""

###############################################################################
# STEP 4: Set Database Configuration
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "${BLUE}STEP 4: Set Database Configuration${NC}"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo "You need to set your Supabase project URL and cron secret in the database."
echo ""
echo "${YELLOW}Please replace YOUR_PROJECT with your actual project ID.${NC}"
echo ""
echo "Run these commands in your database (via Supabase SQL Editor or psql):"
echo ""
echo "${YELLOW}ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';${NC}"
echo "${YELLOW}ALTER DATABASE postgres SET app.cron_secret = '${CRON_SECRET}';${NC}"
echo ""
echo "To connect via psql, run: ${BLUE}supabase db remote connect${NC}"
echo ""

read -p "Press ENTER once you've set the database configuration..."

echo ""
echo "${GREEN}✓ Step 4 Complete!${NC}"
echo ""

###############################################################################
# STEP 5: Schedule Cron Job
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "${BLUE}STEP 5: Schedule Cron Job${NC}"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Now we'll schedule the daily cron job."
echo ""
echo "${YELLOW}Option A:${NC} Run the migration file (easiest):"
echo "  ${BLUE}supabase db push supabase/migrations/20260123_setup_daily_cron.sql${NC}"
echo ""
echo "${YELLOW}Option B:${NC} Connect to database and run SQL manually:"
echo "  ${BLUE}supabase db remote connect${NC}"
echo "  Then copy/paste the SQL from: supabase/migrations/20260123_setup_daily_cron.sql"
echo ""

read -p "Press ENTER once you've scheduled the cron job..."

echo ""
echo "${GREEN}✓ Step 5 Complete!${NC}"
echo ""

###############################################################################
# STEP 6: Test the Setup
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "${BLUE}STEP 6: Test the Setup${NC}"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Test options:"
echo ""
echo "1. ${BLUE}Via UI:${NC} Open your app → Settings → Daily Agenda Email Settings → Send Test Email"
echo ""
echo "2. ${BLUE}Via API:${NC} Call the cron trigger function directly:"
echo "   ${YELLOW}curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/daily-agenda-cron-trigger \\${NC}"
echo "   ${YELLOW}     -H \"Authorization: Bearer ${CRON_SECRET}\" \\${NC}"
echo "   ${YELLOW}     -H \"Content-Type: application/json\" \\${NC}"
echo "   ${YELLOW}     -d '{\"test\": true}'${NC}"
echo ""

read -p "Press ENTER once you've tested the setup..."

echo ""
echo "${GREEN}✓ Step 6 Complete!${NC}"
echo ""

###############################################################################
# STEP 7: Verify & Monitor
###############################################################################
echo ""
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "${BLUE}STEP 7: Verify & Monitor${NC}"
echo "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Verify the setup with these commands:"
echo ""
echo "1. ${BLUE}Check cron job:${NC}"
echo "   ${YELLOW}supabase db remote connect${NC}"
echo "   ${YELLOW}SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-cron';${NC}"
echo ""
echo "2. ${BLUE}View recent email sends:${NC}"
echo "   ${YELLOW}SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 5;${NC}"
echo ""
echo "3. ${BLUE}View function logs:${NC}"
echo "   ${YELLOW}supabase functions logs daily-agenda-cron-trigger --tail${NC}"
echo ""

###############################################################################
# COMPLETE
###############################################################################
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ${GREEN}✓ Setup Complete!${NC}                                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 Your daily agenda emails will now send automatically!"
echo ""
echo "📅 Current schedule: 7:00 AM EST every day (0 12 * * * UTC)"
echo ""
echo "📚 For detailed documentation, see:"
echo "   - DAILY_AGENDA_AUTOMATION_SETUP_GUIDE.md"
echo "   - QUICK_START_DAILY_AGENDA.md"
echo ""
echo "🔧 To change the schedule, edit: supabase/migrations/20260123_setup_daily_cron.sql"
echo ""
