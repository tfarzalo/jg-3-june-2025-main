#!/bin/bash

# Apply Email Schedule Config Migration
# This script applies the migration that adds the ability to change email send time

echo "🚀 Applying email schedule configuration migration..."

# Navigate to project directory
cd "$(dirname "$0")"

# Check if migration file exists
MIGRATION_FILE="supabase/migrations/20260123_add_email_schedule_config.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found"
echo ""
echo "📋 This migration will:"
echo "  1. Create daily_email_config table"
echo "  2. Add default configuration (12:00 UTC / 7:00 AM EST)"
echo "  3. Setup RLS policies for admin access"
echo "  4. Create trigger function to auto-update cron job"
echo "  5. Create trigger on config changes"
echo ""
echo "⚠️  Make sure you have:"
echo "  - Supabase CLI installed"
echo "  - Project linked (supabase link)"
echo "  - Database access"
echo ""
read -p "Continue with migration? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🔄 Applying migration..."

# Apply migration using Supabase CLI
npx supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 Next steps:"
    echo "  1. Check the admin settings UI at /admin"
    echo "  2. Go to 'Daily Agenda Email Settings'"
    echo "  3. Test changing the send time"
    echo "  4. Run test_schedule_change.sql to verify cron job updated"
    echo ""
    echo "📝 To verify:"
    echo "  - Run: psql -f test_schedule_change.sql"
    echo "  - Or check cron.job table in Supabase dashboard"
else
    echo ""
    echo "❌ Migration failed. Check error messages above."
    echo ""
    echo "💡 Troubleshooting:"
    echo "  - Verify Supabase CLI is installed: npx supabase --version"
    echo "  - Check project is linked: npx supabase status"
    echo "  - Verify database credentials"
    exit 1
fi
