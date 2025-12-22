#!/bin/bash

# Test script for calendar-feed function
# This script tests the enhanced calendar-feed function with different scopes

echo "🧪 Testing Calendar Feed Function"
echo "================================="

# Base URL for the function
BASE_URL="https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed"

echo ""
echo "📋 Test 1: Missing token (should return 400)"
echo "--------------------------------------------"
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL?scope=events"

echo ""
echo "📋 Test 2: Invalid token (should return 403)"
echo "--------------------------------------------"
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL?scope=events&token=invalid-token"

echo ""
echo "📋 Test 3: Invalid scope (should return 400)"
echo "--------------------------------------------"
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL?scope=invalid&token=test-token"

echo ""
echo "📋 Test 4: Valid request with test token (should return 200 or 403)"
echo "-------------------------------------------------------------------"
# Note: This will likely return 403 since we don't have a valid token
# In a real test, you would need to get a valid token from the database
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL?scope=events&token=test-token"

echo ""
echo "📋 Test 5: Test different scopes with test token"
echo "------------------------------------------------"
for scope in "events" "events_and_job_requests" "completed_jobs" "subcontractor"; do
    echo "Testing scope: $scope"
    curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL?scope=$scope&token=test-token"
    echo ""
done

echo ""
echo "🔧 To get a valid token for testing:"
echo "1. Login to the application"
echo "2. Go to Calendar page"
echo "3. Click 'Subscribe to Calendars'"
echo "4. Copy one of the generated tokens"
echo "5. Replace 'test-token' in this script with the actual token"

echo ""
echo "✅ Test completed!"
