#!/bin/bash

# Approval Workflow Deployment Script
# November 17, 2025

set -e  # Exit on error

echo "🚀 Starting Approval Workflow Deployment..."
echo "================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Step 1: Apply Database Migrations
echo ""
echo "📦 Step 1: Applying Database Migrations..."
echo "------------------------------------------------"

echo "Applying approval token system migration..."
supabase db push || {
    echo "⚠️  Warning: Database migration may need manual application"
    echo "   Please apply the SQL files manually via Supabase Dashboard:"
    echo "   - supabase/migrations/add_approval_token_system.sql"
    echo "   - supabase/migrations/add_storage_policies_for_approval_images.sql"
}

# Step 2: Deploy Edge Functions
echo ""
echo "⚡ Step 2: Deploying Edge Functions..."
echo "------------------------------------------------"

echo "Deploying validate-approval-token function..."
supabase functions deploy validate-approval-token

echo "Deploying process-approval function..."
supabase functions deploy process-approval

# Step 3: Verify Deployment
echo ""
echo "✅ Step 3: Verifying Deployment..."
echo "------------------------------------------------"

# Check if functions are deployed
echo "Checking deployed functions..."
supabase functions list

# Step 4: Next Steps
echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Verify Storage Bucket Policies:"
echo "   → https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/storage/policies"
echo "   → Ensure 'job-images' bucket allows public read via signed URLs"
echo ""
echo "2. Test the Approval Flow:"
echo "   → Create a test approval request"
echo "   → Check that approval_token is generated"
echo "   → Test the /approve/{token} route"
echo "   → Verify images load without authentication"
echo ""
echo "3. Update Email Templates:"
echo "   → ExtraChargesForm.tsx"
echo "   → SprinklerForm.tsx"
echo "   → OtherChargesForm.tsx"
echo "   → Use new approval link format: /approve/{token}"
echo "   → Include signed image URLs"
echo ""
echo "4. Monitor Logs:"
echo "   → Edge Function logs: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/functions"
echo "   → Check for any errors during first use"
echo ""
echo "📖 Full documentation available in:"
echo "   APPROVAL_WORKFLOW_IMPLEMENTATION_GUIDE.md"
echo ""
echo "🔄 To rollback if needed:"
echo "   git reset --hard 6ae62a1"
echo ""
