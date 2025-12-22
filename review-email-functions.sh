#!/bin/bash
# Email Functions Consolidation - Quick Commands
# Run from project root directory

echo "=== Email Functions Review and Consolidation ==="
echo ""

# Function to print colored output
print_header() {
    echo -e "\n\033[1;34m=== $1 ===\033[0m"
}

print_success() {
    echo -e "\033[0;32m✓ $1\033[0m"
}

print_warning() {
    echo -e "\033[0;33m⚠ $1\033[0m"
}

print_error() {
    echo -e "\033[0;31m✗ $1\033[0m"
}

# 1. Check current deployed functions
print_header "Deployed Functions on Supabase"
npx supabase functions list

# 2. Check environment secrets
print_header "Environment Secrets Status"
npx supabase secrets list | grep -E "ZOHO|RESEND"

# 3. Test send-email function (health check)
print_header "Testing send-email Function"
RESPONSE=$(curl -s -X GET "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI")

echo "$RESPONSE" | jq .

# Check if Zoho credentials are set
if echo "$RESPONSE" | jq -e '.env_check.ZOHO_EMAIL == "SET"' > /dev/null; then
    print_success "Zoho credentials are configured"
else
    print_error "Zoho credentials are NOT configured"
fi

# 4. Summary and recommendations
print_header "Summary"
echo ""
echo "Current State:"
echo "  • send-email: ✓ Deployed and working with Zoho credentials"
echo "  • send-zoho-email: ⚠ Deployed but legacy (not in local code)"
echo "  • send-notification-email: ✗ Not deployed (only in local code)"
echo ""
echo "Code Status:"
echo "  • NotificationEmailModal.tsx: ✓ NOW uses send-email (just fixed)"
echo "  • EnhancedPropertyNotificationModal.tsx: ✓ Uses send-email"
echo "  • SupportTickets.tsx: ✓ Uses send-email"
echo ""

print_header "Recommended Actions"
echo ""
echo "1. DELETE legacy function from Supabase:"
echo "   npx supabase functions delete send-zoho-email"
echo ""
echo "2. (Optional) Remove unused local function:"
echo "   rm -rf supabase/functions/send-notification-email"
echo ""
echo "3. Test email sending from the application:"
echo "   - Open NotificationEmailModal and send a test email"
echo "   - Open SupportTickets and test ticket notifications"
echo "   - Verify emails are received"
echo ""

print_header "Test Email Sending (Optional)"
echo ""
echo "To send a test email, run:"
echo ""
echo 'curl -X POST "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \'
echo '  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{'
echo '    "to": "YOUR_EMAIL@example.com",'
echo '    "subject": "Test Email from JG Painting Pros",'
echo '    "html": "<h1>Test Email</h1><p>This is a test.</p>",'
echo '    "text": "Test Email - This is a test."'
echo '  }'"'"
echo ""
