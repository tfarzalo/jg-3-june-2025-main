#!/bin/bash

###############################################################################
# Helper Script: Configure Cron Settings
# 
# This script helps you set the configuration values in the cron_config table.
# Run this AFTER deploying the 20260123_setup_daily_cron.sql migration.
###############################################################################

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   🔧 Daily Agenda Cron Configuration Setup                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get Supabase Project ID
echo "${BLUE}Step 1: Enter your Supabase Project ID${NC}"
echo "You can find this in your Supabase dashboard URL:"
echo "https://supabase.com/dashboard/project/YOUR_PROJECT_ID"
echo ""
read -p "Enter your Supabase Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "${RED}Error: Project ID cannot be empty${NC}"
    exit 1
fi

SUPABASE_URL="https://${PROJECT_ID}.supabase.co"
echo "${GREEN}✓ Supabase URL: ${SUPABASE_URL}${NC}"
echo ""

# Get CRON_SECRET
echo "${BLUE}Step 2: Enter your CRON_SECRET${NC}"
echo "This should be the secret you generated and set in Step 1."
echo "If you haven't generated it yet, run: openssl rand -base64 32"
echo ""
read -sp "Enter your CRON_SECRET: " CRON_SECRET
echo ""

if [ -z "$CRON_SECRET" ]; then
    echo "${RED}Error: CRON_SECRET cannot be empty${NC}"
    exit 1
fi

echo "${GREEN}✓ CRON_SECRET received${NC}"
echo ""

# Create SQL file
TMP_SQL=$(mktemp)
cat > "$TMP_SQL" << EOF
-- Set Supabase URL
INSERT INTO cron_config (key, value) 
VALUES ('supabase_url', '${SUPABASE_URL}') 
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Set Cron Secret
INSERT INTO cron_config (key, value) 
VALUES ('cron_secret', '${CRON_SECRET}') 
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Verify the values are set
SELECT key, 
       CASE 
         WHEN key = 'cron_secret' THEN '***REDACTED***'
         ELSE value 
       END as value,
       updated_at 
FROM cron_config 
ORDER BY key;
EOF

echo "${BLUE}Step 3: Applying configuration to database...${NC}"
echo ""

# Connect and run SQL
if psql -d $(supabase db remote connection-string) -f "$TMP_SQL"; then
    echo ""
    echo "${GREEN}✓ Configuration successfully applied!${NC}"
    echo ""
    echo "You should see both values listed above:"
    echo "  - supabase_url: ${SUPABASE_URL}"
    echo "  - cron_secret: ***REDACTED***"
    echo ""
else
    echo ""
    echo "${RED}✗ Failed to apply configuration${NC}"
    echo ""
    echo "Manual steps:"
    echo "1. Run: supabase db remote connect"
    echo "2. Copy and paste the contents of: set_cron_config.sql"
    echo "3. Replace YOUR_PROJECT_ID with: ${PROJECT_ID}"
    echo "4. Replace YOUR_CRON_SECRET with your actual secret"
    echo ""
    rm "$TMP_SQL"
    exit 1
fi

# Clean up
rm "$TMP_SQL"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ${GREEN}✓ Configuration Complete!${NC}                                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Deploy the cron trigger function:"
echo "     ${BLUE}supabase functions deploy daily-agenda-cron-trigger${NC}"
echo ""
echo "  2. Test the setup via UI or API"
echo ""
echo "  3. Verify with:"
echo "     ${BLUE}./verify-daily-agenda-setup.sh${NC}"
echo ""
