#!/bin/bash

# Test script for approval system and notifications
# This script helps test the complete approval flow

echo "🧪 Testing Approval System and Notifications"
echo "=============================================="

echo "📋 Test Checklist:"
echo "1. ✅ Create a job with extra charges"
echo "2. ✅ Send approval email with approval link"
echo "3. ✅ Click approval link (opens in new tab)"
echo "4. ✅ Verify job phase changes to 'Work Order'"
echo "5. ✅ Check notification appears in bell dropdown"
echo "6. ✅ Verify real-time updates work without refresh"

echo ""
echo "🚀 Steps to Test:"
echo "1. Navigate to a job in 'Pending Work Order' phase"
echo "2. Click 'Send Approval Email' button"
echo "3. Copy the approval link from the email preview"
echo "4. Open the approval link in a new browser tab"
echo "5. Click 'Approve Extra Charges' button"
echo "6. Return to main dashboard and check:"
echo "   - Job should be in 'Work Order' phase"
echo "   - Bell notification should show new notification"
echo "   - Page should update automatically (no refresh needed)"

echo ""
echo "🔧 Troubleshooting:"
echo "If notifications don't appear:"
echo "1. Check browser console for errors"
echo "2. Verify real-time subscriptions are connected"
echo "3. Check database for notification records"
echo "4. Try refreshing the page manually"

echo ""
echo "📊 Database Queries to Check:"
echo "-- Check if approval created notifications:"
echo "SELECT * FROM user_notifications WHERE type = 'approval' ORDER BY created_at DESC LIMIT 5;"
echo ""
echo "-- Check if job phase changed:"
echo "SELECT * FROM job_phase_changes ORDER BY changed_at DESC LIMIT 5;"
echo ""
echo "-- Check job current phase:"
echo "SELECT j.id, j.work_order_num, jp.job_phase_label"
echo "FROM jobs j"
echo "JOIN job_phases jp ON jp.id = j.current_phase_id"
echo "WHERE j.work_order_num = [YOUR_JOB_NUMBER];"

echo ""
echo "🎯 Success Criteria:"
echo "✅ Job phase changes from 'Pending Work Order' to 'Work Order'"
echo "✅ Notification appears in bell dropdown without refresh"
echo "✅ Real-time updates work across the application"
echo "✅ No errors in browser console"

echo ""
echo "Ready to test! Follow the steps above to verify the approval system works correctly."
